import '@testing-library/jest-dom/vitest'

// jsdom has no ResizeObserver; Radix (Slider) measures elements with it.
// Assigned, not vi.stubGlobal: tests call vi.unstubAllGlobals() for their own stubs.
globalThis.ResizeObserver = class {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

// jsdom has no pointer capture; Radix Toast (and other primitives) ask for it on drag.
// Assigned on the prototype, where the browser keeps them.
Object.assign(Element.prototype, {
  hasPointerCapture: () => false,
  setPointerCapture: () => undefined,
  releasePointerCapture: () => undefined,
})
