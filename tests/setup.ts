import '@testing-library/jest-dom/vitest'

// jsdom has no ResizeObserver; Radix (Slider) measures elements with it.
// Assigned, not vi.stubGlobal: tests call vi.unstubAllGlobals() for their own stubs.
globalThis.ResizeObserver = class {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
