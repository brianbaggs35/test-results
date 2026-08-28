import type { ExportBundle, TestData, TestSuite, TestCase, FailureProgressItem } from '../types';
import { testIdentityKey } from './testIdentity';

export interface CombineResult {
  testData: TestData;
  progress: Record<string, FailureProgressItem>;
  warnings: string[];
}

function testcaseKey(tc: TestCase, suiteName: string): string {
  return testIdentityKey(suiteName, tc.classname, tc.name);
}

// When the same test has a different outcome between the two halves (a genuine rerun
// difference, not the ordinary shared passed/skipped case), keep whichever outcome is
// more "worth attention" rather than always favoring one hardcoded status.
const STATUS_PRIORITY: Record<TestCase['status'], number> = {
  failed: 3,
  flaky: 2,
  skipped: 1,
  passed: 0,
};

/**
 * Merges two exported bundles (each a split's testData + that person's
 * progress notes) back into one combined report. Passed/skipped testcases
 * are duplicated in both halves by design (see splitJUnitXml.ts) so they're
 * deduplicated by suite + classname + name; failed testcases are the
 * complementary halves of the original set, so they union together without
 * double-counting.
 */
export function combineExportBundles(a: ExportBundle, b: ExportBundle): CombineResult {
  const warnings: string[] = [];

  if (JSON.stringify(a.testData) === JSON.stringify(b.testData)) {
    warnings.push('Both files contain identical test data — did you mean to upload two different halves?');
  }

  const suiteNames = new Set<string>();
  a.testData.suites.forEach((s) => suiteNames.add(s.name));
  b.testData.suites.forEach((s) => suiteNames.add(s.name));

  const mergedSuites: TestSuite[] = [];
  suiteNames.forEach((name) => {
    // A suite name isn't guaranteed unique within one file — splitJUnitXml
    // itself supports and tests two <testsuite> blocks sharing a name — so
    // collect every suite on each side with this name rather than just the
    // first match. Using .find() here would silently drop a second
    // same-named suite's testcases during combine.
    const suitesA = a.testData.suites.filter((s) => s.name === name);
    const suitesB = b.testData.suites.filter((s) => s.name === name);
    const testcasesA = suitesA.flatMap((s) => s.testcases);
    const testcasesB = suitesB.flatMap((s) => s.testcases);

    const testcaseByKey = new Map<string, TestCase>();
    testcasesA.forEach((tc) => testcaseByKey.set(testcaseKey(tc, name), tc));
    testcasesB.forEach((tc) => {
      const key = testcaseKey(tc, name);
      const existing = testcaseByKey.get(key);
      if (!existing) {
        testcaseByKey.set(key, tc);
      } else if (existing.status !== tc.status) {
        const winner = STATUS_PRIORITY[tc.status] > STATUS_PRIORITY[existing.status] ? tc : existing;
        warnings.push(`"${tc.name}" in suite "${name}" has a different status between the two files — kept the ${winner.status} one.`);
        if (winner === tc) testcaseByKey.set(key, tc);
      }
      // Same key, same status (the ordinary shared passed/skipped case): keep the first, they're identical.
    });

    const mergedTestcases = Array.from(testcaseByKey.values());
    const failures = suitesA.reduce((sum, s) => sum + s.failures, 0) + suitesB.reduce((sum, s) => sum + s.failures, 0);
    const errors = suitesA.reduce((sum, s) => sum + s.errors, 0) + suitesB.reduce((sum, s) => sum + s.errors, 0);
    const skipped = mergedTestcases.filter((t) => t.status === 'skipped').length;
    const time = mergedTestcases.reduce((sum, t) => sum + t.time, 0);

    mergedSuites.push({
      name,
      tests: mergedTestcases.length,
      failures,
      errors,
      skipped,
      time,
      timestamp: suitesA[0]?.timestamp ?? suitesB[0]?.timestamp ?? new Date().toISOString(),
      testcases: mergedTestcases,
    });
  });

  const totalTests = mergedSuites.reduce((sum, s) => sum + s.tests, 0);
  const totalFailed = mergedSuites.reduce((sum, s) => sum + s.failures + s.errors, 0);
  const totalSkipped = mergedSuites.reduce((sum, s) => sum + s.skipped, 0);
  const totalFlaky = mergedSuites.reduce((sum, s) => sum + s.testcases.filter((t) => t.status === 'flaky').length, 0);
  const totalTime = mergedSuites.reduce((sum, s) => sum + s.time, 0);

  const testData: TestData = {
    summary: {
      total: totalTests,
      passed: totalTests - totalFailed - totalSkipped - totalFlaky,
      failed: totalFailed,
      skipped: totalSkipped,
      flaky: totalFlaky,
      time: totalTime,
    },
    suites: mergedSuites,
  };

  return { testData, progress: { ...a.progress, ...b.progress }, warnings };
}
