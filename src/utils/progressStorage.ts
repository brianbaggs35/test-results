import type { TestData } from '../types';
import { computeStructureHash } from './structureHash';

/** Shared by ClearLocalStorage.tsx's manual-wipe sweep so the two features can't drift apart. */
export const PROGRESS_STORAGE_PREFIX = 'testFixProgress';

const STRUCTURE_HASH_KEY = `${PROGRESS_STORAGE_PREFIX}_structureHash`;

/**
 * Called whenever a fresh XML is loaded (not on Combine, which already knows exactly
 * what progress to write). Compares the newly loaded data's structure fingerprint
 * against whichever XML the currently stored progress belongs to:
 *  - No stored hash yet (first-ever load, or an existing user upgrading with progress
 *    already saved from before this existed): nothing to compare against, so leave
 *    storage untouched rather than risk destroying real in-flight progress.
 *  - Hash matches (same file, or a rerun of the same suite with different pass/fail
 *    outcomes — the hash deliberately ignores those): leave storage untouched, so the
 *    existing progress carries over.
 *  - Hash differs: sweep every testFixProgress* key. FailureAnalysisProgress's own
 *    effect already reseeds fresh progress the next time it mounts, once the key it
 *    reads is gone.
 * Also covers a hard page refresh followed by re-selecting the same file, since this
 * hash — unlike testData/xmlContent, which are plain unpersisted React state — lives
 * in localStorage and survives reloads.
 */
export async function syncProgressStorageForNewXml(data: TestData): Promise<{ cleared: boolean }> {
  try {
    const newHash = await computeStructureHash(data);
    if (!newHash) return { cleared: false };

    const storedHash = localStorage.getItem(STRUCTURE_HASH_KEY);
    let cleared = false;
    if (storedHash && storedHash !== newHash) {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(PROGRESS_STORAGE_PREFIX))
        .forEach((key) => localStorage.removeItem(key));
      cleared = true;
    }
    localStorage.setItem(STRUCTURE_HASH_KEY, newHash);
    return { cleared };
  } catch {
    return { cleared: false };
  }
}
