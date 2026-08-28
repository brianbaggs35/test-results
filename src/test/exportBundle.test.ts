import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { buildExportBundle, exportProgressBundle, readExportBundle, importProgressBundle } from '../utils/exportBundle';
import type { TestData } from '../types';

const testData: TestData = {
  summary: { total: 1, passed: 0, failed: 1, skipped: 0, flaky: 0, time: 1 },
  suites: [
    {
      name: 'S',
      tests: 1,
      failures: 1,
      errors: 0,
      skipped: 0,
      time: 1,
      timestamp: '2024-01-01T00:00:00Z',
      testcases: [{ name: 'f1', status: 'failed', classname: 'C', time: 1 }],
    },
  ],
};

const progress = { 'S-f1': { id: 'S-f1', name: 'f1', suite: 'S', testStatus: 'failed' as const, status: 'pending' as const } };

const otherTestData: TestData = {
  summary: { total: 1, passed: 0, failed: 1, skipped: 0, flaky: 0, time: 1 },
  suites: [
    {
      name: 'Z',
      tests: 1,
      failures: 1,
      errors: 0,
      skipped: 0,
      time: 1,
      timestamp: '2024-01-01T00:00:00Z',
      testcases: [{ name: 'z1', status: 'failed', classname: 'Z', time: 1 }],
    },
  ],
};

describe('buildExportBundle', () => {
  it('wraps testData and progress with a version marker and a structure fingerprint', async () => {
    const bundle = await buildExportBundle(testData, progress);
    expect(bundle).toEqual({ version: 1, testData, progress, structureHash: expect.any(String) });
  });

  it('produces the same structureHash for the same suite/test names regardless of outcome, timing, or summary counts', async () => {
    // Same suite/test identity as `testData`, but every outcome-ish field differs:
    // status flipped to passed, timings and timestamp changed, and different summary totals.
    const rerun: TestData = {
      summary: { total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, time: 99 },
      suites: [
        {
          name: 'S',
          tests: 1,
          failures: 0,
          errors: 0,
          skipped: 0,
          time: 99,
          timestamp: '2025-06-01T00:00:00Z',
          testcases: [{ name: 'f1', status: 'passed', classname: 'C', time: 99 }],
        },
      ],
    };

    const original = await buildExportBundle(testData, progress);
    const rerunBundle = await buildExportBundle(rerun, {});

    expect(rerunBundle.structureHash).toBe(original.structureHash);
  });

  it('produces a different structureHash when suite/test names differ', async () => {
    const a = await buildExportBundle(testData, progress);
    const b = await buildExportBundle(otherTestData, progress);

    expect(a.structureHash).not.toBe(b.structureHash);
  });

  it('does not collide when suite/test name boundaries are ambiguous under naive concatenation', async () => {
    // Suite "A-B" + test "C" vs. suite "A" + test "B-C" would both naively
    // concatenate to "A-B-C" if joined with a plain delimiter — the hash must
    // tell them apart.
    const suiteABtestC: TestData = {
      summary: { total: 1, passed: 0, failed: 1, skipped: 0, flaky: 0, time: 1 },
      suites: [
        {
          name: 'A-B',
          tests: 1,
          failures: 1,
          errors: 0,
          skipped: 0,
          time: 1,
          timestamp: '2024-01-01T00:00:00Z',
          testcases: [{ name: 'C', status: 'failed', time: 1 }],
        },
      ],
    };
    const suiteAtestBC: TestData = {
      summary: { total: 1, passed: 0, failed: 1, skipped: 0, flaky: 0, time: 1 },
      suites: [
        {
          name: 'A',
          tests: 1,
          failures: 1,
          errors: 0,
          skipped: 0,
          time: 1,
          timestamp: '2024-01-01T00:00:00Z',
          testcases: [{ name: 'B-C', status: 'failed', time: 1 }],
        },
      ],
    };

    const bundleABtestC = await buildExportBundle(suiteABtestC, {});
    const bundleAtestBC = await buildExportBundle(suiteAtestBC, {});

    expect(bundleABtestC.structureHash).not.toBe(bundleAtestBC.structureHash);
  });

  it('produces a different structureHash for two tests that share a name but differ by classname', async () => {
    // Regression test: the hash used to fingerprint only (suite, test name),
    // so a suite with two same-named tests from different classes looked
    // structurally identical to one with only a single test of that name.
    const oneClass: TestData = {
      summary: { total: 1, passed: 0, failed: 1, skipped: 0, flaky: 0, time: 1 },
      suites: [
        {
          name: 'S',
          tests: 1,
          failures: 1,
          errors: 0,
          skipped: 0,
          time: 1,
          timestamp: '2024-01-01T00:00:00Z',
          testcases: [{ name: 'test1', classname: 'ClassA', status: 'failed', time: 1 }],
        },
      ],
    };
    const otherClass: TestData = {
      summary: { total: 1, passed: 0, failed: 1, skipped: 0, flaky: 0, time: 1 },
      suites: [
        {
          name: 'S',
          tests: 1,
          failures: 1,
          errors: 0,
          skipped: 0,
          time: 1,
          timestamp: '2024-01-01T00:00:00Z',
          testcases: [{ name: 'test1', classname: 'ClassB', status: 'failed', time: 1 }],
        },
      ],
    };

    const bundleA = await buildExportBundle(oneClass, {});
    const bundleB = await buildExportBundle(otherClass, {});

    expect(bundleA.structureHash).not.toBe(bundleB.structureHash);
  });
});

describe('exportProgressBundle', () => {
  let createObjectURLSpy: Mock<(obj: Blob | MediaSource) => string>;
  let revokeObjectURLSpy: Mock<(url: string) => void>;
  let clickSpy: Mock<() => void>;

  beforeEach(() => {
    createObjectURLSpy = vi.fn<(obj: Blob | MediaSource) => string>(() => 'blob:mock-url');
    revokeObjectURLSpy = vi.fn<(url: string) => void>();
    vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectURLSpy, revokeObjectURL: revokeObjectURLSpy });
    clickSpy = vi.fn<() => void>();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('triggers a download of the bundle as JSON', async () => {
    await exportProgressBundle(testData, progress);

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });
});

describe('readExportBundle', () => {
  it('parses a valid bundle file', async () => {
    const bundle = await buildExportBundle(testData, progress);
    const file = new File([JSON.stringify(bundle)], 'export.json', { type: 'application/json' });

    await expect(readExportBundle(file)).resolves.toEqual(bundle);
  });

  it('rejects a file that is not valid JSON', async () => {
    const file = new File(['not json'], 'export.json');

    await expect(readExportBundle(file)).rejects.toThrow(/not valid JSON/);
  });

  it('rejects valid JSON that is missing testData/progress', async () => {
    const file = new File([JSON.stringify({ foo: 'bar' })], 'export.json');

    await expect(readExportBundle(file)).rejects.toThrow(/doesn't look like/);
  });
});

describe('importProgressBundle', () => {
  const currentProgress = {
    'S-f1': { id: 'S-f1', name: 'f1', suite: 'S', testStatus: 'failed' as const, status: 'pending' as const, errorMessage: 'current error' },
  };

  it('applies status/notes/assignee from the file onto matching current entries, keeping identity fields from the loaded XML', async () => {
    const importedBundle = await buildExportBundle(testData, {
      'S-f1': {
        id: 'S-f1',
        name: 'stale-name',
        suite: 'stale-suite',
        errorMessage: 'stale error',
        testStatus: 'failed',
        status: 'completed',
        notes: 'fixed it',
        assignee: 'Alice',
        updatedAt: '2024-02-02T00:00:00Z',
      },
      'S-f2': { id: 'S-f2', name: 'f2', suite: 'S', testStatus: 'failed', status: 'pending' },
    });
    const file = new File([JSON.stringify(importedBundle)], 'export.json');

    const result = await importProgressBundle(file, testData, currentProgress);

    expect(result.matchedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.progress['S-f1']).toEqual({
      id: 'S-f1',
      name: 'f1',
      suite: 'S',
      errorMessage: 'current error',
      testStatus: 'failed',
      status: 'completed',
      notes: 'fixed it',
      assignee: 'Alice',
      updatedAt: '2024-02-02T00:00:00Z',
    });
    expect(result.progress['S-f2']).toBeUndefined();
  });

  it('leaves entries with no matching id in the file untouched', async () => {
    const currentWithExtra = {
      ...currentProgress,
      'S-other': { id: 'S-other', name: 'other', suite: 'S', testStatus: 'failed' as const, status: 'in_progress' as const },
    };
    const importedBundle = await buildExportBundle(testData, {
      'S-f1': { id: 'S-f1', name: 'f1', suite: 'S', testStatus: 'failed' as const, status: 'completed' as const },
    });
    const file = new File([JSON.stringify(importedBundle)], 'export.json');

    const result = await importProgressBundle(file, testData, currentWithExtra);

    expect(result.progress['S-other']).toEqual(currentWithExtra['S-other']);
  });

  it('rejects a file whose tests do not overlap the currently loaded XML at all', async () => {
    const importedBundle = await buildExportBundle(otherTestData, {
      'Z-z1': { id: 'Z-z1', name: 'z1', suite: 'Z', testStatus: 'failed', status: 'completed' },
    });
    const file = new File([JSON.stringify(importedBundle)], 'export-a.json');

    await expect(importProgressBundle(file, testData, currentProgress)).rejects.toThrow(
      /doesn't match the currently loaded results/,
    );
  });

  it('does not reject when at least one test overlaps, even if others do not', async () => {
    const mixedTestData: TestData = {
      summary: { total: 2, passed: 0, failed: 2, skipped: 0, flaky: 0, time: 2 },
      suites: [...testData.suites, ...otherTestData.suites],
    };
    const importedBundle = await buildExportBundle(mixedTestData, {
      'S-f1': { id: 'S-f1', name: 'f1', suite: 'S', testStatus: 'failed', status: 'completed' },
      'Z-z1': { id: 'Z-z1', name: 'z1', suite: 'Z', testStatus: 'failed', status: 'completed' },
    });
    const file = new File([JSON.stringify(importedBundle)], 'export.json');

    const result = await importProgressBundle(file, testData, currentProgress);

    expect(result.matchedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
  });

  it('accepts a rerun of the same suite (same names, different outcomes/timing/summary) via the structure hash', async () => {
    const rerunTestData: TestData = {
      summary: { total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, time: 99 },
      suites: [
        {
          name: 'S',
          tests: 1,
          failures: 0,
          errors: 0,
          skipped: 0,
          time: 99,
          timestamp: '2025-06-01T00:00:00Z',
          testcases: [{ name: 'f1', status: 'passed', classname: 'C', time: 99 }],
        },
      ],
    };
    const importedBundle = await buildExportBundle(testData, {
      'S-f1': { id: 'S-f1', name: 'f1', suite: 'S', testStatus: 'failed', status: 'completed', notes: 'fixed', assignee: 'Bob' },
    });
    const file = new File([JSON.stringify(importedBundle)], 'export.json');

    const result = await importProgressBundle(file, rerunTestData, currentProgress);

    expect(result.matchedCount).toBe(1);
    expect(result.progress['S-f1'].notes).toBe('fixed');
  });

  it('falls back to the overlap check for exports made before structureHash existed', async () => {
    const legacyBundle = {
      version: 1 as const,
      testData,
      progress: { 'S-f1': { id: 'S-f1', name: 'f1', suite: 'S', testStatus: 'failed' as const, status: 'completed' as const } },
    };
    const file = new File([JSON.stringify(legacyBundle)], 'export.json');

    const result = await importProgressBundle(file, testData, currentProgress);

    expect(result.matchedCount).toBe(1);
  });

  it('rejects a legacy export (no structureHash) with no overlapping tests', async () => {
    const legacyBundle = {
      version: 1 as const,
      testData: otherTestData,
      progress: { 'Z-z1': { id: 'Z-z1', name: 'z1', suite: 'Z', testStatus: 'failed' as const, status: 'completed' as const } },
    };
    const file = new File([JSON.stringify(legacyBundle)], 'export.json');

    await expect(importProgressBundle(file, testData, currentProgress)).rejects.toThrow(
      /doesn't match the currently loaded results/,
    );
  });

  it('rejects a file that is not valid JSON', async () => {
    const file = new File(['not json'], 'export.json');

    await expect(importProgressBundle(file, testData, currentProgress)).rejects.toThrow(/not valid JSON/);
  });

  it('rejects valid JSON that is missing testData/progress', async () => {
    const file = new File([JSON.stringify({ foo: 'bar' })], 'export.json');

    await expect(importProgressBundle(file, testData, currentProgress)).rejects.toThrow(/doesn't look like/);
  });
});
