import { createDesktopPlatform } from './tauri-platform'

interface ClickEvent {
  actionId: string
  inputValue: string | null
  notification: { id: number } | null
}

const shell = vi.hoisted(() => ({
  getVersion: vi.fn<() => Promise<string>>(),
  getTauriVersion: vi.fn<() => Promise<string>>(),
  isPermissionGranted: vi.fn<() => Promise<boolean>>(),
  requestPermission: vi.fn<() => Promise<'default' | 'denied' | 'granted'>>(),
  sendNotification: vi.fn(),
  isEnabled: vi.fn<() => Promise<boolean>>(),
  enable: vi.fn<() => Promise<void>>(),
  disable: vi.fn<() => Promise<void>>(),
  platform: vi.fn(() => 'macos'),
  version: vi.fn(() => '27.0'),
  arch: vi.fn(() => 'aarch64'),
  onAction: vi.fn<(callback: (event: ClickEvent) => void) => Promise<() => void>>(),
  unminimize: vi.fn<() => Promise<void>>(),
  show: vi.fn<() => Promise<void>>(),
  setFocus: vi.fn<() => Promise<void>>(),
}))

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: shell.getVersion,
  getTauriVersion: shell.getTauriVersion,
}))
vi.mock('@tauri-apps/plugin-autostart', () => ({
  isEnabled: shell.isEnabled,
  enable: shell.enable,
  disable: shell.disable,
}))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    unminimize: shell.unminimize,
    show: shell.show,
    setFocus: shell.setFocus,
  }),
}))
vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: shell.isPermissionGranted,
  onAction: shell.onAction,
  requestPermission: shell.requestPermission,
  sendNotification: shell.sendNotification,
}))
vi.mock('@tauri-apps/plugin-os', () => ({
  platform: shell.platform,
  version: shell.version,
  arch: shell.arch,
}))

beforeEach(() => {
  vi.clearAllMocks()
  shell.getVersion.mockResolvedValue('0.1.0')
  shell.getTauriVersion.mockResolvedValue('2.12.5')
  shell.isPermissionGranted.mockResolvedValue(true)
  shell.requestPermission.mockResolvedValue('granted')
  shell.isEnabled.mockResolvedValue(false)
  shell.enable.mockResolvedValue()
  shell.disable.mockResolvedValue()
  shell.platform.mockReturnValue('macos')
  shell.version.mockReturnValue('27.0')
  shell.arch.mockReturnValue('aarch64')
  shell.onAction.mockResolvedValue(() => undefined)
  shell.unminimize.mockResolvedValue()
  shell.show.mockResolvedValue()
  shell.setFocus.mockResolvedValue()
})

describe('desktop platform: system description', () => {
  it('names the app, the OS, the architecture and the shell', async () => {
    const platform = await createDesktopPlatform()

    expect(platform.system.describe()).toBe('Orbit 0.1.0 · macOS 27.0 · aarch64 · Tauri 2.12.5')
  })
})

describe('desktop platform: notifications', () => {
  it('reports granted when the OS already allowed them', async () => {
    const platform = await createDesktopPlatform()

    expect(platform.notifications.permission()).toBe('granted')
  })

  it('reports default while nothing was decided yet', async () => {
    shell.isPermissionGranted.mockResolvedValue(false)

    const platform = await createDesktopPlatform()

    expect(platform.notifications.permission()).toBe('default')
  })

  it('takes the answer from the request and remembers it', async () => {
    shell.isPermissionGranted.mockResolvedValue(false)
    shell.requestPermission.mockResolvedValue('denied')

    const platform = await createDesktopPlatform()

    await expect(platform.notifications.requestPermission()).resolves.toBe('denied')
    expect(platform.notifications.permission()).toBe('denied')
  })

  it('shows a notification through the shell when allowed', async () => {
    const platform = await createDesktopPlatform()

    platform.notifications.show({ title: 'Orbit', body: 'Новое сообщение', tag: 'channel-1' })

    expect(shell.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Orbit', body: 'Новое сообщение', group: 'channel-1' }),
    )
  })

  it('stays silent without permission', async () => {
    shell.isPermissionGranted.mockResolvedValue(false)

    const platform = await createDesktopPlatform()
    platform.notifications.show({ title: 'Orbit', body: 'Новое сообщение' })

    expect(shell.sendNotification).not.toHaveBeenCalled()
  })

  it('survives the shell refusing at the last moment', async () => {
    shell.sendNotification.mockImplementation(() => {
      throw new Error('not allowed')
    })

    const platform = await createDesktopPlatform()

    expect(() => {
      platform.notifications.show({ title: 'Orbit' })
    }).not.toThrow()
  })
})

describe('desktop platform: notification click', () => {
  /** The listener the adapter registered at creation. */
  const click = (event: ClickEvent): void => {
    const [callback] = shell.onAction.mock.calls[0] ?? []
    callback?.(event)
  }
  // The focus chain awaits one window call after another; let the microtasks drain.
  const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

  it('brings the window back when a notification is clicked', async () => {
    await createDesktopPlatform()
    click({ actionId: 'tap', inputValue: null, notification: null })
    await settled()

    expect(shell.unminimize).toHaveBeenCalledOnce()
    expect(shell.show).toHaveBeenCalledOnce()
    expect(shell.setFocus).toHaveBeenCalledOnce()
  })

  it('opens the channel the clicked notification belongs to', async () => {
    const platform = await createDesktopPlatform()
    const onClick = vi.fn()
    platform.notifications.show({
      title: 'Orbit',
      body: 'Новое сообщение',
      tag: 'channel-1',
      onClick,
    })
    const [options] = shell.sendNotification.mock.calls[0] as [{ id: number }]
    expect(options.id).toBeTypeOf('number')

    click({ actionId: 'tap', inputValue: null, notification: { id: options.id } })
    await settled()

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('gives every notification of one channel the same id', async () => {
    const platform = await createDesktopPlatform()
    platform.notifications.show({ title: 'Orbit', body: 'первое', tag: 'channel-1' })
    platform.notifications.show({ title: 'Orbit', body: 'второе', tag: 'channel-1' })

    const ids = shell.sendNotification.mock.calls.map(([options]) => (options as { id: number }).id)
    expect(ids[0]).toBe(ids[1])
  })
})

describe('desktop platform: autostart', () => {
  it('enables and disables launch at login through the plugin', async () => {
    const platform = await createDesktopPlatform()

    await platform.autostart.setEnabled(true)
    expect(shell.enable).toHaveBeenCalledOnce()

    await platform.autostart.setEnabled(false)
    expect(shell.disable).toHaveBeenCalledOnce()
  })

  it('reads the current state and reports support', async () => {
    shell.isEnabled.mockResolvedValue(true)

    const platform = await createDesktopPlatform()

    await expect(platform.autostart.isEnabled()).resolves.toBe(true)
    expect(platform.autostart.isSupported()).toBe(true)
  })
})

describe('desktop platform: things a browser feature must not offer', () => {
  it('rejects the install prompt because the app is installed', async () => {
    const platform = await createDesktopPlatform()

    expect(platform.install.isSupported()).toBe(false)
    expect(platform.install.canPrompt()).toBe(false)
    expect(platform.install.isInstalled()).toBe(true)
    await expect(platform.install.prompt()).rejects.toMatchObject({ name: 'NotSupportedError' })
  })

  it('keeps Web Push out of the desktop build', async () => {
    const platform = await createDesktopPlatform()

    await expect(platform.push.isSupported()).resolves.toBe(false)
    await expect(platform.push.current()).resolves.toBeNull()
    await expect(platform.push.subscribe('key')).rejects.toMatchObject({
      name: 'NotSupportedError',
    })
  })

  it('keeps the browser media and screen capture from the web implementation', async () => {
    const platform = await createDesktopPlatform()

    // jsdom has no getDisplayMedia, so a false here means the web implementation answered —
    // the desktop adapter must not replace capture, which stays inside livekit-client (ADR-0004).
    expect(platform.screenCapture.isSupported()).toBe(false)
    expect(typeof platform.mediaDevices.requestAccess).toBe('function')
  })
})
