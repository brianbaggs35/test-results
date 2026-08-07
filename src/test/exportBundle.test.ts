import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildExportBundle, exportProgressBundle, readExportBundle } from '../utils/exportBundle';
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

const progress = { 'S-f1': { id: 'S-f1', name: 'f1', suite: 'S', status: 'pending' as const } };

describe('buildExportBundle', () => {
  it('wraps testData and progress with a version marker', () => {
    expect(buildExportBundle(testData, progress)).toEqual({ version: 1, testData, progress });
  });
});

describe('exportProgressBundle', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLSpy = vi.fn(() => 'blob:mock-url');
    revokeObjectURLSpy = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectURLSpy, revokeObjectURL: revokeObjectURLSpy });
    clickSpy = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('triggers a download of the bundle as JSON', () => {
    exportProgressBundle(testData, progress);

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });
});

describe('readExportBundle', () => {
  it('parses a valid bundle file', async () => {
    const bundle = buildExportBundle(testData, progress);
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
