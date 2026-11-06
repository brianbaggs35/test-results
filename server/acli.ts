import { execFile } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { redactSecrets } from './redact.ts';

/**
 * The ONLY place this app talks to Jira, via the already-authenticated
 * Atlassian CLI (`acli`).
 *
 * GUARD RAIL — the QA team's rule: nothing outside the AT project is ever
 * touched, and the only things this code may do are:
 *
 *   1. READ which AT work items are in the review column
 *        acli jira workitem search  (project = "AT" AND status = "Review")
 *   2. READ one AT work item (its summary, status, assignee and Reviewer)
 *        acli jira workitem view AT-### --fields key,summary,status,assignee,customfield_10550 --json
 *      That read includes the AT board's Approval checkboxes and Review Information text (so a decision
 *      ticked in Jira by hand is honoured) and the ticket's description.
 *   2b. RECORD A REVIEW on one AT work item that is in the review column, in its DESCRIPTION
 *        acli jira workitem edit --from-json <private temp file> --yes
 *      The Approval checkboxes themselves cannot be written from here: acli's edit command only takes
 *      assignee, description, labels, summary and type (a custom field fails with `unknown field
 *      "customfield_..."`; Atlassian tracks this as CLOUD-12876). So the decision is written as a
 *      self-contained panel APPENDED to the end of the description. What is already there is never changed
 *      or removed: every decision adds a panel (a history, the newest counts), and withdrawing one adds a
 *      "Withdrawn" panel. The guard reads the file and accepts only {issues: [one AT key], description: <ADF document>}.
 *   3. MOVE one AT work item that is currently in the review column to done
 *        acli jira workitem transition --key AT-### --status Done --yes
 *      (the caller only does this after the branch was rebased and merged)
 *
 * It is enforced at the lowest layer: every argv handed to `acli` passes
 * `assertAllowedAcliCommand`, which accepts exactly those four shapes and
 * nothing else — no other subcommand, no other project, no multiple keys, no
 * free-form JQL, no other target status. Anything else throws before a
 * process is spawned. Do not loosen this; see server/acli.test.ts.
 */

/** The one Jira project this app may read or change. */
export const ALLOWED_PROJECT = 'AT';
/** The only statuses a ticket may be moved to. */
const ALLOWED_DONE_STATUSES = ['Done', 'Completed'] as const;

export interface AcliResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type AcliRunner = (args: string[]) => Promise<AcliResult>;

const defaultAcliRunner: AcliRunner = (args) =>
  new Promise((resolve) => {
    execFile('acli', args, { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (!err) {
        resolve({ code: 0, stdout, stderr });
        return;
      }
      const numeric = typeof (err as NodeJS.ErrnoException).code === 'number';
      resolve({
        code: numeric ? Number((err as NodeJS.ErrnoException).code) : 1,
        stdout,
        // ENOENT / timeout carry a string code; keep the reason visible.
        stderr: numeric ? stderr : `${stderr}${(err as NodeJS.ErrnoException).code ?? ''} ${err.message}`,
      });
    });
  });

export interface JiraSettings {
  /** Status (board column) name that means "ready for review". */
  reviewStatus: string;
  /** Status the ticket is moved to after its branch is merged: Done or Completed. */
  doneStatus: string;
  /** Site URL, only used to build "open in Jira" links. */
  baseUrl?: string;
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  /** The Reviewer field (empty when unset, or when read via search, which can't return it). */
  reviewers: string[];
  /** The Approval checkboxes: null when neither is ticked. (Both ticked counts as declined.) */
  approval: 'approved' | 'declined' | null;
  /** The Review Information text. */
  reviewInfo: string;
  /** The review recorded in the description by this app (see recordReview), or null. */
  recorded: RecordedReview | null;
  url: string | null;
}

export interface RecordedReview {
  decision: 'approved' | 'declined';
  /** The exact commit it applies to. */
  sha: string;
  /** The reviewer's note. */
  info: string;
}

export type AcliErrorKind = 'not-installed' | 'not-authenticated' | 'blocked' | 'failed' | 'unsupported';

export class AcliError extends Error {
  kind: AcliErrorKind;
  constructor(message: string, kind: AcliErrorKind = 'failed') {
    super(message);
    this.name = 'AcliError';
    this.kind = kind;
  }
}

const STATUS_NAME_RE = /^[A-Za-z][A-Za-z0-9 _-]{0,40}$/;
const TICKET_KEY_RE = new RegExp(`^${ALLOWED_PROJECT}-\\d{1,7}$`);
/** Standard fields only — acli rejects custom fields, and nothing else is needed. */
export const SEARCH_FIELDS = 'key,summary,status,assignee';
/** The AT board's custom "Reviewer" user field. `search --fields` can't return custom fields, `view` can. */
export const REVIEWER_FIELD = 'customfield_10550';
/** The AT board's "Approval" checkboxes (Approved / Declined) and "Review Information" text area. */
export const APPROVAL_FIELD = 'customfield_10650';
export const REVIEW_INFO_FIELD = 'customfield_10652';
export const APPROVAL_OPTION_IDS = { approved: '10478', declined: '10479' } as const;
export const MAX_REVIEW_INFO_CHARS = 5000;
export const VIEW_FIELDS = `key,summary,status,assignee,${REVIEWER_FIELD},${APPROVAL_FIELD},${REVIEW_INFO_FIELD},description`;
/** Where the one temporary file for an edit lives (private, removed straight after). */
export const REVIEW_EDIT_DIR_PREFIX = join(tmpdir(), 'review-jira-');
/** If a rewrite is ever not verified, the original description is kept here. */
export const REVIEW_BACKUP_DIR = join(tmpdir(), 'review-jira-backups');
const MAX_DESCRIPTION_BYTES = 300_000;

const isDoneStatus = (s: string) => ALLOWED_DONE_STATUSES.some((d) => d.toLowerCase() === s.toLowerCase());

export function listReviewJql(reviewStatus: string): string {
  return `project = "${ALLOWED_PROJECT}" AND status = "${reviewStatus}" ORDER BY updated DESC`;
}

export function oneReviewTicketJql(key: string, reviewStatus: string): string {
  return `key = "${key}" AND status = "${reviewStatus}"`;
}

const blocked = (why: string) => new AcliError(`Blocked by the AT-only guard rail: ${why}`, 'blocked');

/**
 * Throws unless `args` is exactly one of the two permitted acli invocations.
 * Everything is compared against rebuilt strings, never pattern-searched, so
 * nothing can ride along inside an argument.
 */
const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The ADF back to plain text (paragraphs joined with newlines). */
export function fromAdf(node: unknown): string {
  if (typeof node === 'string') return node;
  if (!isPlainObject(node)) return '';
  if (node.type === 'text' && typeof node.text === 'string') return node.text;
  const kids = Array.isArray(node.content) ? node.content.map(fromAdf) : [];
  return node.type === 'doc' ? kids.join('\n') : kids.join('');
}

export type ReviewDecision = 'approved' | 'declined' | 'none';

// ---- the review panel in the description ------------------------------------

interface AdfNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
  text?: string;
  marks?: Array<{ type: string }>;
}
const EMPTY_DOC = (): AdfNode => ({ type: 'doc', content: [], attrs: undefined });
const REVIEW_PANEL_MARKER = 'Code review: ';
/** Nodes that carry ids only Atlassian can mint (images, macros): a description with any is never rewritten. */
const UNSAFE_NODE_TYPES = new Set(['media', 'mediaSingle', 'mediaGroup', 'mediaInline', 'extension', 'bodiedExtension', 'inlineExtension', 'embedCard', 'syncBlock', 'bodiedSyncBlock']);

function normaliseDoc(value: unknown): AdfNode {
  if (isPlainObject(value) && value.type === 'doc' && Array.isArray(value.content)) return { type: 'doc', content: value.content as AdfNode[], ...(value.version !== undefined ? { version: value.version } : {}) } as AdfNode;
  return EMPTY_DOC();
}

function hasUnsafeNodes(node: unknown): boolean {
  if (!isPlainObject(node)) return false;
  if (typeof node.type === 'string' && UNSAFE_NODE_TYPES.has(node.type)) return true;
  return Array.isArray(node.content) && node.content.some(hasUnsafeNodes);
}

function nodeTypes(node: unknown, into: Map<string, number> = new Map()): Map<string, number> {
  if (!isPlainObject(node)) return into;
  if (typeof node.type === 'string') into.set(node.type, (into.get(node.type) ?? 0) + 1);
  if (Array.isArray(node.content)) for (const k of node.content) nodeTypes(k, into);
  return into;
}

const isReviewPanel = (n: unknown): n is AdfNode =>
  isPlainObject(n) && n.type === 'panel' && Array.isArray(n.content) && fromAdf((n.content as unknown[])[0]).startsWith(REVIEW_PANEL_MARKER);

/** The newest review panel in a description (history is kept, so there can be several), as its label, commit and note. */
function lastReviewPanel(doc: unknown): { label: 'Approved' | 'Changes requested' | 'Withdrawn'; sha: string; info: string } | null {
  if (!isPlainObject(doc) || !Array.isArray(doc.content)) return null;
  const panel = [...doc.content].reverse().find(isReviewPanel);
  if (!panel) return null;
  const paragraphs = (panel.content ?? []).map((p) => fromAdf(p));
  // "Declined" is what an early version wrote for the same thing
  const label = /^Code review: (Approved|Changes requested|Declined|Withdrawn)\b/.exec(paragraphs[0] ?? '');
  const sha = /^Commit: ([0-9a-f]{40})$/.exec(paragraphs[1] ?? '');
  if (!label || !sha) return null;
  const notes = paragraphs.slice(2);
  if (notes[0] === 'Review notes:') notes.shift();
  return { label: label[1] === 'Declined' ? 'Changes requested' : (label[1] as 'Approved' | 'Changes requested' | 'Withdrawn'), sha: sha[1], info: notes.join('\n').trim() };
}

/** The review this app recorded in a description: the newest panel, unless that one withdrew the decision. */
export function parseReviewPanel(doc: unknown): RecordedReview | null {
  const last = lastReviewPanel(doc);
  if (!last || last.label === 'Withdrawn') return null;
  return { decision: last.label === 'Approved' ? 'approved' : 'declined', sha: last.sha, info: last.info }; // 'declined' is the app's internal word for "changes requested"
}

const DECISION_LABEL = { approved: 'Approved', declined: 'Changes requested' } as const;

/** The panel: green for Approved, orange for Changes requested, grey for Withdrawn, with the commit it applies to and the note. */
export function buildReviewPanel(decision: 'approved' | 'declined' | 'withdrawn', info: string, sha: string, at: Date): AdfNode {
  const text = (value: string, marks?: Array<{ type: string }>): AdfNode => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
  const label = decision === 'withdrawn' ? 'Withdrawn' : DECISION_LABEL[decision];
  const content: AdfNode[] = [
    { type: 'paragraph', content: [text(`${REVIEW_PANEL_MARKER}${label}`, [{ type: 'strong' }]), text(` (recorded by the Review tab on ${at.toISOString().slice(0, 10)})`)] },
    { type: 'paragraph', content: [text('Commit: '), text(sha, [{ type: 'code' }])] },
  ];
  if (info) {
    content.push({ type: 'paragraph', content: [text('Review notes:', [{ type: 'strong' }])] });
    for (const line of info.split('\n')) content.push({ type: 'paragraph', content: line ? [text(line)] : [] });
  }
  return { type: 'panel', attrs: { panelType: decision === 'approved' ? 'success' : decision === 'declined' ? 'warning' : 'note' }, content };
}

/** The description with `panel` added at the very end. Nothing that is already there is changed or removed. */
export function appendReviewPanel(doc: AdfNode, panel: AdfNode): AdfNode {
  return { ...doc, content: [...(doc.content ?? []), panel] };
}

/** The description as plain text and node counts: what must be identical before the write and in everything but the new panel after it. */
function fingerprint(content: AdfNode[]): string {
  const doc: AdfNode = { type: 'doc', content };
  return JSON.stringify({ text: fromAdf(doc), types: [...nodeTypes(doc)].sort() });
}

/** The edit payload this app may send: one AT ticket and its (whole) description. */
export function buildReviewPayload(key: string, description: AdfNode): Record<string, unknown> {
  return { issues: [key], description };
}

function assertReviewEditFile(file: string): void {
  const rest = typeof file === 'string' && file.startsWith(REVIEW_EDIT_DIR_PREFIX) ? file.slice(REVIEW_EDIT_DIR_PREFIX.length) : '';
  if (!/^[A-Za-z0-9]+\/edit\.json$/.test(rest) || file.includes('..')) throw blocked("the edit file must be the app's own temporary file.");
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw blocked('the edit file could not be read.');
  }
  assertReviewEditPayload(data);
}

/** The content rules, separate from the file so they can be tested (and audited) on their own. */
export function assertReviewEditPayload(data: unknown): void {
  if (!isPlainObject(data)) throw blocked('the edit file must be a JSON object.');
  if (Object.keys(data).length !== 2 || !('issues' in data) || !('description' in data)) throw blocked('only one ticket and its description may be edited.');
  if (!Array.isArray(data.issues) || data.issues.length !== 1 || typeof data.issues[0] !== 'string' || !TICKET_KEY_RE.test(data.issues[0])) {
    throw blocked(`exactly one ${ALLOWED_PROJECT} ticket may be edited.`);
  }
  const doc = data.description;
  if (!isPlainObject(doc) || doc.type !== 'doc' || !Array.isArray(doc.content)) throw blocked('the description must be an Atlassian Document Format document.');
  if (!doc.content.every((n) => isPlainObject(n) && typeof n.type === 'string')) throw blocked('the description has an invalid node.');
  if (Buffer.byteLength(JSON.stringify(doc)) > MAX_DESCRIPTION_BYTES) throw blocked('the description is too large to rewrite.');
  if (hasUnsafeNodes(doc)) throw blocked('a description with images or macros is never rewritten.');
}

export function assertAllowedAcliCommand(args: string[], settings: Pick<JiraSettings, 'reviewStatus' | 'doneStatus'>): void {
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) throw blocked('invalid arguments.');
  const eq = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

  if (args[0] === 'jira' && args[1] === 'workitem' && args[2] === 'search') {
    // acli jira workitem search --jql <JQL> --fields <F> --limit 100 --json
    const jql = args[4];
    const okShape = args.length === 10 && eq([args[3], args[5], args[6], args[7], args[8], args[9]], ['--jql', '--fields', SEARCH_FIELDS, '--limit', '100', '--json']);
    if (!okShape) throw blocked('unexpected search arguments.');
    if (jql === listReviewJql(settings.reviewStatus)) return;
    const m = /^key = "([^"]+)" AND status = "[^"]+"$/.exec(jql);
    if (m && TICKET_KEY_RE.test(m[1]) && jql === oneReviewTicketJql(m[1], settings.reviewStatus)) return;
    throw blocked(`only AT tickets in "${settings.reviewStatus}" may be read.`);
  }

  if (args[0] === 'jira' && args[1] === 'workitem' && args[2] === 'view') {
    // acli jira workitem view AT-### --fields <VIEW_FIELDS> --json   (read-only, exactly one AT ticket)
    const okShape = args.length === 7 && eq([args[4], args[5], args[6]], ['--fields', VIEW_FIELDS, '--json']);
    if (!okShape) throw blocked('unexpected view arguments.');
    if (!TICKET_KEY_RE.test(args[3])) throw blocked(`${args[3]} is not a single ${ALLOWED_PROJECT} ticket.`);
    return;
  }

  if (args[0] === 'jira' && args[1] === 'workitem' && args[2] === 'edit') {
    // acli jira workitem edit --from-json <private temp file> --yes
    if (args.length !== 6 || args[3] !== '--from-json' || args[5] !== '--yes') throw blocked('unexpected edit arguments.');
    assertReviewEditFile(args[4]);
    return;
  }

  if (args[0] === 'jira' && args[1] === 'workitem' && args[2] === 'transition') {
    // acli jira workitem transition --key AT-### --status Done --yes
    const key = args[4];
    const okShape = args.length === 8 && eq([args[3], args[5], args[7]], ['--key', '--status', '--yes']);
    if (!okShape) throw blocked('unexpected transition arguments.');
    if (!TICKET_KEY_RE.test(key)) throw blocked(`${key} is not a single ${ALLOWED_PROJECT} ticket.`);
    if (args[6] !== settings.doneStatus || !isDoneStatus(args[6])) {
      throw blocked(`tickets may only be moved to ${ALLOWED_DONE_STATUSES.join(' or ')}.`);
    }
    return;
  }

  throw blocked(`"acli ${args.slice(0, 3).join(' ')}" is not allowed.`);
}

function explain(r: AcliResult, what: string): AcliError {
  const text = `${r.stderr}\n${r.stdout}`;
  if (/ENOENT/.test(r.stderr)) {
    return new AcliError('The Atlassian CLI (acli) was not found. Install it and make sure `acli` is on your PATH.', 'not-installed');
  }
  if (/unauthori[sz]ed|not logged in|auth login|401/i.test(text)) {
    return new AcliError("acli isn't logged in to Jira. Run `acli auth login` in a terminal, then refresh.", 'not-authenticated');
  }
  const detail = redactSecrets(text.trim().split('\n').filter(Boolean).slice(0, 3).join(' '));
  return new AcliError(`${what} failed${detail ? `: ${detail}` : '.'}`);
}

function asName(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const o = v as { displayName?: unknown; name?: unknown };
    if (typeof o.displayName === 'string') return o.displayName;
    if (typeof o.name === 'string') return o.name;
  }
  return null;
}

/** The Approval checkboxes. Both ticked is treated as declined, so it can never unlock a merge. */
export function parseApproval(v: unknown): 'approved' | 'declined' | null {
  const names = (Array.isArray(v) ? v : v ? [v] : []).map((o) => (typeof o === 'string' ? o : isPlainObject(o) ? String(o.value ?? o.name ?? o.id ?? '') : '').toLowerCase());
  const ids = (Array.isArray(v) ? v : v ? [v] : []).map((o) => (isPlainObject(o) ? String(o.id ?? '') : ''));
  const declined = names.includes('declined') || ids.includes(APPROVAL_OPTION_IDS.declined);
  const approved = names.includes('approved') || ids.includes(APPROVAL_OPTION_IDS.approved);
  return declined ? 'declined' : approved ? 'approved' : null;
}

/** The Reviewer field is a single user (older values may be a list); be liberal about both. */
function asNames(v: unknown): string[] {
  return (Array.isArray(v) ? v : v ? [v] : []).map(asName).filter((n): n is string => !!n);
}

/**
 * acli's --json is an array of work items with values under `fields`.
 * Anything that isn't an AT-### key is dropped (defence in depth).
 */
export function parseIssues(stdout: string, settings: Pick<JiraSettings, 'reviewStatus' | 'baseUrl'>): JiraIssue[] {
  let data: unknown;
  try {
    data = JSON.parse(stdout);
  } catch {
    throw new AcliError('Could not read the output of `acli jira workitem search` (expected JSON).');
  }
  const rows = Array.isArray(data) ? data : Array.isArray((data as { issues?: unknown })?.issues) ? (data as { issues: unknown[] }).issues : [];

  const base = settings.baseUrl?.replace(/\/+$/, '') ?? null;
  const out: JiraIssue[] = [];
  for (const row of rows) {
    const r = row as { key?: unknown; fields?: Record<string, unknown> } & Record<string, unknown>;
    if (typeof r?.key !== 'string' || !TICKET_KEY_RE.test(r.key)) continue;
    const f: Record<string, unknown> = { ...r, ...(r.fields ?? {}) };
    out.push({
      key: r.key,
      summary: typeof f.summary === 'string' ? f.summary : '',
      status: asName(f.status) ?? settings.reviewStatus,
      assignee: asName(f.assignee),
      reviewers: asNames(f[REVIEWER_FIELD]),
      approval: parseApproval(f[APPROVAL_FIELD]),
      reviewInfo: fromAdf(f[REVIEW_INFO_FIELD]).trim(),
      recorded: parseReviewPanel(f.description),
      url: base ? `${base}/browse/${r.key}` : null,
    });
  }
  return out;
}

export function createJiraClient(projectKey: string, settings: JiraSettings, rawRun: AcliRunner = defaultAcliRunner) {
  if (projectKey !== ALLOWED_PROJECT) {
    throw new Error(`Jira access is restricted to the ${ALLOWED_PROJECT} project; "${projectKey}" is not allowed.`);
  }
  if (!STATUS_NAME_RE.test(settings.reviewStatus)) {
    throw new Error('JIRA_REVIEW_STATUS may only contain letters, numbers, spaces, "_" and "-".');
  }
  if (!isDoneStatus(settings.doneStatus)) {
    throw new Error(`JIRA_DONE_STATUS must be ${ALLOWED_DONE_STATUSES.join(' or ')}.`);
  }

  // Every command, whoever builds it, goes through the guard first.
  const run: AcliRunner = async (args) => {
    assertAllowedAcliCommand(args, settings);
    return rawRun(args);
  };

  async function search(jql: string): Promise<JiraIssue[]> {
    const r = await run(['jira', 'workitem', 'search', '--jql', jql, '--fields', SEARCH_FIELDS, '--limit', '100', '--json']);
    if (r.code !== 0) throw explain(r, 'Reading the review column from Jira');
    return parseIssues(r.stdout, settings);
  }

  /** Strict JQL check used right before a transition: exactly this AT ticket, in the review column. */
  async function searchOneInReview(key: string): Promise<JiraIssue | null> {
    if (!TICKET_KEY_RE.test(key)) throw new AcliError(`"${key}" is not a ${ALLOWED_PROJECT} ticket key.`);
    const found = await search(oneReviewTicketJql(key, settings.reviewStatus));
    return found.find((i) => i.key === key) ?? null;
  }

  /**
   * Read-only: one AT ticket, with its Reviewer and the raw description — but only if it is in the
   * review column right now (else null). One call serves the show page and the pre-merge check.
   */
  async function viewRaw(key: string): Promise<{ issue: JiraIssue; description: unknown } | null> {
    if (!TICKET_KEY_RE.test(key)) throw new AcliError(`"${key}" is not a ${ALLOWED_PROJECT} ticket key.`);
    const r = await run(['jira', 'workitem', 'view', key, '--fields', VIEW_FIELDS, '--json']);
    if (r.code !== 0) {
      // a ticket that doesn't exist is "not in Review", not a failure
      if (/does not exist|not found|404|no issue/i.test(`${r.stderr}\n${r.stdout}`) && !/unauthori[sz]ed|auth login/i.test(`${r.stderr}${r.stdout}`)) return null;
      throw explain(r, `Reading ${key} from Jira`);
    }
    let data: unknown;
    try {
      data = JSON.parse(r.stdout);
    } catch {
      throw new AcliError('Could not read the output of `acli jira workitem view` (expected JSON).');
    }
    const list = Array.isArray(data) ? data : [data];
    const issue = parseIssues(JSON.stringify(list), settings).find((i) => i.key === key);
    if (!issue || issue.status.toLowerCase() !== settings.reviewStatus.toLowerCase()) return null;
    const raw = list.find((d) => isPlainObject(d) && d.key === key) as { fields?: { description?: unknown } } | undefined;
    return { issue, description: raw?.fields?.description ?? null };
  }

  async function findInReview(key: string): Promise<JiraIssue | null> {
    return (await viewRaw(key))?.issue ?? null;
  }

  /** Writes a whole description through the one allowed edit shape, with the private temp file removed straight after. */
  async function writeDescription(key: string, description: AdfNode): Promise<void> {
    const dir = mkdtempSync(REVIEW_EDIT_DIR_PREFIX);
    try {
      chmodSync(dir, 0o700);
      const file = join(dir, 'edit.json');
      writeFileSync(file, JSON.stringify(buildReviewPayload(key, description)), { mode: 0o600 });
      const r = await run(['jira', 'workitem', 'edit', '--from-json', file, '--yes']);
      if (r.code !== 0) throw explain(r, `Saving the review on ${key}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  function saveBackup(key: string, description: AdfNode): string {
    mkdirSync(REVIEW_BACKUP_DIR, { recursive: true, mode: 0o700 });
    const file = join(REVIEW_BACKUP_DIR, `${key}-${Date.now()}.json`);
    writeFileSync(file, JSON.stringify(description), { mode: 0o600 });
    return file;
  }

  /**
   * Record (or withdraw) a review on one AT ticket that is in the review column by APPENDING a panel to the end of its
   * description: Approved, Changes requested or Withdrawn, which commit, and the reviewer's note. What is already in the
   * description is never changed or removed (earlier panels stay, as a history; the newest one counts). A copy of the
   * original is saved first, the result is read back, and if anything before the new panel differs the original is put
   * back. A description with images or macros is never rewritten.
   */
  async function recordReview(key: string, decision: ReviewDecision, info: string | undefined, sha: string): Promise<JiraIssue> {
    if (!TICKET_KEY_RE.test(key)) throw new AcliError(`"${key}" is not a ${ALLOWED_PROJECT} ticket key.`);
    if (decision !== 'none' && !/^[0-9a-f]{40}$/.test(sha)) throw new AcliError('The commit that was reviewed is needed to record a review.');
    const text = (info ?? '').replace(/\0/g, '').replace(/\r\n?/g, '\n').trim();
    if (text.length > MAX_REVIEW_INFO_CHARS) throw new AcliError(`Review information is limited to ${MAX_REVIEW_INFO_CHARS} characters.`);

    const before = await viewRaw(key);
    if (!before) throw new AcliError(`${key} is not in "${settings.reviewStatus}" any more, so its review was not recorded.`);
    const original = normaliseDoc(before.description);
    if (hasUnsafeNodes(original)) {
      throw new AcliError(`${key}'s description has images or macros, which acli can't safely rewrite, so the review was not written to Jira.`, 'unsupported');
    }
    // What to add. Withdrawing only makes sense if there is a decision to withdraw; repeating the same decision adds nothing.
    const current = lastReviewPanel(original);
    const standing = current && current.label !== 'Withdrawn' ? current : null;
    if (decision === 'none' ? !standing : standing && standing.label === DECISION_LABEL[decision] && standing.sha === sha && standing.info === text) return before.issue;
    const panel = decision === 'none' ? buildReviewPanel('withdrawn', '', standing!.sha, new Date()) : buildReviewPanel(decision, text, sha, new Date());
    const next = appendReviewPanel(original, panel);

    const backup = saveBackup(key, original);
    try {
      await writeDescription(key, next);
    } catch (err) {
      rmSync(backup, { force: true }); // acli refused it, so nothing changed and there is nothing to restore
      throw err;
    }

    // Read it back: exactly one new panel at the end, saying what was asked, and everything before it unchanged.
    const after = await viewRaw(key);
    const afterContent = after ? normaliseDoc(after.description).content ?? [] : [];
    const originalContent = original.content ?? [];
    const written = lastReviewPanel({ content: afterContent });
    const expectedLabel = decision === 'none' ? 'Withdrawn' : DECISION_LABEL[decision];
    const reviewOk = !!written && written.label === expectedLabel && written.sha === (decision === 'none' ? standing!.sha : sha) && (decision === 'none' || written.info === text);
    const restOk = afterContent.length === originalContent.length + 1 && fingerprint(afterContent.slice(0, -1)) === fingerprint(originalContent);
    if (!after || !reviewOk || !restOk) {
      try {
        await writeDescription(key, original); // put it back
      } catch {
        // the saved copy is the way back
      }
      throw new AcliError(`Jira did not keep the review as written on ${key}, so its description was put back. A copy of the original is at ${backup}. Add the review to ${key} yourself.`);
    }
    rmSync(backup, { force: true });
    return after.issue;
  }

  return {
    recordReview,
    findReviewIssue: findInReview,

    /** Operation 1 (read-only): AT tickets currently in the review column. */
    listReviewIssues(): Promise<JiraIssue[]> {
      return search(listReviewJql(settings.reviewStatus));
    },

    /**
     * Operation 2: move one AT ticket from the review column to done. Re-checks
     * right now that the ticket is still in the review column, so it can never
     * move a ticket that's anywhere else on the board.
     */
    async moveReviewIssueToDone(key: string): Promise<void> {
      const current = await searchOneInReview(key);
      if (!current) {
        throw new AcliError(`${key} is not in "${settings.reviewStatus}" any more, so it was left where it is.`);
      }
      const r = await run(['jira', 'workitem', 'transition', '--key', key, '--status', settings.doneStatus, '--yes']);
      if (r.code !== 0) throw explain(r, `Moving ${key} to ${settings.doneStatus}`);
    },
  };
}

export type JiraClient = ReturnType<typeof createJiraClient>;
