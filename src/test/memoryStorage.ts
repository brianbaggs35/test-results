import { vi } from 'vitest';

/** A working localStorage for tests (the global test setup replaces it with a no-op). */
export class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  /** Set to make the next writes fail like a full browser does. */
  failWrites: 'quota' | 'blocked' | null = null;

  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failWrites === 'quota') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    if (this.failWrites === 'blocked') throw new DOMException('Access is denied.', 'SecurityError');
    this.data.set(key, String(value));
  }
  [name: string]: unknown;
}

/** Installs a fresh MemoryStorage as localStorage for the current test; pair with `vi.unstubAllGlobals()` (or call again). */
export function installMemoryStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  return storage;
}
