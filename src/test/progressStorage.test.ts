import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncProgressStorageForNewXml, storeResultsHash, PROGRESS_STORAGE_PREFIX } from '../utils/progressStorage';
import { computeResultsHash } from '../utils/structureHash';
import { testIdentityKey } from '../utils/testIdentity';
import type { TestData } from '../types';

const RESULTS_HASH_KEY = `${PROGRESS_STORAGE_PREFIX}_resultsHash`;

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

// The very same results as `testData`, parsed again: the parser stamps a suite with "now"
// when its XML has no timestamp, and a suite's own aggregates are free to differ, so neither
// may make this look like a different file.
const reloadOfTestData: TestData = {
  summary: { total: 1, passed: 0, failed: 1, skipped: 0, flaky: 0, time: 1 },
  suites: [
    {
      name: 'S',
      tests: 1,
      failures: 1,
      errors: 0,
      skipped: 0,
      time: 1,
      timestamp: '2030-12-31T23:59:59Z',
      testcases: [{ name: 'f1', status: 'failed', classname: 'C', time: 1 }],
    },
  ],
};

// Same suite/test identity as `testData` — a new run of the same suite — but every outcome
// differs. This is a different file, so it must not inherit the previous run's progress.
const rerunOfTestData: TestData = {
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

const failingIdOfTestData = testIdentityKey('S', 'C', 'f1');
const failingIdOfOtherTestData = testIdentityKey('Z', 'Z', 'z1');

describe('syncProgressStorageForNewXml', () => {
  // Real in-memory localStorage — the global test-setup stub is an inert no-op
  // (getItem always returns null), which can't exercise compare-and-clear logic.
  const mockLocalStorage = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => mockLocalStorage.store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockLocalStorage.store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockLocalStorage.store[key];
    }),
    clear: vi.fn(() => {
      mockLocalStorage.store = {};
    }),
    get length() {
      return Object.keys(this.store).length;
    },
    key: vi.fn((index: number) => Object.keys(mockLocalStorage.store)[index] || null),
  };

  const originalObjectKeys = Object.keys;

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    Object.keys = vi.fn((obj) => {
      if (obj === localStorage) return Object.keys(mockLocalStorage.store);
      return originalObjectKeys(obj);
    });
    vi.clearAllMocks();
    mockLocalStorage.store = {};
  });

  afterEach(() => {
    Object.keys = originalObjectKeys;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not clear anything on first-ever load and starts tracking the hash', async () => {
    const result = await syncProgressStorageForNewXml(testData);

    expect(result).toEqual({ cleared: false });
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    expect(mockLocalStorage.store[RESULTS_HASH_KEY]).toEqual(expect.any(String));
  });

  it('does not clear existing progress when the very same XML loads again', async () => {
    await syncProgressStorageForNewXml(testData);
    mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = JSON.stringify({ 'S-f1': { status: 'in_progress' } });
    vi.clearAllMocks();

    const result = await syncProgressStorageForNewXml(reloadOfTestData);

    expect(result).toEqual({ cleared: false });
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBe(JSON.stringify({ 'S-f1': { status: 'in_progress' } }));
  });

  it('clears the previous progress when a new run of the same suite loads, even though every test name matches', async () => {
    // Regression: the stored fingerprint used to cover only which tests exist, so a fresh run
    // of the same suite looked like "the same XML" and kept the previous run's progress —
    // entries for tests that now pass, and none for the new failures.
    await syncProgressStorageForNewXml(testData);
    const hashBeforeRerun = mockLocalStorage.store[RESULTS_HASH_KEY];
    mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = JSON.stringify({ [failingIdOfTestData]: { status: 'completed' } });

    const result = await syncProgressStorageForNewXml(rerunOfTestData);

    expect(result).toEqual({ cleared: true });
    expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBeUndefined();
    expect(mockLocalStorage.store[RESULTS_HASH_KEY]).toEqual(expect.any(String));
    expect(mockLocalStorage.store[RESULTS_HASH_KEY]).not.toBe(hashBeforeRerun);
  });

  it('clears every testFixProgress* key when a materially different XML loads', async () => {
    await syncProgressStorageForNewXml(testData);
    mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = JSON.stringify({ 'S-f1': { status: 'completed' } });
    mockLocalStorage.store[`${PROGRESS_STORAGE_PREFIX}_extra`] = 'anything';
    mockLocalStorage.store['unrelatedKey'] = 'shouldSurvive';

    const result = await syncProgressStorageForNewXml(otherTestData);

    expect(result).toEqual({ cleared: true });
    expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBeUndefined();
    expect(mockLocalStorage.store[`${PROGRESS_STORAGE_PREFIX}_extra`]).toBeUndefined();
    expect(mockLocalStorage.store['unrelatedKey']).toBe('shouldSurvive');
    // The hash key itself gets removed by the sweep, then rewritten to the new hash.
    expect(mockLocalStorage.store[RESULTS_HASH_KEY]).toEqual(expect.any(String));
  });

  it('keeps tracking the newest file, so loading the previous one again is detected as a change', async () => {
    await syncProgressStorageForNewXml(testData);
    await syncProgressStorageForNewXml(otherTestData);
    mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = JSON.stringify({ [failingIdOfOtherTestData]: { status: 'pending' } });

    const result = await syncProgressStorageForNewXml(testData);

    expect(result).toEqual({ cleared: true });
    expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBeUndefined();
  });

  it('does not throw and leaves storage untouched for data with no suites', async () => {
    mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = 'shouldSurvive';

    const result = await syncProgressStorageForNewXml({ combined: true } as unknown as TestData);

    expect(result).toEqual({ cleared: false });
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBe('shouldSurvive');
  });

  describe('progress with no results hash on record (saved before hashes covered results)', () => {
    it('keeps progress that tracks exactly this file’s failures, and starts tracking its hash', async () => {
      const progress = JSON.stringify({ [failingIdOfTestData]: { status: 'in_progress' } });
      mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = progress;

      const result = await syncProgressStorageForNewXml(testData);

      expect(result).toEqual({ cleared: false });
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
      expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBe(progress);
      expect(mockLocalStorage.store[RESULTS_HASH_KEY]).toEqual(expect.any(String));
    });

    it('clears progress that tracks different failures than this file has', async () => {
      // The user's stale progress from before the fix: a legacy structure hash may be on
      // record, but nothing says which results this progress was seeded from.
      mockLocalStorage.store[`${PROGRESS_STORAGE_PREFIX}_structureHash`] = 'legacy';
      mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = JSON.stringify({
        [failingIdOfTestData]: { status: 'completed' },
        [failingIdOfOtherTestData]: { status: 'pending' },
      });

      const result = await syncProgressStorageForNewXml(testData);

      expect(result).toEqual({ cleared: true });
      expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBeUndefined();
      expect(mockLocalStorage.store[`${PROGRESS_STORAGE_PREFIX}_structureHash`]).toBeUndefined();
      expect(mockLocalStorage.store[RESULTS_HASH_KEY]).toEqual(expect.any(String));
    });

    it('clears progress that is missing one of this file’s failures', async () => {
      const twoFailures: TestData = {
        ...testData,
        suites: [
          {
            ...testData.suites[0],
            testcases: [...testData.suites[0].testcases, { name: 'f2', status: 'failed', classname: 'C', time: 1 }],
          },
        ],
      };
      mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = JSON.stringify({ [failingIdOfTestData]: { status: 'pending' } });

      const result = await syncProgressStorageForNewXml(twoFailures);

      expect(result).toEqual({ cleared: true });
      expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBeUndefined();
    });

    it('treats flaky tests as tracked, like the Progress tab does', async () => {
      const withFlaky: TestData = {
        ...testData,
        suites: [
          {
            ...testData.suites[0],
            testcases: [
              ...testData.suites[0].testcases,
              { name: 'wobbly', status: 'flaky', classname: 'C', time: 1 },
              { name: 'fine', status: 'passed', classname: 'C', time: 1 },
            ],
          },
        ],
      };
      const progress = JSON.stringify({
        [failingIdOfTestData]: { status: 'pending' },
        [testIdentityKey('S', 'C', 'wobbly')]: { status: 'pending' },
      });
      mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = progress;

      const result = await syncProgressStorageForNewXml(withFlaky);

      expect(result).toEqual({ cleared: false });
      expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBe(progress);
    });

    it('keeps empty progress for a file with no failures', async () => {
      mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = '{}';

      const result = await syncProgressStorageForNewXml(rerunOfTestData);

      expect(result).toEqual({ cleared: false });
      expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBe('{}');
    });

    it.each(['not json', 'null', '42'])('leaves progress it cannot make sense of (%s) untouched', async (unreadable) => {
      mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = unreadable;

      const result = await syncProgressStorageForNewXml(testData);

      expect(result).toEqual({ cleared: false });
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
      expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBe(unreadable);
    });
  });

  describe('when SubtleCrypto is unavailable', () => {
    beforeEach(() => {
      vi.stubGlobal('crypto', { subtle: undefined });
    });

    it('does not throw and leaves unreadable progress untouched', async () => {
      mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = 'shouldSurvive';

      const result = await syncProgressStorageForNewXml(otherTestData);

      expect(result).toEqual({ cleared: false });
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
      expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBe('shouldSurvive');
    });

    it('still keeps progress that tracks exactly this file’s failures, without recording a hash', async () => {
      const progress = JSON.stringify({ [failingIdOfTestData]: { status: 'in_progress' } });
      mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = progress;

      const result = await syncProgressStorageForNewXml(testData);

      expect(result).toEqual({ cleared: false });
      expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBe(progress);
      expect(mockLocalStorage.store[RESULTS_HASH_KEY]).toBeUndefined();
    });

    it('still clears progress that tracks different failures than this file has', async () => {
      mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = JSON.stringify({ [failingIdOfTestData]: { status: 'completed' } });

      const result = await syncProgressStorageForNewXml(otherTestData);

      expect(result).toEqual({ cleared: true });
      expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBeUndefined();
      expect(mockLocalStorage.store[RESULTS_HASH_KEY]).toBeUndefined();
    });
  });
});

describe('storeResultsHash', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('records the hash of the given results under the key the sync reads', async () => {
    await storeResultsHash(testData);

    expect(store[RESULTS_HASH_KEY]).toBe(await computeResultsHash(testData));
  });

  it('records nothing when SubtleCrypto is unavailable', async () => {
    vi.stubGlobal('crypto', { subtle: undefined });

    await storeResultsHash(testData);

    expect(store[RESULTS_HASH_KEY]).toBeUndefined();
  });
});
