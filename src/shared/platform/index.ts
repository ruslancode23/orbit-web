export { getPlatform, setPlatform } from './platform'
export type {
  NotificationPermissionState,
  PlatformAdapter,
  PlatformAutostart,
  PlatformBadge,
  PlatformInstall,
  PlatformLinks,
  PlatformMediaDevices,
  PlatformNotification,
  PlatformNotifications,
  PlatformPush,
  PlatformPushToTalk,
  PlatformScreenCapture,
  PlatformSecretStore,
  PlatformSystem,
  PushSubscriptionData,
  ScreenCapture,
  ScreenCaptureOptions,
} from './platform-adapter'
export { createWebPlatform } from './web-platform'
export { deepLinkPath } from './deep-link'
export {
  DEFAULT_SCREEN_SHARE_QUALITY,
  screenContentHint,
  screenVideoConstraints,
  type ScreenShareQuality,
} from './screen-quality'
export { createWebSecretStore } from './web-secret-store'

import type { PlatformAdapter } from './platform-adapter'

/**
 * The desktop implementation, loaded only when the app runs inside the Tauri shell.
 *
 * A static import would put `@tauri-apps/*` into the browser bundle and read Tauri internals
 * that do not exist there; a dynamic one keeps it in a chunk the browser never requests.
 */
export async function createTauriPlatform(): Promise<PlatformAdapter> {
  const { createDesktopPlatform } = await import('./tauri-platform')
  return createDesktopPlatform()
}
