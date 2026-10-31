import { createWebInstall } from './web-install'
import { createWebPush } from './web-push'
import { createWebSecretStore } from './web-secret-store'

import type { NotificationPermissionState, PlatformAdapter } from './platform-adapter'

// Same cap livekit-client applies to its own screen capture (ScreenSharePresets.h1080fps30):
// an uncapped 4K screen encodes slowly and drops the bitrate.
const SCREEN_VIDEO: MediaTrackConstraints = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: 30,
}

/** The Badging API, optional in practice: lib.dom types it as always there. */
interface AppBadging {
  setAppBadge?: (value?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/** PlatformAdapter on browser APIs. Globals are read on each call, so tests can stub them. */
export function createWebPlatform(): PlatformAdapter {
  return {
    notifications: {
      permission: notificationPermission,
      async requestPermission() {
        if (!hasNotifications()) {
          return 'unsupported'
        }
        return Notification.requestPermission()
      },
      show({ title, body, tag, onClick }) {
        if (notificationPermission() !== 'granted') {
          return
        }
        const notification = new Notification(title, { body, tag })
        notification.addEventListener('click', () => {
          window.focus()
          notification.close()
          onClick?.()
        })
      },
    },

    mediaDevices: {
      async list(kind) {
        const devices = await requireMediaDevices().enumerateDevices()
        return devices.filter((device) => device.kind === kind)
      },
      onChange(listener) {
        // Without mediaDevices (insecure context) devices never change for the page.
        const devices = mediaDevicesOrNull()
        devices?.addEventListener('devicechange', listener)
        return () => {
          devices?.removeEventListener('devicechange', listener)
        }
      },
      async requestAccess() {
        try {
          const stream = await requireMediaDevices().getUserMedia({ audio: true })
          // The permission is what was asked for; the capture itself is not needed.
          for (const track of stream.getTracks()) {
            track.stop()
          }
          return true
        } catch {
          return false
        }
      },
      canSelectOutput() {
        return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype
      },
      async playTestSound(deviceId) {
        const context = new AudioContext()
        const element = new Audio()
        try {
          const oscillator = context.createOscillator()
          const gain = context.createGain()
          gain.gain.value = 0.08
          oscillator.frequency.value = 440
          oscillator.connect(gain)
          oscillator.start()
          gain.connect(context.destination)
          // Route through an element when the browser can target a speaker.
          if (deviceId !== null && 'setSinkId' in element) {
            const stream = context.createMediaStreamDestination()
            gain.connect(stream)
            element.srcObject = stream.stream
            await element.setSinkId(deviceId)
            await element.play()
          }
          await new Promise((resolve) => setTimeout(resolve, 400))
          oscillator.stop()
        } finally {
          element.pause()
          element.srcObject = null
          await context.close()
        }
      },
    },

    screenCapture: {
      isSupported: () => typeof mediaDevicesOrNull()?.getDisplayMedia === 'function',
      async capture({ audio }) {
        const devices = mediaDevicesOrNull()
        if (typeof devices?.getDisplayMedia !== 'function') {
          throw new DOMException('Screen capture is not supported', 'NotSupportedError')
        }
        const stream = await devices.getDisplayMedia({ video: SCREEN_VIDEO, audio })
        const [video] = stream.getVideoTracks()
        if (!video) {
          for (const track of stream.getTracks()) {
            track.stop()
          }
          throw new DOMException('The capture has no video track', 'NotFoundError')
        }
        return { video, audio: stream.getAudioTracks()[0] ?? null }
      },
    },

    badge: {
      set(count) {
        // Installed Chromium apps have an icon badge; a normal tab, Safari and Firefox do not,
        // even though lib.dom declares the methods as always present.
        const badging = navigator as unknown as AppBadging
        if (typeof badging.setAppBadge !== 'function') {
          return
        }
        const applied =
          count > 0 ? badging.setAppBadge(count) : (badging.clearAppBadge?.() ?? Promise.resolve())
        void applied.catch(() => undefined)
      },
    },

    install: createWebInstall(),

    secretStore: createWebSecretStore(),

    system: {
      describe: () => (typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent),
    },

    push: createWebPush(),

    autostart: {
      isSupported: () => false,
      isEnabled: () => Promise.resolve(false),
      setEnabled: () =>
        Promise.reject(new DOMException('Autostart needs the desktop app', 'NotSupportedError')),
    },
  }
}

function hasNotifications(): boolean {
  return typeof Notification !== 'undefined'
}

function notificationPermission(): NotificationPermissionState {
  return hasNotifications() ? Notification.permission : 'unsupported'
}

// navigator.mediaDevices is missing outside secure contexts (plain http on a LAN address).
function mediaDevicesOrNull(): MediaDevices | null {
  return typeof navigator !== 'undefined' && 'mediaDevices' in navigator
    ? navigator.mediaDevices
    : null
}

function requireMediaDevices(): MediaDevices {
  const devices = mediaDevicesOrNull()
  if (!devices) {
    throw new DOMException('Media devices are not available', 'NotSupportedError')
  }
  return devices
}
