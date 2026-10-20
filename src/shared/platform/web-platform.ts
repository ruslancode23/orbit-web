import { createWebInstall } from './web-install'

import type { NotificationPermissionState, PlatformAdapter } from './platform-adapter'

// Same cap livekit-client applies to its own screen capture (ScreenSharePresets.h1080fps30):
// an uncapped 4K screen encodes slowly and drops the bitrate.
const SCREEN_VIDEO: MediaTrackConstraints = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: 30,
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

    install: createWebInstall(),

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
