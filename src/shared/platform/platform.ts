import { createWebPlatform } from './web-platform'

import type { PlatformAdapter } from './platform-adapter'

let current: PlatformAdapter | null = null

/** The adapter for the platform the app runs on. Defaults to the browser one. */
export function getPlatform(): PlatformAdapter {
  current ??= createWebPlatform()
  return current
}

/**
 * Replaces the adapter: the desktop entrypoint installs the Tauri one before rendering,
 * tests install a fake. `null` goes back to the default.
 */
export function setPlatform(adapter: PlatformAdapter | null): void {
  current = adapter
}
