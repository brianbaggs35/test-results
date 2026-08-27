import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncProgressStorageForNewXml, PROGRESS_STORAGE_PREFIX } from '../utils/progressStorage';
import type { TestData } from '../types';

const testData: TestData = {
  summary: { total: 1, passed: 0, failed: 1, skipped: 0, time: 1 },
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

// Same suite/test identity as `testData`, but every outcome-ish field differs — a
// rerun of the same suite should still be treated as "the same XML".
const rerunOfTestData: TestData = {
  summary: { total: 1, passed: 1, failed: 0, skipped: 0, time: 99 },
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
  summary: { total: 1, passed: 0, failed: 1, skipped: 0, time: 1 },
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
    expect(mockLocalStorage.store[`${PROGRESS_STORAGE_PREFIX}_structureHash`]).toEqual(expect.any(String));
  });

  it('does not clear existing progress when the same XML (or a rerun of it) loads again', async () => {
    await syncProgressStorageForNewXml(testData);
    mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = JSON.stringify({ 'S-f1': { status: 'in_progress' } });
    vi.clearAllMocks();

    const result = await syncProgressStorageForNewXml(rerunOfTestData);

    expect(result).toEqual({ cleared: false });
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBe(JSON.stringify({ 'S-f1': { status: 'in_progress' } }));
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
    expect(mockLocalStorage.store[`${PROGRESS_STORAGE_PREFIX}_structureHash`]).toEqual(expect.any(String));
  });

  it('does not throw and leaves storage untouched for data with no suites', async () => {
    mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = 'shouldSurvive';

    const result = await syncProgressStorageForNewXml({ combined: true } as unknown as TestData);

    expect(result).toEqual({ cleared: false });
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBe('shouldSurvive');
  });

  it('does not throw and leaves storage untouched when SubtleCrypto is unavailable', async () => {
    vi.stubGlobal('crypto', { subtle: undefined });
    mockLocalStorage.store[PROGRESS_STORAGE_PREFIX] = 'shouldSurvive';

    const result = await syncProgressStorageForNewXml(otherTestData);

    expect(result).toEqual({ cleared: false });
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    expect(mockLocalStorage.store[PROGRESS_STORAGE_PREFIX]).toBe('shouldSurvive');
  });
});
