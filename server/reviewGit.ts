import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { AcliError, MAX_REVIEW_INFO_CHARS } from './acli.ts';
import { redactSecrets, stripUrlCredentials } from './redact.ts';
import { ReviewError } from './reviewError.ts';
import { createSpecRunService } from './specRun.ts';
import type { SpecGate } from './specRun.ts';
import { planOverlay } from './serverOverlay.ts';
import { isRunnableSpecPath } from './specRunner.ts';
import type { AcliErrorKind } from './acli.ts';
import { createGhChecker } from './ghStatus.ts';
import type { GhChecker, GhStatus } from './ghStatus.ts';
import { FORBIDDEN_BASE_BRANCHES, MAX_PICKS, MAX_PICK_SCAN, TEMP_WORKTREE_PREFIX, createGitGuard } from './gitGuard.ts';
import type { JiraClient, JiraIssue } from './acli.ts';

/**
 * Local "pull request"-style review of QA branches, driven entirely by the
 * `git` CLI that is already authenticated on this machine. Nothing here talks
 * to the GitHub API: fetch/push go through whatever remote auth (SSH key or
 * credential helper) the developer's git is already set up with.
 *
 * "Rebase and merge" mirrors GitHub's button: replay the branch's commits on
 * top of the base branch, then fast-forward the base branch to the result.
 * GUARD RAIL: every git command is validated by ./gitGuard.ts before it runs —
 * only checkout (temp worktree), rebase and the fast-forward merge push, plus
 * read-only inspection, and only for AT-### branches. See that file.
 *
 * It happens in a throw-away worktree, so the developer's own checkout
 * (current branch, uncommitted work) is never touched.
 */

export interface ReviewConfig {
  repoPath: string;
  baseBranch: string;
  remote: string;
  /** Jira project key; also the branch-name prefix (e.g. `AT-727-...`). */
  projectKey: string;
  /** The Rails test server's checkout (defaults to repoPath). */
  serverRepoPath?: string;
  /** Port the QA test server listens on (default 5017). */
  testServerPort?: number;
}

export interface BranchInfo {
  name: string;
  sha: string;
  author: string;
  date: string;
  /** Commits a rebase would replay: the branch's own, minus any the base already has (same change under another id). */
  ahead: number;
  /** Commits on the base branch that the branch really lacks (same-change copies don't count). */
  behind: number;
  /** `git diff --shortstat` of just the replayed commits: files changed / lines added / lines removed. */
  files: number;
  additions: number;
  deletions: number;
  /** Same as `ahead`; 0 means the base already has everything (e.g. it was rebase-merged, which rewrote the ids). */
  unmerged: number;
}

interface ReviewTicket {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  url: string | null;
  branches: BranchInfo[];
}

export interface ReviewList {
  baseBranch: string;
  baseSha: string;
  repoWebUrl: string | null;
  /** Set when the Review column couldn't be read from Jira — then `tickets` is empty. */
  jira: { error: string | null; errorKind: AcliErrorKind | null };
  tickets: ReviewTicket[];
  fetchedAt: string;
}

export interface ReviewStatus {
  ok: boolean;
  repoPath: string;
  baseBranch: string;
  remote: string;
  remoteUrl: string | null;
  repoWebUrl: string | null;
  /** One entry per thing that has to be installed/configured, with how to fix it. */
  requirements: Requirement[];
  problems: string[];
}

export interface Requirement {
  id: 'git' | 'acli' | 'repo' | 'remote';
  label: string;
  ok: boolean;
  /** What's wrong and what to do (empty when ok). */
  fix: string;
  /** A command to run to fix it, if there is one. */
  command?: string;
  /** A page with install instructions, if there is one. */
  url?: string;
}

/** An old commit at the bottom of a branch that the base branch already has under another id, so it isn't part of the review. */
export interface SkippedCommit {
  sha: string;
  subject: string;
  /** same-commit: the base has a commit by the same author at the same time (a rewrite keeps both). ticket-in-base: it belongs to another ticket the base already has commits for. */
  reason: 'same-commit' | 'ticket-in-base';
  key: string | null;
}

interface ReviewCommit {
  sha: string;
  author: string;
  date: string;
  subject: string;
  body: string;
}

export interface ReviewFile {
  path: string;
  oldPath: string | null;
  status: 'added' | 'deleted' | 'renamed' | 'modified';
  binary: boolean;
  additions: number;
  deletions: number;
  /** Unified-diff hunks only (no `diff --git` header). */
  patch: string;
  truncated: boolean;
}

/** How a reviewed branch lands on the base branch. Both end in a fast-forward of straight-line commits; neither ever makes a merge commit. */
export type MergeMethod = 'rebase' | 'cherry-pick';

/** What a cherry-pick would take: the commits at the tip of the branch whose subject starts with the ticket key. */
export interface PickInfo {
  /** There is at least one commit to cherry-pick. */
  available: boolean;
  /** The commits that would be applied, oldest first. */
  commits: ReviewCommit[];
  /** Commits found at the tip that the base branch already has (skipped). */
  alreadyApplied: number;
  /** Why nothing can be cherry-picked (null when something can). */
  reason: string | null;
  /** The prefix the commits are matched on, e.g. `AT-727`. */
  prefix: string;
}

/** Where the review decision the page shows comes from. */
export type ApprovalSource = 'app' | 'description' | 'field' | null;

/** The ticket as the page and the merge see it: the decision that applies to the commit being looked at. */
export interface ReviewTicketIssue extends Omit<JiraIssue, 'recorded'> {
  approvalSource: ApprovalSource;
  /** A decision exists but was made for an EARLIER commit of this branch (it changed since), so it no longer counts. */
  staleDecision: { decision: 'approved' | 'declined'; sha: string } | null;
}

export interface ReviewDetail {
  /** The method this view (commits, diff, specs, conflicts) was computed for. */
  method: MergeMethod;
  /** Merge commits inside the branch (rebase method). Rebasing would flatten them and could drop what only they contain. */
  mergeCommits: number;
  /** Commits on the branch (rebase method) whose subject doesn't start with the project key: a sign it was cut from another branch. */
  nonAtCommits: number;
  /** Older commits at the bottom of the branch that the base already has (left out of the review and of the rebase). */
  alreadyInBase: SkippedCommit[];
  /** More commits exist than are listed. */
  commitsTruncated: boolean;
  pick: PickInfo;
  /** Whether approving is allowed yet: every spec of this PR must have passed for this exact commit. */
  specGate: SpecGate;
  branch: string;
  /** The Jira ticket (in the Review column) this branch belongs to. */
  ticket: ReviewTicketIssue;
  sha: string;
  baseBranch: string;
  baseSha: string;
  ahead: number;
  behind: number;
  unmerged: number;
  /** null = couldn't be determined (e.g. git older than 2.38). */
  canRebase: boolean | null;
  conflicts: string[];
  commits: ReviewCommit[];
  files: ReviewFile[];
  /** Playwright specs this PR adds or changes — the ones that can be run. */
  specs: string[];
  /** Changed files that run inside the test server (not copied by a spec run). */
  serverCodeChanged: string[];
  /** Other Playwright files this PR changes (helpers, page objects, fixtures, cassettes…): nothing to run, but worth knowing. */
  supportFiles: string[];
  totals: { additions: number; deletions: number };
  branchUrl: string | null;
}

export interface MergeResult {
  method: MergeMethod;
  merged: number;
  baseBranch: string;
  newBaseSha: string;
  /** The AT-### branch was deleted from the remote after the merge. */
  branchDeleted: boolean;
  /** Ticket key moved to done in Jira, or null if that wasn't requested / didn't happen. */
  ticketMoved: string | null;
  warning: string | null;
}

export { ReviewError } from './reviewError.ts';

// ---------------------------------------------------------------------------
// git plumbing
// ---------------------------------------------------------------------------

interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Settings every git command runs with, so a developer's own git configuration can't change what
 * this app does (the commands themselves are checked by gitGuard.ts, these decide how git behaves):
 * - rebase.updateRefs=false: a rebase in the temp worktree must never move the developer's local branches;
 * - rebase.rebaseMerges=false: a rebase flattens, it never keeps merge commits;
 * - push.followTags=false: only the one ref is pushed;
 * - core.hooksPath=/dev/null: no hook (husky, pre-push...) from the branch or the repo runs here;
 * - core.quotePath=false keeps non-ASCII file names readable in diff headers.
 */
const GIT_SETTINGS = ['core.quotePath=false', 'rebase.updateRefs=false', 'rebase.rebaseMerges=false', 'push.followTags=false', 'core.hooksPath=/dev/null'];

/** Variables that would point git at some other repository or change how it is run; never inherited. */
const GIT_ENV_DROPPED = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_NAMESPACE', 'GIT_PREFIX', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS', 'GIT_EXTERNAL_DIFF', 'GIT_PAGER'];

export function gitEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  for (const key of GIT_ENV_DROPPED) delete env[key];
  for (const key of Object.keys(env)) if (/^GIT_CONFIG_(KEY|VALUE)_\d+$/.test(key)) delete env[key];
  return {
    ...env,
    // Never hang waiting on a credentials prompt there's no terminal for;
    // LC_ALL=C keeps git's messages stable so failures can be recognised.
    GIT_TERMINAL_PROMPT: '0',
    LC_ALL: 'C',
    // Never open an editor (continuing a rebase or cherry-pick keeps the existing message).
    GIT_EDITOR: 'true',
    GIT_SEQUENCE_EDITOR: 'true',
    GIT_MERGE_AUTOEDIT: 'no',
    // File names are names, never patterns.
    GIT_LITERAL_PATHSPECS: '1',
  };
}

function runGit(args: string[], cwd: string, timeoutMs = 60_000): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      'git',
      [...GIT_SETTINGS.flatMap((setting) => ['-c', setting]), ...args],
      {
        cwd,
        maxBuffer: MAX_BUFFER,
        timeout: timeoutMs,
        env: gitEnv(process.env),
      },
      (err, stdout, stderr) => {
        if (!err) {
          resolve({ code: 0, stdout, stderr });
          return;
        }
        const code = typeof (err as NodeJS.ErrnoException).code === 'number' ? Number((err as NodeJS.ErrnoException).code) : 1;
        // ENOENT (git missing) / timeouts have a non-numeric code; keep the
        // reason visible instead of an empty stderr.
        const extra = typeof (err as NodeJS.ErrnoException).code === 'number' ? '' : String(err.message);
        resolve({ code, stdout, stderr: `${stderr}${extra}` });
      },
    );
  });
}

function firstLines(text: string, n = 6): string {
  return redactSecrets(text.trim().split('\n').slice(0, n).join('\n')) || 'unknown error';
}

// ---------------------------------------------------------------------------
// helpers (exported for tests)
// ---------------------------------------------------------------------------

export function expandHome(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  return p;
}

/**
 * The web page for a remote, for "View on GitHub" links. Understands scp-style
 * (`git@host:o/r.git`), `ssh://git@host[:port]/o/r.git` and `https://host[:port]/o/r.git`.
 * Any credentials embedded in the URL are dropped, never copied into the link.
 */
export function toWebUrl(remoteUrl: string | null): string | null {
  if (!remoteUrl) return null;
  const url = stripUrlCredentials(remoteUrl.trim());
  const scp = /^git@([^:/]+):(.+?)(?:\.git)?\/?$/.exec(url);
  if (scp) return `https://${scp[1]}/${scp[2]}`;
  const ssh = /^ssh:\/\/git@([^/:]+)(?::\d+)?\/(.+?)(?:\.git)?\/?$/.exec(url);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  const http = /^(https?):\/\/([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(url);
  return http ? `${http[1]}://${http[2]}/${http[3]}` : null;
}

/**
 * Only plain ref-name characters; no leading dash (option injection), no `..`
 * (range syntax), no whitespace. The caller still has to confirm the ref
 * actually exists on the remote.
 */
export function isSafeBranchName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= 200 &&
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name) &&
    !name.includes('..') &&
    !name.endsWith('/') &&
    !name.endsWith('.lock')
  );
}

export function branchMatchesKey(branch: string, key: string): boolean {
  return branch === key || branch.startsWith(`${key}-`) || branch.startsWith(`${key}/`);
}

const PER_FILE_PATCH_LIMIT = 300_000;
/** The whole response for one review stays bounded however large the branch is. */
export const TOTAL_PATCH_LIMIT = 5_000_000;

/** Split `git diff` output into one entry per file. */
export function parseDiff(raw: string, perFileLimit = PER_FILE_PATCH_LIMIT, totalLimit = TOTAL_PATCH_LIMIT): ReviewFile[] {
  if (!raw.trim()) return [];
  const chunks = raw.split(/^diff --git /m).slice(1);
  const files = chunks.map((chunk) => {
    const lines = chunk.split('\n');
    const header = lines[0];
    let oldPath: string | null = null;
    let newPath: string | null = null;
    let status: ReviewFile['status'] = 'modified';
    let binary = false;
    let firstHunk = -1;

    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.startsWith('@@')) {
        firstHunk = i;
        break;
      }
      if (l.startsWith('new file mode')) status = 'added';
      else if (l.startsWith('deleted file mode')) status = 'deleted';
      else if (l.startsWith('rename from ')) {
        status = 'renamed';
        oldPath = l.slice('rename from '.length);
      } else if (l.startsWith('rename to ')) newPath = l.slice('rename to '.length);
      else if (l.startsWith('--- ') && l !== '--- /dev/null') oldPath = oldPath ?? l.slice(4).replace(/^a\//, '');
      else if (l.startsWith('+++ ') && l !== '+++ /dev/null') newPath = newPath ?? l.slice(4).replace(/^b\//, '');
      else if (l.startsWith('Binary files ') || l.startsWith('GIT binary patch')) binary = true;
    }

    if (!newPath && status !== 'deleted') newPath = pathFromHeader(header);
    const path = newPath ?? oldPath ?? pathFromHeader(header);
    const finalOld = status === 'renamed' ? oldPath : null;

    let additions = 0;
    let deletions = 0;
    let patch = '';
    if (firstHunk >= 0) {
      const body = lines.slice(firstHunk);
      for (const l of body) {
        if (l.startsWith('+')) additions++;
        else if (l.startsWith('-')) deletions++;
      }
      patch = body.join('\n').replace(/\n+$/, '');
    }
    let truncated = false;
    if (patch.length > perFileLimit) {
      patch = patch.slice(0, patch.lastIndexOf('\n', perFileLimit) >>> 0 || perFileLimit);
      truncated = true;
    }
    return { path, oldPath: finalOld, status, binary, additions, deletions, patch, truncated };
  });
  return capTotalPatchSize(files, totalLimit);
}

/** Once the running total passes the limit, later files keep their counts but lose their patch. */
function capTotalPatchSize(files: ReviewFile[], limit: number): ReviewFile[] {
  let used = 0;
  return files.map((f) => {
    if (used + f.patch.length > limit) return { ...f, patch: '', truncated: f.patch.length > 0 || f.truncated };
    used += f.patch.length;
    return f;
  });
}

function pathFromHeader(header: string): string {
  // `a/P b/P` — when both sides are the same path the midpoint is unambiguous
  // even if P contains spaces.
  const len = header.length;
  if ((len - 5) % 2 === 0) {
    const p = (len - 5) / 2;
    if (header.startsWith('a/') && header.slice(2, 2 + p) === header.slice(p + 5)) return header.slice(2, 2 + p);
  }
  const m = /^a\/(.*) b\/(.*)$/.exec(header);
  return m ? m[2] : header;
}

/** " 3 files changed, 12 insertions(+), 1 deletion(-)" -> numbers (all 0 for an empty diff). */
export function parseShortStat(text: string): { files: number; additions: number; deletions: number } {
  const num = (re: RegExp) => Number(re.exec(text)?.[1] ?? 0);
  return { files: num(/(\d+) files? changed/), additions: num(/(\d+) insertions?\(\+\)/), deletions: num(/(\d+) deletions?\(-\)/) };
}

/** Quote for a POSIX shell, only when needed, so a copied command can't be split or expanded. */
export function shellQuote(value: string): string {
  return /^[A-Za-z0-9_@%+=:,./~-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Is `bin` an executable file somewhere on PATH? (No process is spawned.) */
export function findOnPath(bin: string, pathEnv: string = process.env.PATH ?? ''): boolean {
  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue;
    try {
      if (statSync(join(dir, bin)).isFile()) return true;
    } catch {
      // not in this directory
    }
  }
  return false;
}

/**
 * Turn a failed `git fetch` into something a QA engineer can act on. The
 * common cause on a fresh machine is that git isn't signed in to GitHub.
 */
export function explainFetchFailure(stderr: string, repoPath: string, remote: string): string {
  const text = stderr.trim();
  if (/permission denied \(publickey\)|host key verification failed/i.test(text)) {
    return `Git couldn't sign in to GitHub over SSH. Make sure \`git fetch\` works in ${repoPath} (add your SSH key to GitHub), then refresh.`;
  }
  if (/authentication failed|could not read (username|password)|invalid username or password|terminal prompts disabled/i.test(text)) {
    return `Git isn't signed in to GitHub. Run \`gh auth login\` (or set up a credential helper), confirm \`git fetch\` works in ${repoPath}, then refresh.`;
  }
  if (/could not resolve host|unable to access|network is unreachable|timed out|operation timed out/i.test(text)) {
    return `Couldn't reach GitHub (${remote}). Check your internet/VPN connection, then refresh.`;
  }
  return `git fetch ${remote} failed: ${firstLines(text)}`;
}

// ---------------------------------------------------------------------------
// service
// ---------------------------------------------------------------------------

export interface ReviewServiceDeps {
  /** Jira via acli. Required: only tickets in the AT Review column are ever shown or merged. */
  jira: JiraClient;
  /** Injectable for tests: is this executable installed? Defaults to a PATH lookup. */
  findExecutable?: (bin: string) => boolean;
  /** Injectable for tests: the `gh auth status` checker. */
  gh?: GhChecker;
  /** Injectable for tests: probe, spawn, env, kill grace for spec runs. */
  specRun?: Partial<Pick<Parameters<typeof createSpecRunService>[0], 'probe' | 'spawnImpl' | 'env' | 'killGraceMs' | 'keepJobs'>>;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export function createReviewService(config: ReviewConfig, deps: ReviewServiceDeps) {
  const jiraClient: JiraClient = deps.jira;
  const { repoPath, baseBranch, remote, projectKey } = config;
  const baseRef = `${remote}/${baseBranch}`;
  // Exactly `AT-123`, `AT-123-...` or `AT-123/...`, case-sensitive (same rule as gitGuard).
  const branchPrefixRe = new RegExp(`^${projectKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+(?=$|[-/])`);

  // One merge at a time: two overlapping rebase+push runs would race on the
  // base branch.
  let lock: Promise<unknown> = Promise.resolve();
  const withLock = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = lock.then(fn, fn);
    lock = run.catch(() => undefined);
    return run;
  };

  /**
   * Review decisions made in this app, per ticket, for one exact commit. In memory only: Jira's Approval checkboxes cannot
   * be written by acli, so a decision is also recorded in the ticket's description (see acli.ts), which is what lasts.
   */
  const appDecisions = new Map<string, { decision: 'approved' | 'declined'; info: string; sha: string }>();

  /** The decision that applies to `sha`: this app's, else the one recorded in the description, else Jira's own Approval checkboxes. */
  function effectiveTicket(issue: JiraIssue, sha: string | null): ReviewTicketIssue {
    const { recorded, ...rest } = issue;
    const mine = appDecisions.get(issue.key) ?? null;
    let approval: 'approved' | 'declined' | null = issue.approval;
    let reviewInfo = issue.reviewInfo;
    let approvalSource: ApprovalSource = issue.approval ? 'field' : null;
    if (sha && mine && mine.sha === sha) {
      approval = mine.decision;
      reviewInfo = mine.info;
      approvalSource = 'app';
    } else if (sha && recorded && recorded.sha === sha) {
      approval = recorded.decision;
      reviewInfo = recorded.info;
      approvalSource = 'description';
    }
    const earlier = [mine, recorded].find((d) => d && sha && d.sha !== sha) ?? null;
    return { ...rest, approval, reviewInfo, approvalSource, staleDecision: approvalSource === 'app' || approvalSource === 'description' || !earlier ? null : { decision: earlier.decision, sha: earlier.sha } };
  }

  if (FORBIDDEN_BASE_BRANCHES.includes(baseBranch.toLowerCase())) {
    throw new Error(`"${baseBranch}" can never be the review merge target. Set REVIEW_BASE_BRANCH to the QA branch (e.g. playwright-main).`);
  }
  const assertAllowedGitCommand = createGitGuard({ remote, baseBranch, projectKey });

  // The ONLY way this module runs git: every command is checked first.
  const git = async (args: string[], cwd = repoPath, timeout?: number): Promise<ExecResult> => {
    assertAllowedGitCommand(args, cwd);
    return runGit(args, cwd, timeout);
  };
  const mustGit = async (args: string[], cwd: string, what: string, timeoutMs?: number): Promise<string> => {
    const r = await git(args, cwd, timeoutMs);
    if (r.code !== 0) throw new ReviewError(502, `${what} failed: ${firstLines(r.stderr || r.stdout)}`);
    return r.stdout;
  };

  async function remoteUrl(): Promise<string | null> {
    const r = await git(['remote', 'get-url', remote]);
    // A remote can carry a token in its URL's userinfo part; never expose it.
    return r.code === 0 ? stripUrlCredentials(r.stdout.trim()) : null;
  }

  const isInstalled = deps.findExecutable ?? ((bin: string) => findOnPath(bin));

  const ghChecker = deps.gh ?? createGhChecker({ findExecutable: isInstalled });
  const ghStatus = (): Promise<GhStatus> => ghChecker.check();

  async function status(): Promise<ReviewStatus> {
    const requirements: Requirement[] = [];
    const add = (r: Requirement) => requirements.push(r);

    const gitInstalled = isInstalled('git');
    add({
      id: 'git',
      label: 'Git',
      ok: gitInstalled,
      fix: gitInstalled ? '' : "Git isn't installed (or isn't on your PATH). Install it, then check again.",
      command: gitInstalled ? undefined : 'brew install git',
      url: gitInstalled ? undefined : 'https://git-scm.com/downloads',
    });

    {
      const acliInstalled = isInstalled('acli');
      add({
        id: 'acli',
        label: 'Atlassian CLI (acli)',
        ok: acliInstalled,
        fix: acliInstalled
          ? ''
          : "The Atlassian CLI isn't installed (or isn't on your PATH). This page uses it to read the Review column and move tickets to Done. Install it, run `acli auth login`, then check again.",
        command: acliInstalled ? undefined : 'brew tap atlassian/homebrew-acli && brew install acli',
        url: acliInstalled ? undefined : 'https://developer.atlassian.com/cloud/acli/guides/install-acli/',
      });
    }

    const repoFound = existsSync(join(repoPath, '.git'));
    add({
      id: 'repo',
      label: 'securicy-app checkout',
      ok: repoFound,
      fix: repoFound
        ? ''
        : `No git repository was found at ${repoPath}. Clone securicy-app there, or set REVIEW_REPO_PATH in your .env file to where it lives and restart \`npm run dev\`.`,
      command: repoFound ? undefined : `git clone git@github.com:carbidesecure/securicy-app.git ${shellQuote(repoPath)}`,
    });

    let url: string | null = null;
    if (gitInstalled && repoFound) {
      url = await remoteUrl();
      add({
        id: 'remote',
        label: `"${remote}" remote`,
        ok: !!url,
        fix: url ? '' : `The repository at ${repoPath} has no "${remote}" remote. Point it at GitHub with \`git remote add ${remote} <url>\`.`,
      });
    }

    const missing = requirements.filter((r) => !r.ok);
    return {
      ok: missing.length === 0,
      repoPath,
      baseBranch,
      remote,
      remoteUrl: url,
      repoWebUrl: toWebUrl(url),
      requirements,
      problems: missing.map((r) => r.fix),
    };
  }

  async function assertReady(): Promise<void> {
    const s = await status();
    if (!s.ok) throw new ReviewError(503, s.problems.join(' '));
  }

  async function fetchRemote(): Promise<void> {
    const r = await git(['fetch', '--prune', '--quiet', remote], repoPath, 120_000);
    if (r.code !== 0) throw new ReviewError(502, explainFetchFailure(r.stderr || r.stdout, repoPath, remote));
  }

  async function revParse(ref: string, cwd = repoPath): Promise<string | null> {
    const r = await git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], cwd);
    return r.code === 0 ? r.stdout.trim() : null;
  }

  async function requireBase(): Promise<string> {
    const sha = await revParse(baseRef);
    if (!sha) throw new ReviewError(503, `Base branch "${baseRef}" was not found. Check REVIEW_BASE_BRANCH in your .env file.`);
    return sha;
  }

  interface RebasePlan {
    /** What a rebase would replay, oldest first (merge commits are never replayed, and commits the base already has are skipped, exactly like `git rebase`). */
    run: Array<{ sha: string; parents: string[] }>;
    /** Commits the base has that the branch really lacks. */
    behind: number;
    /** The commit the oldest replayed commit sits on: what the branch was built on, and the start of its real changes. */
    parent: string | null;
    /** Older commits at the bottom of the branch that the base already has under other ids (its history was rewritten), left out of `run`. */
    skipped: SkippedCommit[];
  }

  /**
   * What `git rebase <base>` would do with a branch, worked out the way git does it: by the change each commit makes,
   * not by its id. Rebase-merging rewrites ids, so a branch cut from older work already on the base has dozens of
   * commits that only *look* new by id; those are skipped here exactly as the rebase skips them.
   *
   * Git can't tell when the base's copy of a commit was edited, squashed or re-based onto different context (its change
   * then differs), so a branch can also carry old commits of other tickets that the base already has. Those, and only
   * those at the very bottom of the branch, are skipped too: the same author and author date on a commit of the base (a
   * rewrite keeps both), or another ticket's key that the base already has commits for. The rebase then starts after
   * them (`rebase --onto`), so what is shown is exactly what is merged.
   */
  async function planRebase(branch: string, ref: string): Promise<RebasePlan> {
    const out = await mustGit(['log', '--left-right', '--cherry-pick', '--no-merges', '--topo-order', `--format=%m${SEP}%H${SEP}%P${SEP}%ae${SEP}%at${SEP}%s`, `${baseRef}...${ref}`], repoPath, 'git log');
    const right: Array<{ sha: string; parents: string[]; who: string; subject: string }> = [];
    const baseWho = new Set<string>();
    const baseKeys = new Set<string>();
    let behind = 0;
    for (const line of out.split('\n')) {
      if (!line.trim()) continue;
      const [mark, sha, parents, email, at, ...subject] = line.split(SEP);
      const subj = subject.join(SEP);
      if (mark === '<') {
        behind++;
        baseWho.add(`${email}|${at}|${subj}`);
        const k = anyKeySubject.exec(subj);
        if (k) baseKeys.add(k[0].toUpperCase());
      } else if (mark === '>') right.push({ sha, parents: (parents ?? '').split(' ').filter(Boolean), who: `${email}|${at}|${subj}`, subject: subj });
    }
    const all = right.reverse(); // oldest first
    const own = keyOf(branch);
    const skipReason = (c: { who: string; subject: string }): SkippedCommit['reason'] | null => {
      const key = anyKeySubject.exec(c.subject)?.[0].toUpperCase() ?? null;
      return baseWho.has(c.who) ? 'same-commit' : key && key !== own && baseKeys.has(key) ? 'ticket-in-base' : null;
    };
    const byId = new Map(all.map((c) => [c.sha, c]));

    // The branch's own commits are the ones on top: walk down from the tip until reaching a commit the base already has
    // (same change, or one of the skipped kinds above). Everything from there down is older history.
    const top: typeof all = [];
    let cur: string | null = ref;
    while (cur) {
      const c = byId.get(cur);
      if (!c || skipReason(c)) break;
      top.push(c);
      cur = c.parents[0] ?? null;
    }
    const inTop = new Set(top.map((c) => c.sha));
    const below = all.filter((c) => !inTop.has(c.sha));
    // Safe only if every older commit really is one the base has. A new commit hidden underneath would be silently lost,
    // so in that case nothing is skipped: the whole branch is shown (and rebased) as before.
    if (below.length > 0 && below.every((c) => skipReason(c))) {
      const run = top.reverse().map((c) => ({ sha: c.sha, parents: c.parents }));
      const skipped = below.map((c) => ({ sha: c.sha, subject: c.subject, reason: skipReason(c)!, key: anyKeySubject.exec(c.subject)?.[0].toUpperCase() ?? null }));
      return { run, behind, parent: run.length > 0 ? cur : null, skipped };
    }
    const run = all.map((c) => ({ sha: c.sha, parents: c.parents }));
    return { run, behind, parent: run.length > 0 ? (run[0].parents[0] ?? null) : null, skipped: [] };
  }

  async function branchInfo(name: string, sha: string, author: string, date: string): Promise<BranchInfo> {
    const plan = await planRebase(name, sha);
    // the changes the replayed commits make, not everything between the branch and an old common ancestor
    const stat = plan.run.length === 0 ? null : await git(['diff', '--shortstat', plan.parent ? `${plan.parent}...${sha}` : `${baseRef}...${sha}`]);
    return { name, sha, author, date, ...(stat ? parseShortStat(stat.stdout) : { files: 0, additions: 0, deletions: 0 }), ahead: plan.run.length, behind: plan.behind, unmerged: plan.run.length };
  }

  async function remoteBranches(): Promise<Array<{ name: string; sha: string; author: string; date: string; subject: string }>> {
    const SEP = '\x1f';
    const out = await mustGit(
      [
        'for-each-ref',
        `--format=%(refname:strip=3)${SEP}%(objectname)${SEP}%(authorname)${SEP}%(committerdate:iso-strict)${SEP}%(subject)`,
        `refs/remotes/${remote}/`,
      ],
      repoPath,
      'git for-each-ref',
    );
    return out
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [name, sha, author, date, subject] = l.split(SEP);
        return { name, sha, author, date, subject };
      })
      .filter((b) => b.name !== 'HEAD' && branchPrefixRe.test(b.name));
  }

  async function list(): Promise<ReviewList> {
    await assertReady();
    await fetchRemote();
    const baseSha = await requireBase();
    const branches = await remoteBranches();
    const url = toWebUrl(await remoteUrl());

    // ONLY tickets that Jira says are in the AT Review column are ever shown.
    // If Jira can't be read there is nothing to show — never fall back to
    // listing branches, since a branch alone says nothing about the board.
    let jiraError: string | null = null;
    let jiraErrorKind: AcliErrorKind | null = null;
    let tickets: ReviewTicket[] = [];
    try {
      const issues = await jiraClient.listReviewIssues();
      tickets = await mapLimit(issues, 6, async (issue) => {
        const matching = branches.filter((b) => branchMatchesKey(b.name, issue.key));
        const infos = await Promise.all(matching.map((b) => branchInfo(b.name, b.sha, b.author, b.date)));
        return { ...effectiveTicket(issue, infos[0]?.sha ?? null), branches: infos };
      });
    } catch (err) {
      jiraError = err instanceof Error ? err.message : String(err);
      jiraErrorKind = err instanceof AcliError ? err.kind : 'failed';
    }

    return {
      baseBranch,
      baseSha,
      repoWebUrl: url,
      jira: { error: jiraError, errorKind: jiraErrorKind },
      tickets,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * The Jira ticket behind a branch, but only if it is in the Review column
   * right now. Used before showing a diff and again before merging.
   */
  async function requireReviewTicket(branch: string): Promise<JiraIssue> {
    const key = branchPrefixRe.exec(branch)![0];
    try {
      const issue = await jiraClient.findReviewIssue(key);
      if (!issue) {
        throw new ReviewError(404, `${key} isn't in the Review column of the ${projectKey} board, so it can't be reviewed or merged here.`);
      }
      return issue;
    } catch (err) {
      if (err instanceof AcliError && err.kind !== 'blocked') throw new ReviewError(err.kind === 'failed' ? 502 : 503, err.message);
      throw err;
    }
  }

  function assertReviewable(branch: unknown): asserts branch is string {
    if (!isSafeBranchName(branch)) throw new ReviewError(400, 'Invalid branch name.');
    if (!branchPrefixRe.test(branch)) {
      throw new ReviewError(400, `Only ${projectKey}-### ticket branches can be reviewed here.`);
    }
  }

  // ---------------------------------------------------------------------------
  // Methods. "rebase" (the default) replays the whole branch onto the base branch. "cherry-pick" replays
  // only the commits at the tip of the branch whose subject starts with the ticket key, for branches cut
  // from another branch (e.g. release-next) whose other commits must never reach the base. Either way
  // the result is a straight line of ordinary commits on top of the base tip, and the base branch is only
  // ever fast-forwarded to it. A merge commit is never created.
  // ---------------------------------------------------------------------------

  const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keyOf = (branch: string): string => branchPrefixRe.exec(branch)![0].toUpperCase();
  /** Any commit that carries a ticket key ("AT-123 Add specs"), not just this branch's own. */
  const anyKeySubject = new RegExp(`^${escapeRe(projectKey)}-\\d+(?![0-9A-Za-z])`);

  function parseMethod(value: unknown): MergeMethod {
    if (value === undefined || value === null || value === 'rebase') return 'rebase';
    if (value === 'cherry-pick') return 'cherry-pick';
    throw new ReviewError(400, 'method must be "rebase" or "cherry-pick".');
  }

  const SEP = '\x1f';
  const REC = '\x1e';
  const LOG_FORMAT = `%H${SEP}%an${SEP}%aI${SEP}%s${SEP}%b${REC}`;

  const parseCommits = (out: string): ReviewCommit[] =>
    out
      .split(REC)
      .map((r) => r.replace(/^\n/, ''))
      .filter((r) => r.trim())
      .map((r) => {
        const [csha, author, date, subject, body] = r.split(SEP);
        return { sha: csha, author, date, subject, body: (body ?? '').trim() };
      });

  interface PickPlan {
    info: PickInfo;
    /** Everything found at the tip, oldest first (what the review shows). */
    run: ReviewCommit[];
    /** The commit the oldest one sits on. */
    parent: string | null;
  }

  /**
   * Finds what a cherry-pick would take: walking back from the tip of the branch (first parents only),
   * the unbroken run of commits whose subject starts with the ticket key ("AT-727 ..."). It stops at the first
   * commit that doesn't, so a branch cut from release-next brings only the QA commits and none of release-next.
   * A merge commit is never picked. Derived from the exact commit `sha`, never from a moving branch name.
   */
  async function planPicks(branch: string, sha: string): Promise<PickPlan> {
    const key = keyOf(branch);
    const prefix = new RegExp(`^${escapeRe(key)}(?![0-9A-Za-z])`);
    const out = await mustGit(['log', '--first-parent', `--max-count=${MAX_PICK_SCAN}`, `--format=%H${SEP}%P${SEP}%an${SEP}%aI${SEP}%s${SEP}%b${REC}`, sha], repoPath, 'git log');
    const rows = out
      .split(REC)
      .map((r) => r.replace(/^\n/, ''))
      .filter((r) => r.trim())
      .map((r) => {
        const [h, p, author, date, subject, body] = r.split(SEP);
        return { sha: h, parents: (p ?? '').split(' ').filter(Boolean), author, date, subject: subject ?? '', body: (body ?? '').trim() };
      });

    const run: typeof rows = [];
    let reason: string | null = null;
    for (const row of rows) {
      if (row.parents.length !== 1) {
        if (run.length === 0) reason = row.parents.length > 1 ? 'The latest commit on this branch is a merge commit, and merge commits are never cherry-picked.' : 'This branch has no earlier history to cherry-pick from.';
        break;
      }
      if (!prefix.test(row.subject)) break;
      run.push(row);
    }
    if (run.length === 0 && !reason) {
      reason = `None of the latest commits on this branch start with ${key}, so there is nothing to cherry-pick. Commits are matched on their message, like "${key} Add tests for ...".`;
    }
    if (run.length > 0 && run.length === rows.length && rows.length >= MAX_PICK_SCAN) {
      reason = `All of the latest ${MAX_PICK_SCAN} commits start with ${key}, so it isn't clear where this ticket's commits begin.`;
      run.length = 0;
    }
    if (run.length > MAX_PICKS) {
      reason = `${run.length} commits in a row start with ${key}; at most ${MAX_PICKS} can be cherry-picked at once.`;
      run.length = 0;
    }

    const ordered: ReviewCommit[] = run.slice().reverse().map((r) => ({ sha: r.sha, author: r.author, date: r.date, subject: r.subject, body: r.body }));
    const parent = run.length > 0 ? run[run.length - 1].parents[0] : null;
    let picks = ordered;
    let alreadyApplied = 0;
    if (ordered.length > 0 && parent) {
      // commits the base branch already has (same change, different id) are skipped rather than applied twice
      const cherry = await git(['cherry', baseRef, ordered[ordered.length - 1].sha, parent]);
      if (cherry.code === 0) {
        const have = new Set(cherry.stdout.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim()));
        picks = ordered.filter((c) => !have.has(c.sha));
        alreadyApplied = ordered.length - picks.length;
        if (picks.length === 0) reason = `Everything the ${key} commits change is already in ${baseBranch}.`;
      }
    }
    return { run: ordered, parent, info: { available: picks.length > 0 && reason === null, commits: picks, alreadyApplied, reason, prefix: key } };
  }

  /** The diff a reviewer reads: only what would be applied (the replayed commits' changes), never history the base already has. */
  async function reviewDiff(method: MergeMethod, sha: string, plans: { rebase: RebasePlan; pick: PickPlan }): Promise<string> {
    const raw = ['diff', '-M', '--no-color', '--no-ext-diff', '--no-textconv'];
    if (method === 'cherry-pick') {
      const { pick } = plans;
      if (!pick.parent || pick.run.length === 0) return '';
      return mustGit([...raw, `${pick.parent}...${pick.run[pick.run.length - 1].sha}`], repoPath, 'git diff');
    }
    const { rebase } = plans;
    if (rebase.run.length === 0) return '';
    return mustGit([...raw, rebase.parent ? `${rebase.parent}...${sha}` : `${baseRef}...${sha}`], repoPath, 'git diff');
  }

  const noPicks: PickPlan = { run: [], parent: null, info: { available: false, commits: [], alreadyApplied: 0, reason: null, prefix: '' } };
  const noRebase: RebasePlan = { run: [], behind: 0, parent: null, skipped: [] };

  /** The files a PR changes for the given method (what a rebase would replay, or just the cherry-picked commits). */
  async function changedFilesFor(branch: string, sha: string, method: MergeMethod): Promise<Array<{ path: string; status: ReviewFile['status'] }>> {
    const plans = method === 'cherry-pick' ? { rebase: noRebase, pick: await planPicks(branch, sha) } : { rebase: await planRebase(branch, sha), pick: noPicks };
    return parseDiff(await reviewDiff(method, sha, plans)).map((f) => ({ path: f.path, status: f.status }));
  }

  async function detail(branch: unknown, methodArg?: unknown): Promise<ReviewDetail> {
    assertReviewable(branch);
    const method = parseMethod(methodArg);
    await assertReady();
    const baseSha = await requireBase();
    const sha = await revParse(`${remote}/${branch}`);
    if (!sha) throw new ReviewError(404, `Branch "${branch}" was not found on ${remote}. Try refreshing.`);
    const ticket = effectiveTicket(await requireReviewTicket(branch), sha);
    const plan = method === 'cherry-pick' ? await planPicks(branch, sha) : noPicks;
    const rebasePlan = method === 'rebase' ? await planRebase(branch, sha) : noRebase;

    let commits: ReviewCommit[];
    let ahead: number;
    let behind: number;
    let unmerged: number;
    let diff: string;
    let mt: ExecResult | null;
    let mergeCommits = 0;
    let commitsTruncated = false;
    let url: string | null;

    if (method === 'rebase') {
      const parent = rebasePlan.parent;
      const tip = sha;
      const replayed = new Set(rebasePlan.run.map((r) => r.sha));
      const [log, d, merge, merges, remoteWeb] = await Promise.all([
        // the commits between what the branch was built on and its tip, then narrowed to the ones that would really be replayed
        rebasePlan.run.length === 0 ? Promise.resolve('') : mustGit(['log', '--reverse', '--max-count=200', `--format=${LOG_FORMAT}`, parent ? `${parent}..${tip}` : `${baseRef}..${tip}`], repoPath, 'git log'),
        reviewDiff(method, sha, { rebase: rebasePlan, pick: plan }),
        rebasePlan.run.length === 0
          ? Promise.resolve<ExecResult | null>(null)
          : parent
            ? // apply just those commits' changes onto the base, which is what the rebase does
              git(['merge-tree', '--write-tree', '--name-only', '--no-messages', `--merge-base=${parent}`, baseRef, tip])
            : git(['merge-tree', '--write-tree', '--name-only', '--no-messages', baseRef, `${remote}/${branch}`]),
        parent && rebasePlan.run.length > 0 ? git(['rev-list', '--merges', '--count', `${parent}..${tip}`]) : Promise.resolve<ExecResult | null>(null),
        remoteUrl(),
      ]);
      commits = parseCommits(log).filter((c) => replayed.has(c.sha));
      commitsTruncated = commits.length < rebasePlan.run.length;
      ahead = rebasePlan.run.length;
      behind = rebasePlan.behind;
      unmerged = rebasePlan.run.length;
      diff = d;
      mt = rebasePlan.run.length === 0 ? { code: 0, stdout: '', stderr: '' } : merge;
      mergeCommits = merges && merges.code === 0 ? Number(merges.stdout.trim()) || 0 : 0;
      url = remoteWeb;
    } else {
      commits = plan.info.commits;
      ahead = plan.info.commits.length;
      behind = 0;
      unmerged = plan.info.commits.length;
      const newest = plan.run.length > 0 ? plan.run[plan.run.length - 1].sha : null;
      const [d, merge, remoteWeb] = await Promise.all([
        reviewDiff(method, sha, { rebase: noRebase, pick: plan }),
        newest && plan.parent ? git(['merge-tree', '--write-tree', '--name-only', '--no-messages', `--merge-base=${plan.parent}`, baseRef, newest]) : Promise.resolve(null),
        remoteUrl(),
      ]);
      diff = d;
      mt = merge;
      url = remoteWeb;
    }

    const files = parseDiff(diff);
    const changed = files.map((f) => ({ path: f.path, status: f.status }));
    const specs = changed.filter((f) => f.status !== 'deleted' && isRunnableSpecPath(f.path)).map((f) => f.path);
    const serverCodeChanged = planOverlay(changed).serverCodeChanged;
    const supportFiles = changed.filter((f) => f.status !== 'deleted' && f.path.startsWith('spec/') && !isRunnableSpecPath(f.path)).map((f) => f.path);

    let canRebase: boolean | null = null;
    let conflicts: string[] = [];
    if (mt && mt.code === 0) canRebase = true;
    else if (mt && mt.code === 1) {
      canRebase = false;
      // First line is the (conflicted) tree id; the rest are file names.
      conflicts = mt.stdout.split('\n').slice(1).map((l) => l.trim()).filter(Boolean);
    }

    const web = toWebUrl(url);
    return {
      method,
      mergeCommits,
      alreadyInBase: method === 'rebase' ? rebasePlan.skipped : [],
      nonAtCommits: method === 'rebase' ? commits.filter((c) => !anyKeySubject.test(c.subject)).length : 0,
      commitsTruncated,
      pick: plan.info,
      specGate: specRun.gate(branch, sha, method, specs),
      branch,
      ticket,
      sha,
      baseBranch,
      baseSha,
      ahead,
      behind,
      unmerged,
      canRebase,
      conflicts,
      commits,
      files,
      specs,
      serverCodeChanged,
      supportFiles,
      totals: {
        additions: files.reduce((n, f) => n + f.additions, 0),
        deletions: files.reduce((n, f) => n + f.deletions, 0),
      },
      branchUrl: web ? `${web}/tree/${branch}` : null,
    };
  }

  // Branches that have a merge queued or running. A second request for the same branch (a double
  // click, a second tab, a page reload while it runs) is refused straight away instead of queueing up
  // behind the first one and failing confusingly once that one has deleted the branch.
  const mergesInProgress = new Set<string>();

  interface ReplayContext {
    method: MergeMethod;
    branch: string;
    /** The exact commit that was reviewed. */
    sha: string;
    /** For a cherry-pick: the commits to apply, oldest first. */
    picks: string[];
    /** For a rebase: the last old commit the base already has; only what comes after it is replayed. */
    after?: string | null;
  }

  type ReplayOutcome = { kind: 'done' } | { kind: 'conflict'; files: string[] };

  const changedSince = (branch: string) => `"${branch}" changed since you opened it. Refresh and review the new commits before merging.`;

  /** Checks out the starting point in `dir` and replays the commits onto the base branch, stopping (not undoing) at a conflict. */
  async function startReplay(dir: string, c: ReplayContext): Promise<ReplayOutcome> {
    if (c.method === 'rebase') {
      await mustGit(['worktree', 'add', '--detach', '--quiet', dir, `${remote}/${c.branch}`], repoPath, 'Creating a temporary worktree');
      // Exactly the commit that was reviewed, even if a fetch (the page's refresh, a spec run) moved the branch meanwhile.
      const head = (await mustGit(['rev-parse', 'HEAD'], dir, 'git rev-parse')).trim();
      if (head !== c.sha) throw new ReviewError(409, changedSince(c.branch));
      // Start after the old commits the base already has (see planRebase), so only the branch's own are replayed.
      const r = await git(c.after ? ['rebase', '--onto', baseRef, c.after] : ['rebase', baseRef], dir, 120_000);
      return r.code === 0 ? { kind: 'done' } : conflictOrFailure(dir, r, `Rebasing "${c.branch}" onto ${baseBranch}`);
    }
    await mustGit(['worktree', 'add', '--detach', '--quiet', dir, baseRef], repoPath, 'Creating a temporary worktree');
    const r = await git(['cherry-pick', ...c.picks], dir, 120_000);
    return r.code === 0 ? { kind: 'done' } : conflictOrFailure(dir, r, `Cherry-picking the ${keyOf(c.branch)} commits onto ${baseBranch}`);
  }

  async function conflictOrFailure(dir: string, r: ExecResult, what: string): Promise<ReplayOutcome> {
    const unmerged = await git(['diff', '--name-only', '--diff-filter=U'], dir);
    const files = unmerged.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
    if (files.length > 0) return { kind: 'conflict', files };
    throw new ReviewError(409, `${what} failed: ${firstLines(r.stderr || r.stdout)}`);
  }

  async function abortReplay(dir: string, method: MergeMethod): Promise<void> {
    await git(method === 'rebase' ? ['rebase', '--abort'] : ['cherry-pick', '--abort'], dir);
  }

  interface PublishContext {
    method: MergeMethod;
    branch: string;
    sha: string;
    moveToDone: boolean;
  }

  /**
   * Everything after the commits have been replayed in `dir`: prove the result is a straight line on top of the
   * base tip, fast-forward the base branch to it, delete the AT branch, and move the Jira ticket.
   */
  async function publishReplay(dir: string, c: PublishContext): Promise<MergeResult> {
    const { branch, sha } = c;
    const newHead = (await mustGit(['rev-parse', 'HEAD'], dir, 'git rev-parse')).trim();
    const merged = Number((await mustGit(['rev-list', '--count', `${baseRef}..HEAD`], dir, 'git rev-list')).trim());
    if (!merged) {
      throw new ReviewError(409, `Nothing to merge: ${c.method === 'rebase' ? 'rebasing' : 'cherry-picking'} "${branch}" onto ${baseBranch} left no new commits.`);
    }

    // NEVER a merge commit. What we push must be a straight line of ordinary
    // commits sitting directly on the base tip, so moving the base branch to it
    // is a fast-forward (exactly what `git merge` does after a manual rebase).
    // A plain `git rebase` or `git cherry-pick` always gives that; this is the
    // last line of defence in case git's configuration or a tool ever changes
    // that, and nothing has been pushed yet if it trips.
    const onTop = await git(['merge-base', '--is-ancestor', baseRef, 'HEAD'], dir);
    const mergeCommits = Number((await mustGit(['rev-list', '--merges', '--count', `${baseRef}..HEAD`], dir, 'git rev-list')).trim());
    if (onTop.code !== 0 || mergeCommits > 0) {
      throw new ReviewError(
        409,
        `Refusing to merge "${branch}": after ${c.method === 'rebase' ? 'rebasing' : 'cherry-picking'} it onto ${baseBranch} the result is not a straight line of commits ` +
          `${mergeCommits > 0 ? `(it contains ${mergeCommits} merge commit${mergeCommits === 1 ? '' : 's'})` : '(it does not sit on top of the latest commit)'}. ` +
          `Merge commits are never created here, and nothing was pushed. Rebase the branch locally onto ${baseBranch}, push it, then try again.`,
      );
    }

    // Plain (non-force) push: only succeeds as a fast-forward, so if
    // someone else landed on the base branch since our fetch it's
    // rejected rather than overwritten.
    const push = await git(['push', remote, `${newHead}:refs/heads/${baseBranch}`], dir, 120_000);
    if (push.code !== 0) {
      const msg = `${push.stderr}${push.stdout}`;
      if (/non-fast-forward|fetch first|rejected/i.test(msg) && !/protected branch|GH006|hook declined/i.test(msg)) {
        throw new ReviewError(409, `${baseBranch} moved while merging. Nothing was pushed — click Rebase and merge again.`);
      }
      throw new ReviewError(502, `Pushing to ${baseBranch} failed: ${firstLines(msg)}`);
    }

    // The merge is done. Delete the ticket branch (AT-### only — the guard
    // enforces that) but only if origin still has the commit we reviewed.
    let branchDeleted = false;
    let ticketMoved: string | null = null;
    const warnings: string[] = [];
    const del = await git(['push', remote, `--force-with-lease=refs/heads/${branch}:${sha}`, '--delete', branch], dir, 120_000);
    if (del.code === 0) branchDeleted = true;
    else warnings.push(`Merged, but couldn't delete the branch ${branch}: ${firstLines(del.stderr || del.stdout, 2)}`);

    // Only after the push has succeeded. A Jira failure never undoes the
    // merge; it's reported so the ticket can be moved by hand.
    if (c.moveToDone) {
      const key = keyOf(branch);
      try {
        await jiraClient.moveReviewIssueToDone(key);
        ticketMoved = key;
      } catch (err) {
        warnings.push(`Merged, but ${err instanceof AcliError ? err.message : `could not move ${key} in Jira.`}`);
      }
    }

    // Refresh our remote-tracking refs so the next list is accurate.
    await git(['fetch', '--prune', '--quiet', remote], repoPath, 120_000);

    return { method: c.method, merged, baseBranch, newBaseSha: newHead, branchDeleted, ticketMoved, warning: warnings.join(' ') || null };
  }

  async function cleanupWorktree(dir: string): Promise<void> {
    await git(['worktree', 'remove', '--force', dir]);
    await rm(dir, { recursive: true, force: true });
    await git(['worktree', 'prune']);
  }

  const conflictsMessage = (c: ReplayContext) =>
    c.method === 'rebase'
      ? `Rebasing "${c.branch}" onto ${baseBranch} hit conflicts. Resolve them here, or rebase the branch locally, push it, then try again.`
      : `Cherry-picking the ${keyOf(c.branch)} commits onto ${baseBranch} hit conflicts. Resolve them here, or fix the branch locally, push it, then try again.`;

  function merge(opts: { branch: unknown; expectedSha?: unknown; moveToDone?: unknown; method?: unknown }): Promise<MergeResult> {
    const requested = typeof opts.branch === 'string' ? opts.branch : null;
    if (requested !== null && mergesInProgress.has(requested)) {
      return Promise.reject(new ReviewError(409, `"${requested}" is already being merged. Wait for that to finish; there is no need to click again.`));
    }
    if (requested !== null) mergesInProgress.add(requested);
    return mergeLocked(opts).finally(() => {
      if (requested !== null) mergesInProgress.delete(requested);
    });
  }

  function mergeLocked(opts: { branch: unknown; expectedSha?: unknown; moveToDone?: unknown; method?: unknown }): Promise<MergeResult> {
    return withLock(async () => {
      const { branch } = opts;
      assertReviewable(branch);
      const method = parseMethod(opts.method);
      if (typeof opts.expectedSha !== 'string' || !/^[0-9a-f]{7,64}$/i.test(opts.expectedSha)) {
        throw new ReviewError(400, 'expectedSha is required so the merge only applies what was reviewed.');
      }
      if (specRun.busy()) throw new ReviewError(409, 'Specs are running. Wait for them to finish (or cancel them) before merging.');
      await assertReady();
      // The ticket must be in the Review column right now, checked before anything is fetched, rebased or pushed.
      const reviewTicket = await requireReviewTicket(branch);
      await fetchRemote();
      await requireBase();

      const sha = await revParse(`${remote}/${branch}`);
      if (!sha) throw new ReviewError(404, `Branch "${branch}" was not found on ${remote}.`);
      if (!sha.startsWith(opts.expectedSha.toLowerCase())) throw new ReviewError(409, changedSince(branch));

      // ...and approved for THIS commit (a decision made for an earlier one of this branch no longer counts).
      const decided = effectiveTicket(reviewTicket, sha);
      if (decided.approval !== 'approved') {
        throw new ReviewError(
          409,
          decided.approval === 'declined'
            ? `${decided.key} has changes requested, so it can't be merged. Approve it once they have been addressed.`
            : decided.staleDecision
              ? `${decided.key} was ${decided.staleDecision.decision === 'approved' ? 'approved' : 'sent back for changes'} for an earlier commit, and "${branch}" has changed since. Review the new commits and approve again before merging.`
              : `${decided.key} hasn't been approved yet. Approve it before merging.`,
        );
      }

      let picks: string[] = [];
      let after: string | null = null;
      if (method === 'rebase') {
        const plan = await planRebase(branch, sha);
        after = plan.skipped.length > 0 ? plan.parent : null;
        if (plan.run.length === 0) {
          throw new ReviewError(409, `Nothing to merge: "${branch}" has no changes that ${baseBranch} doesn't already have.`);
        }
        // A merge commit among the commits being replayed is flattened by a rebase, and anything that exists only inside it
        // (a fix made while merging the base into the branch) would silently be lost. Never rebase one. Merges in older
        // history the base already has by change are not part of this.
        const merges = plan.parent ? await git(['rev-list', '--merges', '--count', `${plan.parent}..${sha}`]) : null;
        const inside = merges && merges.code === 0 ? Number(merges.stdout.trim()) || 0 : 0;
        if (inside > 0) {
          throw new ReviewError(
            409,
            `"${branch}" contains ${inside} merge commit${inside === 1 ? '' : 's'} (someone merged ${baseBranch} or another branch into it). ` +
              `A rebase would flatten ${inside === 1 ? 'it' : 'them'} and could silently drop what only ${inside === 1 ? 'it contains' : 'they contain'}, and merge commits are never wanted here. ` +
              `Rebase the branch locally onto ${baseBranch}, push it, then try again.`,
            undefined,
            'merge-commits',
          );
        }
      } else {
        const plan = await planPicks(branch, sha);
        if (!plan.info.available) throw new ReviewError(409, plan.info.reason ?? 'There is nothing to cherry-pick on this branch.', undefined, 'no-picks');
        picks = plan.info.commits.map((c) => c.sha);
      }

      const replay: ReplayContext = { method, branch, sha, picks, after };
      const dir = await mkdtemp(TEMP_WORKTREE_PREFIX);
      try {
        const outcome = await startReplay(dir, replay);
        if (outcome.kind === 'conflict') {
          await abortReplay(dir, method);
          throw new ReviewError(409, conflictsMessage(replay), outcome.files, 'conflicts');
        }
        return await publishReplay(dir, { method, branch, sha, moveToDone: opts.moveToDone === true });
      } finally {
        await cleanupWorktree(dir);
      }
    });
  }

  /** Approve or decline the PR: ticks Approved/Declined on the AT ticket and records the review notes. */
  async function submitReview(opts: { branch?: unknown; expectedSha?: unknown; decision?: unknown; info?: unknown }): Promise<ReviewTicketIssue & { jiraRecorded: boolean; jiraNote: string | null }> {
    assertReviewable(opts.branch);
    const branch = opts.branch;
    if (typeof opts.expectedSha !== 'string' || !/^[0-9a-f]{7,64}$/i.test(opts.expectedSha)) {
      throw new ReviewError(400, 'expectedSha is required so the decision applies to the commits you reviewed.');
    }
    if (opts.decision !== 'approved' && opts.decision !== 'declined' && opts.decision !== 'none') {
      throw new ReviewError(400, 'decision must be "approved", "declined" or "none".');
    }
    if (opts.info !== undefined && typeof opts.info !== 'string') throw new ReviewError(400, 'Review information must be text.');
    const info = typeof opts.info === 'string' ? opts.info.trim() : undefined;
    if (info !== undefined && info.length > MAX_REVIEW_INFO_CHARS) {
      throw new ReviewError(400, `Review information is limited to ${MAX_REVIEW_INFO_CHARS} characters (it is ${info.length}).`);
    }
    if (opts.decision === 'declined' && !info) throw new ReviewError(400, 'Say what needs to change: add a note for the author.');

    await assertReady();
    const sha = await revParse(`${remote}/${branch}`);
    if (!sha) throw new ReviewError(404, `Branch "${branch}" was not found on ${remote}. Refresh and try again.`);
    if (!sha.startsWith(opts.expectedSha.toLowerCase())) {
      throw new ReviewError(409, `"${branch}" changed since you opened it. Reload the pull request and review the new commits before deciding.`);
    }
    const ticket = await requireReviewTicket(branch);


    // Nothing is approved until every spec in this PR has passed for this exact commit. Passes for another PR, or for an
    // earlier commit of this one, are never counted: the record is keyed by branch and commit.
    if (opts.decision === 'approved') {
      const required = (await changedFilesFor(branch, sha, 'rebase')).filter((f) => f.status !== 'deleted' && isRunnableSpecPath(f.path)).map((f) => f.path);
      const gate = specRun.gate(branch, sha, 'rebase', required);
      if (!gate.satisfied) {
        const missing = required.filter((file) => !gate.progress.some((p) => p.file === file && p.status !== 'failed'));
        const failed = gate.progress.filter((p) => p.status === 'failed').map((p) => p.file);
        throw new ReviewError(
          409,
          `Every spec in this PR has to pass before it can be approved: ${required.length - missing.length} of ${required.length} have passed for this commit. ` +
            (failed.length > 0 ? `${failed.length} failed. ` : '') +
            (missing.length > 0 ? `Run ${missing.length === required.length ? 'them' : `the ${missing.length} that ${failed.length > 0 ? 'have not passed' : 'have not been run'}`} (Run all) and try again.` : 'Run them again once they are fixed.'),
          missing,
          'specs-not-passed',
        );
      }
    }

    // The decision applies to this exact commit. It is kept here so it always works, and written into the ticket's
    // description so it lasts. If Jira can't take it (acli failed, or the description has images) it still stands here.
    const decision = opts.decision;
    let latest = ticket;
    let jiraRecorded = false;
    let jiraNote: string | null = null;
    if (decision === 'none') appDecisions.delete(ticket.key);
    else appDecisions.set(ticket.key, { decision, info: info ?? '', sha });
    try {
      latest = await jiraClient.recordReview(ticket.key, decision, info, sha);
      jiraRecorded = true;
    } catch (err) {
      if (!(err instanceof AcliError) || err.kind === 'blocked') throw err;
      jiraNote = err.message;
    }
    return { ...effectiveTicket(latest, sha), jiraRecorded, jiraNote };
  }

  /** Where the approval gate stands for a branch's current commit (read-only; the page asks after each spec run). */
  async function specGateFor(branch: unknown): Promise<SpecGate & { sha: string }> {
    assertReviewable(branch);
    await assertReady();
    const sha = await revParse(`${remote}/${branch}`);
    if (!sha) throw new ReviewError(404, `Branch "${branch}" was not found on ${remote}. Try refreshing.`);
    const required = (await changedFilesFor(branch, sha, 'rebase')).filter((f) => f.status !== 'deleted' && isRunnableSpecPath(f.path)).map((f) => f.path);
    return { ...specRun.gate(branch, sha, 'rebase', required), sha };
  }

  const specRun = createSpecRunService({
    repoPath,
    serverRoot: config.serverRepoPath ?? repoPath,
    testServerPort: config.testServerPort,
    assertReviewable,
    assertReady,
    requireReviewTicket,
    fetchRemote,
    resolveBranch: (branch) => revParse(`${remote}/${branch}`),
    changedFiles: changedFilesFor,
    isMergeBusy: () => mergesInProgress.size > 0,
    addWorktree: async (branch, dir, sha) => {
      await mustGit(['worktree', 'add', '--detach', '--quiet', dir, `${remote}/${branch}`], repoPath, 'Creating a temporary checkout of the PR');
      // Exactly the commit that was reviewed, even if a fetch moved the branch meanwhile.
      const head = (await mustGit(['rev-parse', 'HEAD'], dir, 'git rev-parse')).trim();
      if (head !== sha) throw new ReviewError(409, changedSince(branch));
    },
    removeWorktree: async (dir) => {
      await git(['worktree', 'remove', '--force', dir]);
      await git(['worktree', 'prune']);
    },
    ...deps.specRun,
  });

  return {
    status,
    list,
    detail,
    merge,
    ghStatus,
    submitReview,
    specGate: specGateFor,
    testServer: specRun.testServer,
    startSpecRun: specRun.start,
    getSpecRun: specRun.get,
    cancelSpecRun: specRun.cancel,
    shutdown: specRun.shutdown,
  };
}

export type ReviewService = ReturnType<typeof createReviewService>;
