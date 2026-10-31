import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { createTauriPlatform, deepLinkPath, getPlatform, setPlatform } from '@/shared/platform'
import { registerServiceWorker } from '@/shared/pwa'

import { App } from './App'
import { router } from '../routes/router'
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

  // An invite opened from a browser lands on the invite page, whether or not someone is signed in.
  getPlatform().links.onOpen((url) => {
    const path = deepLinkPath(url)
    if (path !== null) {
      void router.navigate(path)
    }
  })
})
