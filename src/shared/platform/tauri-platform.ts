import { getTauriVersion, getVersion } from '@tauri-apps/api/app'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import {
  isPermissionGranted,
  onAction,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { arch, platform, version as osVersion } from '@tauri-apps/plugin-os'

import { createWebPlatform } from './web-platform'

import type {
  NotificationPermissionState,
  PlatformAdapter,
  PlatformAutostart,
  PlatformInstall,
  PlatformNotifications,
  PlatformPush,
} from './platform-adapter'

/**
 * PlatformAdapter on the desktop shell (ADR-0004, DESK-3).
 *
 * Everything that the WebView already does like a browser — microphones, screen capture, the
 * secret store — is taken from `createWebPlatform()` unchanged: the ADR keeps capture inside
 * livekit-client, and IndexedDB works in both WebViews. Only the four things a page cannot do
 * are replaced: system notifications, autostart, the OS description and "installation".
 *
 * The factory is async because three values are known only after talking to the shell: the app
 * version, the OS version and the notification permission. Resolving them before the first
 * render is what lets `permission()` and `system.describe()` stay synchronous.
 */
export async function createDesktopPlatform(): Promise<PlatformAdapter> {
  const web = createWebPlatform()

  // Desktop apps are not asked for permission up front: the plugin reports granted on every
  // desktop platform, and the OS decides at delivery time (System Settings can silence the app).
  let permission: NotificationPermissionState = (await isPermissionGranted())
    ? 'granted'
    : 'default'

  // A desktop notification has no `tag` of its own, so a tag (the channel) gets a stable numeric
  // id: the id comes back in the click event, which is how the adapter knows where the message
  // came from. The OS does not replace a notification by id on macOS or Windows, so a busy
  // channel stacks; grouping it would need a thread identifier the plugin does not pass on.
  const clickHandlers = new Map<number, () => void>()
  const idsByTag = new Map<string, number>()
  let nextId = 1

  const idOf = (tag: string | undefined): number => {
    if (tag === undefined) {
      return nextId++
    }
    const known = idsByTag.get(tag)
    if (known !== undefined) {
      return known
    }
    const id = nextId++
    idsByTag.set(tag, id)
    return id
  }

  // A click only reaches the app when the listener existed before the notification was shown,
  // so it is registered here and not on the first message.
  void onAction((performed) => {
    const id = performed.notification?.id
    const handler = id === undefined ? undefined : clickHandlers.get(id)
    void focusWindow()
      .then(() => handler?.())
      .catch(noop)
  }).catch((error: unknown) => {
    // Without the listener the OS still activates the app on a click; this is the fallback,
    // and a silent failure here would be invisible until someone expects a click to work.
    console.warn('Orbit: notification click listener was not registered', error)
  })

  const notifications: PlatformNotifications = {
    permission: () => permission,
    async requestPermission() {
      permission = toPermission(await requestPermission())
      return permission
    },
    show({ title, body, tag, onClick }) {
      if (permission !== 'granted') {
        return
      }
      const id = idOf(tag)
      if (onClick === undefined) {
        clickHandlers.delete(id)
      } else {
        clickHandlers.set(id, onClick)
      }
      try {
        // `group` groups the notifications in the system UI where the platform honours it;
        // `id` is what comes back on a click.
        sendNotification({ id, title, body, group: tag })
      } catch {
        // The OS refused at the last moment; the settings screen shows the permission state,
        // and a failed notification is not worth an error dialog over a message.
      }
    },
  }

  const autostart: PlatformAutostart = {
    isSupported: () => true,
    isEnabled: () => isEnabled(),
    async setEnabled(enabled) {
      await (enabled ? enable() : disable())
    },
  }

  // A desktop app is installed by definition; the PWA prompt has nothing to offer.
  const install: PlatformInstall = {
    isSupported: () => false,
    canPrompt: () => false,
    prompt: () =>
      Promise.reject(new DOMException('Orbit is already installed', 'NotSupportedError')),
    isInstalled: () => true,
    onChange: () => noop,
  }

  // Web Push needs a service worker; the desktop shell shows notifications natively (DESK-4).
  const push: PlatformPush = {
    isSupported: () => Promise.resolve(false),
    current: () => Promise.resolve(null),
    subscribe: () =>
      Promise.reject(
        new DOMException('Web Push is not used in the desktop app', 'NotSupportedError'),
      ),
    unsubscribe: () => Promise.resolve(),
    onOpen: () => noop,
  }

  const description = await describeSystem()

  return {
    ...web,
    notifications,
    autostart,
    install,
    push,
    system: { describe: () => description },
  }
}

/** Subscriptions that never fire: nothing on the desktop side raises these events. */
const noop = (): void => undefined

/**
 * Brings the window forward after a notification click. A minimised window would otherwise stay
 * in the Dock, which is exactly the state the notification was supposed to interrupt.
 */
const focusWindow = async (): Promise<void> => {
  const window = getCurrentWindow()
  await window.unminimize()
  await window.show()
  await window.setFocus()
}

/** The shell answers in its own words: `granted`, `denied` or `prompt`. */
const toPermission = (state: string): NotificationPermissionState => {
  switch (state) {
    case 'granted':
      return 'granted'
    case 'denied':
      return 'denied'
    default:
      return 'default'
  }
}

const OS_TITLES: Record<string, string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
}

/**
 * A line a developer can read in a bug report: the app, the OS and what runs the window.
 * The OS values are compile-time constants in the plugin, so only the two versions are awaited.
 */
const describeSystem = async (): Promise<string> => {
  const [appVersion, tauriVersion] = await Promise.all([getVersion(), getTauriVersion()])
  const name = platform()
  const os = OS_TITLES[name] ?? name
  return `Orbit ${appVersion} · ${os} ${osVersion()} · ${arch()} · Tauri ${tauriVersion}`
}
