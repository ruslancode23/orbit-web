import { createTauriSecretStore } from './tauri-secret-store'

const shell = vi.hoisted(() => ({
  invoke: vi.fn<(command: string, args?: unknown) => Promise<unknown>>(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: shell.invoke }))

beforeEach(() => {
  vi.clearAllMocks()
  shell.invoke.mockResolvedValue(null)
})

describe('desktop secret store', () => {
  it('reports the keychain backend', () => {
    const store = createTauriSecretStore()

    expect(store.backend).toBe('keychain')
  })

  it('returns the fallback when the shell has nothing', async () => {
    const store = createTauriSecretStore()

    await expect(store.get('secret', 'account', null)).resolves.toBeNull()
    expect(shell.invoke).toHaveBeenCalledWith('secret_get', { scope: 'secret', key: 'account' })
  })

  it('writes through the shell and resolves with the stored value', async () => {
    shell.invoke.mockResolvedValue(undefined)
    const store = createTauriSecretStore()

    await expect(store.set('secret', 'account', { data: 'cipher' })).resolves.toEqual({
      data: 'cipher',
    })
    expect(shell.invoke).toHaveBeenCalledWith('secret_set', {
      scope: 'secret',
      key: 'account',
      value: { data: 'cipher' },
    })
  })

  it('lists and clears a scope through the shell', async () => {
    shell.invoke.mockResolvedValue(['a', 'b'])
    const store = createTauriSecretStore()

    await expect(store.keys('secret-chat')).resolves.toEqual(['a', 'b'])
    await store.clear('secret-chat')

    expect(shell.invoke).toHaveBeenCalledWith('secret_keys', { scope: 'secret-chat' })
    expect(shell.invoke).toHaveBeenCalledWith('secret_clear', { scope: 'secret-chat' })
  })

  it('turns a locked keychain into NotAllowedError, not into "no data"', async () => {
    shell.invoke.mockRejectedValue('locked')
    const store = createTauriSecretStore()

    await expect(store.get('secret', 'account', null)).rejects.toMatchObject({
      name: 'NotAllowedError',
    })
  })

  it('turns a damaged file into DataError', async () => {
    shell.invoke.mockRejectedValue('corrupt')
    const store = createTauriSecretStore()

    await expect(store.get('secret', 'account', null)).rejects.toMatchObject({ name: 'DataError' })
  })
})
