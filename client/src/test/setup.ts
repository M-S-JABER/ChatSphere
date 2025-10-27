// Import test matchers from @testing-library/jest-dom
import { expect } from 'vitest'
import matchers from '@testing-library/jest-dom/matchers'
import { vi } from 'vitest'

// Extend Vitest's expect method with jest-dom matchers
expect.extend(matchers)

// Mock ResizeObserver which isn't available in test environment
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock window.matchMedia which isn't available in test environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Suppress console.error and console.warn in tests
const originalError = console.error
const originalWarn = console.warn

console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: ReactDOM.render is no longer supported')
  ) {
    return
  }
  originalError.call(console, ...args)
}

console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('componentWillReceiveProps') ||
    args[0].includes('componentWillUpdate') ||
    args[0].includes('componentWillMount')
  ) {
    return
  }
  originalWarn.call(console, ...args)
}