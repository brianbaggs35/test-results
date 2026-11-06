import type { SpecJob } from '@/types/review';

/**
 * Review progress kept in this browser's localStorage, so leaving a PR by accident (another tab of the app, a reload, a
 * closed window) loses nothing. There is no database: this never leaves the browser, and Jira and the server remain the
 * source of truth for approvals and for whether the specs passed. What is kept here:
 *
 *   viewed      the files you ticked "Viewed", per PR commit
 *   run         the latest spec run for a PR commit (which specs ran, and how each ended), so it can be shown again
 *   active      the id of a spec run that was still going when you left, so the page can pick it back up
 *   draft       the note you were typing for Approve / Request changes
 *   selection   which PR (and tab) you were on
 *   moveToDone  your choice for "Move the ticket to Done"
 *
 * Everything about a PR is keyed by its branch AND commit: new commits start from a clean slate, and nothing from one PR
 * is ever shown for another. A PR's data is removed ONLY once its merge has succeeded (`clearBranchData`), when the PR
 * has disappeared from the Review column (`pruneMissingBranches`), or when you press "Clear saved data". A failed merge
 * keeps everything, so it can be retried.
 */

const PREFIX = 'review:v1:';
/** The key of one PR commit: branch names can't contain "@", so it splits unambiguously. */
const at = (branch: string, sha: string) => `${branch}@${sha}`;

/** The most spec runs kept; the oldest go first when this is exceeded or the browser's quota is. */
const MAX_RUNS = 12;
/** The tail of a run's output that is kept (the full output stays on the server while it is up). */
const MAX_OUTPUT_CHARS = 120_000;

// ---- safe access: storage can be missing, full, or blocked (private windows) ---------------------------------------

function store(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function read<T>(key: string): T | null {
  try {
    const raw = store()?.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Returns false if it could not be saved (progress just won't survive then). */
function write(key: string, value: unknown): boolean {
  try {
    const s = store();
    if (!s) return false;
    s.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key: string): void {
  try {
    store()?.removeItem(PREFIX + key);
  } catch {
    // nothing to remove
  }
}

function keys(): string[] {
  try {
    const s = store();
    if (!s) return [];
    const found: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) found.push(k.slice(PREFIX.length));
    }
    return found;
  } catch {
    return [];
  }
}

// ---- viewed files -----------------------------------------------------------------------------------------------

export function readViewed(branch: string, sha: string): string[] {
  const saved = read<unknown>(`viewed:${at(branch, sha)}`);
  if (Array.isArray(saved)) return saved.filter((p): p is string => typeof p === 'string');
  // earlier versions kept this in sessionStorage
  try {
    const old = JSON.parse(window.sessionStorage.getItem(`review-viewed:${at(branch, sha)}`) ?? '[]');
    return Array.isArray(old) ? old.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

export function writeViewed(branch: string, sha: string, paths: string[]): void {
  if (paths.length === 0) remove(`viewed:${at(branch, sha)}`);
  else write(`viewed:${at(branch, sha)}`, paths);
}

// ---- spec runs ----------------------------------------------------------------------------------------------------

export interface SavedRun {
  savedAt: string;
  job: SpecJob;
}

/** A run as it is kept: the output cut to its tail, and the (large) stack traces dropped if the whole thing is huge. */
function compact(job: SpecJob): SpecJob {
  const output = job.output.length > MAX_OUTPUT_CHARS ? `…\n${job.output.slice(-MAX_OUTPUT_CHARS)}` : job.output;
  const slim: SpecJob = { ...job, output };
  if (JSON.stringify(slim).length > 400_000 && slim.results) {
    slim.results = slim.results.map((r) => ({ ...r, tests: r.tests.map((t) => (t.error ? { ...t, error: { ...t.error, stack: '' } } : t)) }));
  }
  return slim;
}

export function readRun(branch: string, sha: string): SavedRun | null {
  const saved = read<SavedRun>(`run:${at(branch, sha)}`);
  return saved && saved.job && typeof saved.job.id === 'string' ? saved : null;
}

/** Saves the latest run for this PR commit, making room (oldest runs first) if the browser says it is full. */
export function writeRun(branch: string, sha: string, job: SpecJob): boolean {
  const entry: SavedRun = { savedAt: new Date().toISOString(), job: compact(job) };
  const key = `run:${at(branch, sha)}`;
  if (write(key, entry)) {
    evictOldRuns();
    return true;
  }
  // full: drop the oldest runs one by one, then settle for the results without the output
  const others = keys()
    .filter((k) => k.startsWith('run:') && k !== key)
    .map((k) => ({ k, savedAt: read<SavedRun>(k)?.savedAt ?? '' }))
    .sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  for (const old of others) {
    remove(old.k);
    if (write(key, entry)) return true;
  }
  return write(key, { ...entry, job: { ...entry.job, output: '' } });
}

function evictOldRuns(): void {
  const runs = keys()
    .filter((k) => k.startsWith('run:'))
    .map((k) => ({ k, savedAt: read<SavedRun>(k)?.savedAt ?? '' }))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  for (const extra of runs.slice(MAX_RUNS)) remove(extra.k);
}

export const readActiveRun = (branch: string, sha: string): string | null => read<string>(`active:${at(branch, sha)}`);
export const writeActiveRun = (branch: string, sha: string, jobId: string): boolean => write(`active:${at(branch, sha)}`, jobId);
export const clearActiveRun = (branch: string, sha: string): void => remove(`active:${at(branch, sha)}`);

// ---- the note being typed -----------------------------------------------------------------------------------------

export type DraftDecision = 'approved' | 'declined';
const draftKey = (branch: string, sha: string, decision: DraftDecision) => `draft:${at(branch, sha)}:${decision}`;

export const readDraft = (branch: string, sha: string, decision: DraftDecision): string => read<string>(draftKey(branch, sha, decision)) ?? '';

export function writeDraft(branch: string, sha: string, decision: DraftDecision, text: string): void {
  if (text.trim() === '') remove(draftKey(branch, sha, decision));
  else write(draftKey(branch, sha, decision), text);
}

export const clearDraft = (branch: string, sha: string, decision: DraftDecision): void => remove(draftKey(branch, sha, decision));

// ---- where you were -----------------------------------------------------------------------------------------------

export interface SavedSelection {
  branch: string;
  tab: string;
}

export const readSelection = (): SavedSelection | null => {
  const saved = read<SavedSelection>('selection');
  return saved && typeof saved.branch === 'string' && typeof saved.tab === 'string' ? saved : null;
};
export const writeSelection = (selection: SavedSelection): void => void write('selection', selection);
export const clearSelection = (): void => remove('selection');

// ---- preferences --------------------------------------------------------------------------------------------------

export const readMoveToDone = (): boolean => read<boolean>('moveToDone') !== false;
export const writeMoveToDone = (value: boolean): void => void write('moveToDone', value);

// ---- cleaning up --------------------------------------------------------------------------------------------------

/** The branch a stored key belongs to, or null for keys that aren't about one PR (selection, preferences). */
function branchOf(key: string): string | null {
  const m = /^(?:viewed|run|active|draft):(.+?)@[^@:]+(?::(?:approved|declined))?$/.exec(key);
  return m ? m[1] : null;
}

/** Removes everything saved about one PR, for any of its commits. Call it ONLY when its merge has succeeded. Returns how many entries went. */
export function clearBranchData(branch: string): number {
  let removed = 0;
  for (const k of keys()) {
    if (branchOf(k) === branch) {
      remove(k);
      removed++;
    }
  }
  const selected = readSelection();
  if (selected?.branch === branch) clearSelection();
  return removed;
}

/** Removes what is saved for PRs that are no longer in the Review column (merged elsewhere, or the response of a merge was lost). */
export function pruneMissingBranches(live: string[]): number {
  const alive = new Set(live);
  let removed = 0;
  for (const k of keys()) {
    const branch = branchOf(k);
    if (branch && !alive.has(branch)) {
      remove(k);
      removed++;
    }
  }
  const selected = readSelection();
  if (selected && !alive.has(selected.branch)) clearSelection();
  return removed;
}

/** Removes everything this app saved for reviews, including preferences. */
export function clearAllReviewData(): number {
  const all = keys();
  for (const k of all) remove(k);
  return all.length;
}

/** How much is saved, for the "Saved in this browser" note. */
export function savedSummary(): { prs: number; entries: number } {
  const all = keys();
  return { prs: new Set(all.map(branchOf).filter((b): b is string => !!b)).size, entries: all.length };
}
