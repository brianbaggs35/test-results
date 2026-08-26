import '@testing-library/jest-dom/vitest'

// Suppress expected console messages in tests
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

console.error = (...args: unknown[]) => {
  const message = args.join(' ')

  // Filter out expected test error messages
  if (
    message.includes('Error parsing XML:') ||
    message.includes('Error in PDF generation:') ||
    message.includes('PDF Generation failed:') ||
    message.includes('Could not access localStorage in PDF context:') ||
    message.includes('The width(0) and height(0) of chart should be greater than 0') ||
    message.includes('Error parsing file:') ||
    message.includes('An update to Animate inside a test was not wrapped in act(') ||
    message.includes('In HTML, <button> cannot be a descendant of <button>')
  ) {
    return
  }

  originalConsoleError(...args)
}

console.warn = (...args: unknown[]) => {
  const message = args.join(' ')

  // Filter out expected test warning messages
  if (
    message.includes('PDF preview frame not found, falling back to regular preview') ||
    message.includes('Large dataset detected') ||
    message.includes('Very large dataset detected') ||
    message.includes('The width(0) and height(0) of chart should be greater than 0')
  ) {
    return
  }

  originalConsoleWarn(...args)
}

// Global test configuration
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {
      // Mock implementation
    },
    removeListener: () => {
      // Mock implementation
    },
    addEventListener: () => {
      // Mock implementation
    },
    removeEventListener: () => {
      // Mock implementation
    },
    dispatchEvent: () => {
      // Mock implementation
    },
  }),
})

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {
    // Mock implementation
  }

  unobserve() {
    // Mock implementation
  }

  disconnect() {
    // Mock implementation
  }
}

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root = null
  rootMargin = ''
  thresholds: ReadonlyArray<number> = []

  observe() {
    // Mock implementation
  }

  unobserve() {
    // Mock implementation
  }

  disconnect() {
    // Mock implementation
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
} as unknown as typeof IntersectionObserver

// Mock localStorage
const localStorageMock = {
  getItem: () => null,
  setItem: () => {
    // Mock implementation
  },
  removeItem: () => {
    // Mock implementation
  },
  clear: () => {
    // Mock implementation
  },
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock getBoundingClientRect to provide default dimensions for chart containers
Element.prototype.getBoundingClientRect = () => ({
  width: 400,
  height: 300,
  top: 0,
  left: 0,
  bottom: 300,
  right: 400,
  x: 0,
  y: 0,
  toJSON: () => ({}),
})
