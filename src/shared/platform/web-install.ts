import type { PlatformInstall } from './platform-adapter'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

/** The browser event is not in the DOM types; this is the shape Chromium sends. */
const isInstallPrompt = (event: Event): event is BeforeInstallPromptEvent =>
  'prompt' in event &&
  'userChoice' in event &&
  typeof event.prompt === 'function' &&
  typeof event.userChoice === 'object'

const isStandalone = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  ) {
    return true
  }
  return 'standalone' in navigator && navigator.standalone === true
}

/**
 * The install prompt is a one-shot event the browser fires when the app meets
 * its criteria. It can fire before React renders, so the event is kept at module
 * level and components subscribe to changes; `prompt()` spends it.
 */
let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

const notify = () => {
  for (const listener of listeners) {
    listener()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    if (!isInstallPrompt(event)) {
      return
    }
    event.preventDefault()
    deferred = event
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

export const createWebInstall = (): PlatformInstall => ({
  isSupported: () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  canPrompt: () => deferred !== null,
  isInstalled: isStandalone,
  async prompt() {
    if (!deferred) {
      throw new DOMException('The install prompt is not available', 'NotSupportedError')
    }
    const event = deferred
    deferred = null
    await event.prompt()
    const choice = await event.userChoice
    notify()
    return choice.outcome
  },
  onChange(listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
})
