import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileAsText, downloadFile } from '../utils/download';

describe('readFileAsText', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves with the file contents', async () => {
    const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });

    await expect(readFileAsText(file)).resolves.toBe('hello world');
  });

  it('resolves with an empty string when the reader reports no result', async () => {
    class FakeFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result: string | null = null;
      error: DOMException | null = null;
      readAsText() {
        this.onload?.();
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader);

    await expect(readFileAsText(new File(['x'], 'empty.txt'))).resolves.toBe('');
  });

  it('rejects with the reader error when one is available', async () => {
    const fakeError = new DOMException('boom');
    class FakeFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result: string | null = null;
      error: DOMException | null = fakeError;
      readAsText() {
        this.onerror?.();
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader);

    await expect(readFileAsText(new File(['x'], 'bad.txt'))).rejects.toBe(fakeError);
  });

  it('rejects with a fallback error when the reader reports no error object', async () => {
    class FakeFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result: string | null = null;
      error: DOMException | null = null;
      readAsText() {
        this.onerror?.();
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader);

    await expect(readFileAsText(new File(['x'], 'bad.txt'))).rejects.toThrow('Could not read "bad.txt"');
  });
});

describe('downloadFile', () => {
  it('creates an object URL, clicks a temporary link, and revokes the URL', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadFile('report.json', '{"a":1}', 'application/json');

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    clickSpy.mockRestore();
  });
});
