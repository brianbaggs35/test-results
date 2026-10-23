import type { TestData } from '../types';
import { computeResultsHash } from './structureHash';
import { testIdentityKey } from './testIdentity';

/** Shared by ClearLocalStorage.tsx's manual-wipe sweep so the two features can't drift apart. */
export const PROGRESS_STORAGE_PREFIX = 'testFixProgress';

const RESULTS_HASH_KEY = `${PROGRESS_STORAGE_PREFIX}_resultsHash`;

/**
 * Records which results the progress currently in storage belongs to, so the next file
 * that loads can be recognised as the same results again (or not). Combine, which writes
 * its own merged progress instead of going through syncProgressStorageForNewXml, calls
 * this directly.
 */
export async function storeResultsHash(data: TestData): Promise<void> {
  const hash = await computeResultsHash(data);
  if (hash) localStorage.setItem(RESULTS_HASH_KEY, hash);
}

/**
 * Whether the stored progress tracks exactly the tests `data` would have seeded it with.
 * The Progress tab seeds one entry per failed/flaky test of the file it was opened for (see
 * FailureAnalysisProgress), so progress can only belong to `data` if it tracks that very
 * set — a fresh run with different failures leaves stale entries for tests that now pass
 * and no entry for the new failures. Returns undefined when there's no readable progress to
 * judge, so callers leave storage alone rather than guess.
 */
function storedProgressMatches(data: TestData): boolean | undefined {
  const raw = localStorage.getItem(PROGRESS_STORAGE_PREFIX);
  if (!raw) return undefined;

  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof stored !== 'object' || stored === null) return undefined;

  const failingIds = new Set<string>();
  data.suites.forEach((suite) =>
    suite.testcases.forEach((tc) => {
      if (tc.status === 'failed' || tc.status === 'flaky') {
        failingIds.add(testIdentityKey(suite.name, tc.classname, tc.name));
      }
    }),
  );
  const storedIds = Object.keys(stored);
  return storedIds.length === failingIds.size && storedIds.every((id) => failingIds.has(id));
}

/**
 * Called whenever a fresh XML is loaded (not on Combine, which already knows exactly
 * what progress to write). Decides whether the stored progress belongs to this file or
 * to a previous one:
 *  - Same file (identical results fingerprint — see computeResultsHash): leave storage
 *    untouched, so the existing progress carries over.
 *  - Different file, *including a new run of the same suite*: sweep every testFixProgress*
 *    key. FailureAnalysisProgress's own effect already reseeds fresh progress the next
 *    time it mounts, once the key it reads is gone.
 *  - No fingerprint on record for the stored progress (it was saved before fingerprints
 *    covered results, or SubtleCrypto is unavailable so none can be computed): fall back
 *    to checking that the stored progress tracks exactly this file's failed/flaky tests.
 *    That clears stale progress without wiping in-flight progress for a file that's
 *    simply being reloaded. Nothing stored (first-ever load) or nothing readable: leave
 *    storage untouched rather than risk destroying real progress.
 * Also covers a hard page refresh followed by re-selecting the same file, since this
 * hash — unlike testData/xmlContent, which are plain unpersisted React state — lives
 * in localStorage and survives reloads.
 */
export async function syncProgressStorageForNewXml(data: TestData): Promise<{ cleared: boolean }> {
  try {
    const newHash = await computeResultsHash(data);
    const storedHash = localStorage.getItem(RESULTS_HASH_KEY);

    const isDifferentFile = newHash && storedHash ? storedHash !== newHash : storedProgressMatches(data) === false;
    if (isDifferentFile) {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(PROGRESS_STORAGE_PREFIX))
        .forEach((key) => localStorage.removeItem(key));
    }
    if (newHash) localStorage.setItem(RESULTS_HASH_KEY, newHash);
    return { cleared: isDifferentFile };
  } catch {
    return { cleared: false };
  }
}
