import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { createTauriPlatform, setPlatform } from '@/shared/platform'
import { registerServiceWorker } from '@/shared/pwa'

import { App } from './App'
import '../styles/index.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element #root not found')
}

/** Tauri injects this object into every page it owns; a browser page has no such thing. */
const isDesktop = '__TAURI_INTERNALS__' in window

/**
 * The desktop adapter is installed before the first render, so the very first notification or
 * autostart check already goes through the shell. In a browser nothing is awaited.
 */
const installPlatform = async (): Promise<void> => {
  if (isDesktop) {
    setPlatform(await createTauriPlatform())
  }
}

void installPlatform().finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  // The worker makes the installed web app work offline; the desktop window always loads the
  // last deployed build and has no business caching it.
  if (!isDesktop) {
    registerServiceWorker()
  }
})
