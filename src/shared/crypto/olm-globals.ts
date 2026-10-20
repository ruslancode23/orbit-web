/**
 * libolm's emscripten bundle looks for `window.crypto` and, in a worker, where
 * `window` does not exist, falls back to Node's `crypto.randomBytes` — which a
 * browser build does not have. The worker has the same WebCrypto as the window,
 * so it is aliased before libolm is evaluated.
 */
if (
  !Reflect.has(globalThis, 'window') &&
  typeof WorkerGlobalScope !== 'undefined' &&
  globalThis instanceof WorkerGlobalScope
) {
  Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true })
}

export {}
