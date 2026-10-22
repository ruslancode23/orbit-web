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
  install: PlatformInstall
  /** Where secret chat keys and decrypted history live; never leaves the device. */
  secretStore: PlatformSecretStore
  system: PlatformSystem
}

/** What the app runs in, for a bug report: the browser and the OS, or the desktop shell. */
export interface PlatformSystem {
  /** A line a developer can read, such as the browser's user agent. */
  describe: () => string
}

/**
 * Device-local storage for secret chats. The browser build uses IndexedDB; the
 * desktop build will put the keys in the OS keychain (`docs/adr/0005`).
 *
 * Values are structured-cloned, so a `CryptoKey` survives a round trip on the
 * browser implementation and the decrypted text never leaves this store.
 */
export interface PlatformSecretStore {
  /** `fallback` is returned when nothing was stored yet. */
  get: <T>(scope: string, key: string, fallback: T | null) => Promise<T | null>
  /** Resolves with what was stored, so a caller can chain a write. */
  set: <T>(scope: string, key: string, value: T) => Promise<T>
  remove: (scope: string, key: string) => Promise<void>
  keys: (scope: string) => Promise<string[]>
  clear: (scope: string) => Promise<void>
}

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

export interface PlatformNotification {
  title: string
  body?: string
  /** Notifications with the same tag replace each other instead of piling up. */
  tag?: string
  /** Called when the person clicks the notification; the app window is focused first. */
  onClick?: () => void
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
  /**
   * Asks for microphone access so the device labels become visible. Returns
   * whether it was granted; a refusal is a choice, not an error.
   */
  requestAccess: () => Promise<boolean>
  /** Whether a chosen speaker can be used (`setSinkId`), as in Chrome and Edge. */
  canSelectOutput: () => boolean
  /** Plays a short tone through the chosen speakers; `null` means the system default. */
  playTestSound: (deviceId: string | null) => Promise<void>
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

/** Installing the web app to the home screen or desktop. */
export interface PlatformInstall {
  /** The browser can install web apps at all. */
  isSupported: () => boolean
  /** The browser offered an install prompt and nobody has used it yet. */
  canPrompt: () => boolean
  /** Runs the browser's prompt; resolves with what the person chose. */
  prompt: () => Promise<'accepted' | 'dismissed'>
  /** Already opened as an installed app. */
  isInstalled: () => boolean
  /** The prompt became available or was used, or the app was installed. */
  onChange: (listener: () => void) => () => void
}
