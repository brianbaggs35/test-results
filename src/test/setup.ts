import '@testing-library/jest-dom';

// Global test configuration
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => { /* mock implementation */ },
    removeListener: () => { /* mock implementation */ },
    addEventListener: () => { /* mock implementation */ },
    removeEventListener: () => { /* mock implementation */ },
    dispatchEvent: () => { /* mock implementation */ },
  }),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() { /* mock implementation */ }
  unobserve() { /* mock implementation */ }
  disconnect() { /* mock implementation */ }
};

// Mock localStorage
const localStorageMock = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => { /* mock implementation */ },
  removeItem: (_key: string) => { /* mock implementation */ },
  clear: () => { /* mock implementation */ },
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});