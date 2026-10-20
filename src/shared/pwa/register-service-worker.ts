/**
 * Registers the service worker that keeps the app shell for offline starts.
 * Development is left alone: Vite serves modules from source, and a worker
 * caching them would hide changes and keep stale code.
 */
export const registerServiceWorker = (): void => {
  if (!import.meta.env.PROD || typeof navigator === 'undefined') {
    return
  }
  if (!('serviceWorker' in navigator)) {
    return
  }
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}
