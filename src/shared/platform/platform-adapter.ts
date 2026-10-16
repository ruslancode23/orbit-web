/**
 * Everything the app needs from the operating system (PRD 11.0). The browser build uses
 * `createWebPlatform()`; the Tauri build will provide its own implementation of the same interface.
 * Features reach the OS only through `getPlatform()`, never through browser or Tauri APIs directly.
 *
 * Errors follow the browser's DOMException names on every platform, so callers handle one set:
 * `NotAllowedError` (the user refused or closed the picker), `NotFoundError`, `NotSupportedError`.
 */
export interface PlatformAdapter {
  notifications: PlatformNotifications
  mediaDevices: PlatformMediaDevices
  screenCapture: PlatformScreenCapture
  autostart: PlatformAutostart
}

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

export interface PlatformNotification {
  title: string
  body?: string
}

export interface PlatformNotifications {
  permission: () => NotificationPermissionState
  requestPermission: () => Promise<NotificationPermissionState>
  /** Shows a system notification; does nothing without permission. */
  show: (notification: PlatformNotification) => void
}

/**
 * Microphones, cameras and speakers. Capturing the microphone stays inside livekit-client
 * (see docs/adr/0004-platform-adapter.md); the adapter lists devices for choosing one.
 */
export interface PlatformMediaDevices {
  list: (kind: MediaDeviceKind) => Promise<MediaDeviceInfo[]>
  /** Calls `listener` when a device is plugged in or removed; returns the unsubscribe function. */
  onChange: (listener: () => void) => () => void
}

export interface ScreenCaptureOptions {
  /** Ask for system or tab audio too; the user or the platform may still leave it out. */
  audio: boolean
}

export interface ScreenCapture {
  video: MediaStreamTrack
  audio: MediaStreamTrack | null
}

export interface PlatformScreenCapture {
  isSupported: () => boolean
  /** Lets the user pick a window or a screen. The video track ends when the user stops sharing from the OS. */
  capture: (options: ScreenCaptureOptions) => Promise<ScreenCapture>
}

/** Launch at OS login. Only the desktop app supports it. */
export interface PlatformAutostart {
  isSupported: () => boolean
  isEnabled: () => Promise<boolean>
  setEnabled: (enabled: boolean) => Promise<void>
}
