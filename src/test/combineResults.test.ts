import { describe, it, expect } from 'vitest';
import { combineExportBundles } from '../utils/combineResults';
import type { ExportBundle, TestCase, TestSuite } from '../types';

function tc(overrides: Partial<TestCase> & Pick<TestCase, 'name' | 'status'>): TestCase {
  return { classname: 'C', time: 1, ...overrides };
}

function suite(overrides: Partial<TestSuite> & Pick<TestSuite, 'name' | 'testcases'>): TestSuite {
  return {
    tests: overrides.testcases.length,
    failures: overrides.testcases.filter((t) => t.status === 'failed').length,
    errors: 0,
    skipped: overrides.testcases.filter((t) => t.status === 'skipped').length,
    time: overrides.testcases.reduce((s, t) => s + t.time, 0),
    timestamp: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function bundle(suites: TestSuite[], progress: ExportBundle['progress'] = {}): ExportBundle {
  const summary = suites.reduce(
    (acc, s) => {
      acc.total += s.tests;
      acc.failed += s.failures + s.errors;
      acc.skipped += s.skipped;
      acc.time += s.time;
      return acc;
    },
    { total: 0, passed: 0, failed: 0, skipped: 0, time: 0 },
  );
  summary.passed = summary.total - summary.failed - summary.skipped;
  return { version: 1, testData: { summary, suites }, progress };
}

describe('combineExportBundles', () => {
  it('unions complementary failures and dedupes shared passed/skipped tests', () => {
    const shared = tc({ name: 'passes', status: 'passed' });
    const a = bundle([
      suite({ name: 'Suite A', testcases: [shared, tc({ name: 'fail1', status: 'failed' })] }),
    ]);
    const b = bundle([
      suite({ name: 'Suite A', testcases: [shared, tc({ name: 'fail2', status: 'failed' })] }),
    ]);

    const { testData, warnings } = combineExportBundles(a, b);

    expect(warnings).toEqual([]);
    expect(testData.suites).toHaveLength(1);
    expect(testData.suites[0].testcases.map((t) => t.name).sort()).toEqual(['fail1', 'fail2', 'passes']);
    expect(testData.summary.total).toBe(3);
    expect(testData.summary.failed).toBe(2);
    expect(testData.summary.passed).toBe(1);
  });

  it('includes a suite that exists in only one bundle (dropped entirely from the other)', () => {
    const a = bundle([suite({ name: 'OnlyInA', testcases: [tc({ name: 'f', status: 'failed' })] })]);
    const b = bundle([suite({ name: 'OnlyInB', testcases: [tc({ name: 'g', status: 'failed' })] })]);

    const { testData } = combineExportBundles(a, b);

    const names = testData.suites.map((s) => s.name).sort();
    expect(names).toEqual(['OnlyInA', 'OnlyInB']);
    expect(testData.summary.total).toBe(2);
    expect(testData.summary.failed).toBe(2);
  });

  it('merges progress maps from both bundles without collisions', () => {
    const a = bundle(
      [suite({ name: 'S', testcases: [tc({ name: 'f1', status: 'failed' })] })],
      { 'S-f1': { id: 'S-f1', name: 'f1', suite: 'S', status: 'completed' } },
    );
    const b = bundle(
      [suite({ name: 'S', testcases: [tc({ name: 'f2', status: 'failed' })] })],
      { 'S-f2': { id: 'S-f2', name: 'f2', suite: 'S', status: 'in_progress' } },
    );

    const { progress } = combineExportBundles(a, b);

    expect(Object.keys(progress).sort()).toEqual(['S-f1', 'S-f2']);
    expect(progress['S-f1'].status).toBe('completed');
    expect(progress['S-f2'].status).toBe('in_progress');
  });

  it('warns when both bundles contain identical test data', () => {
    const shared = bundle([suite({ name: 'S', testcases: [tc({ name: 'f', status: 'failed' })] })]);

    const { warnings } = combineExportBundles(shared, shared);

    expect(warnings).toContainEqual(expect.stringMatching(/identical/i));
  });

  it('warns and prefers the failed version when the same test has conflicting status between files', () => {
    const a = bundle([suite({ name: 'S', testcases: [tc({ name: 'flaky', status: 'passed' })] })]);
    const b = bundle([suite({ name: 'S', testcases: [tc({ name: 'flaky', status: 'failed' })] })]);

    const { testData, warnings } = combineExportBundles(a, b);

    expect(warnings).toContainEqual(expect.stringMatching(/different status/i));
    expect(testData.suites[0].testcases).toHaveLength(1);
    expect(testData.suites[0].testcases[0].status).toBe('failed');
  });

  it('sums failures/errors from each side rather than re-deriving them from testcase status', () => {
    const a = bundle([
      { ...suite({ name: 'S', testcases: [tc({ name: 'e1', status: 'failed' })] }), failures: 0, errors: 1 },
    ]);
    const b = bundle([
      { ...suite({ name: 'S', testcases: [tc({ name: 'f1', status: 'failed' })] }), failures: 1, errors: 0 },
    ]);

    const { testData } = combineExportBundles(a, b);

    expect(testData.suites[0].failures).toBe(1);
    expect(testData.suites[0].errors).toBe(1);
    expect(testData.summary.failed).toBe(2);
  });
});
