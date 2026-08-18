import type { ExportBundle, FailureProgressItem, TestData } from '../types';
import { downloadFile, readFileAsText } from './download';
import { testIdentityKey } from './testIdentity';

function testcaseIds(data: TestData): string[] {
  const ids: string[] = [];
  data.suites.forEach((suite) => {
    suite.testcases.forEach((tc) => ids.push(testIdentityKey(suite.name, tc.classname, tc.name)));
  });
  return ids;
}

/**
 * Fingerprints the *shape* of a test run — which suites and tests exist — while
 * ignoring outcome data (status, time, timestamps, pass/fail counts) that legitimately
 * differs between two runs of the exact same suite, and that many test runs otherwise
 * share (e.g. always "12 passed, 2 failed"). Each (suite, class, test) triple uses the
 * shared testIdentityKey so two different tests that happen to share a name across
 * classes are never fingerprinted as the same identity, and so names containing
 * punctuation can't be confused with a different triple under naive string
 * concatenation (e.g. suite "A-B" + test "C" vs suite "A" + test "B-C"). The list is
 * sorted so test order doesn't matter, and real SHA-256 (Web Crypto) is used so two
 * genuinely different suites — even same-sized ones — have a negligible chance of
 * ever fingerprinting the same. Returns undefined if SubtleCrypto isn't available
 * (e.g. a non-HTTPS, non-localhost deployment); callers fall back to the looser
 * overlap check in that case.
 */
async function computeStructureHash(data: TestData): Promise<string | undefined> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return undefined;
  const identities = data.suites
    .flatMap((suite) => suite.testcases.map((tc) => testIdentityKey(suite.name, tc.classname, tc.name)))
    .sort();
  const bytes = new TextEncoder().encode(identities.join('\n'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function buildExportBundle(
  testData: TestData,
  progress: Record<string, FailureProgressItem>,
): Promise<ExportBundle> {
  return { version: 1, testData, progress, structureHash: await computeStructureHash(testData) };
}

export function downloadJson(filename: string, data: unknown): void {
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json');
}

export async function exportProgressBundle(
  testData: TestData,
  progress: Record<string, FailureProgressItem>,
): Promise<void> {
  downloadJson(
    `test-results-export-${new Date().toISOString().split('T')[0]}.json`,
    await buildExportBundle(testData, progress),
  );
}

/** Parses and minimally validates a File as an ExportBundle produced by exportProgressBundle. */
export async function readExportBundle(file: File): Promise<ExportBundle> {
  const text = await readFileAsText(file);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`"${file.name}" is not valid JSON. Export it from the Progress tab first.`);
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('testData' in parsed) ||
    !('progress' in parsed)
  ) {
    throw new Error(`"${file.name}" doesn't look like a test-results export file.`);
  }
  return parsed as ExportBundle;
}

export interface ImportProgressResult {
  progress: Record<string, FailureProgressItem>;
  matchedCount: number;
  skippedCount: number;
}

/**
 * Restores status/notes/assignee from a previously exported file onto the progress
 * for the currently loaded results. Only fields for ids already present in
 * `currentProgress` (i.e. tests from the XML loaded on the Dashboard) are overwritten
 * — identity fields like name/suite/errorMessage always keep the currently loaded
 * XML's values, so stack traces keep coming from that XML rather than a stale export.
 *
 * Rejects the file outright if it doesn't appear to come from the currently loaded XML:
 * first by comparing `structureHash` (an exact fingerprint of suite/class/test names, ignoring
 * outcome data that varies between reruns of the same suite), falling back to "do any of
 * its tests exist here at all" for exports made before that field existed. Without this,
 * importing progress from an unrelated file couldn't do anything useful, and any stack
 * traces shown would have to come from this file instead of the loaded XML.
 */
export async function importProgressBundle(
  file: File,
  currentTestData: TestData,
  currentProgress: Record<string, FailureProgressItem>,
): Promise<ImportProgressResult> {
  const bundle = await readExportBundle(file);

  const currentStructureHash = await computeStructureHash(currentTestData);
  const sameStructure = bundle.structureHash !== undefined && bundle.structureHash === currentStructureHash;
  if (!sameStructure) {
    const importedIds = testcaseIds(bundle.testData);
    const currentIds = new Set(testcaseIds(currentTestData));
    const overlaps = importedIds.some((id) => currentIds.has(id));
    if (importedIds.length > 0 && !overlaps) {
      throw new Error(
        `"${file.name}" doesn't match the currently loaded results — none of its tests were found here. Load the original XML file this export was created from, then import progress again so stack traces line up correctly.`,
      );
    }
  }

  const progress = { ...currentProgress };
  let matchedCount = 0;
  let skippedCount = 0;

  Object.entries(bundle.progress).forEach(([id, imported]) => {
    const existing = progress[id];
    if (!existing) {
      skippedCount++;
      return;
    }
    progress[id] = {
      ...existing,
      status: imported.status,
      notes: imported.notes,
      assignee: imported.assignee,
      updatedAt: imported.updatedAt,
    };
    matchedCount++;
  });

  return { progress, matchedCount, skippedCount };
}
