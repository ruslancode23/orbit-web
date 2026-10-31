import { createTauriSecretStore } from './tauri-secret-store'

const shell = vi.hoisted(() => ({
  invoke: vi.fn<(command: string, args?: unknown) => Promise<unknown>>(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: shell.invoke }))

/** A shell with no encryption: values in one map, attachments in another. */
const backend = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  blobs: new Map<string, string>(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  backend.values.clear()
  backend.blobs.clear()
  shell.invoke.mockImplementation((name, args) => {
    const {
      scope = '',
      key = '',
      value,
      data,
      name: blob,
    } = (args ?? {}) as Record<string, string | undefined>
    const at = `${scope}|${key}`
    switch (name) {
      case 'secret_get':
        return Promise.resolve(backend.values.get(at) ?? null)
      case 'secret_set':
        backend.values.set(at, value)
        return Promise.resolve(null)
      case 'secret_blob_put':
        backend.blobs.set(String(blob), String(data))
        return Promise.resolve(null)
      case 'secret_blob_get':
        return Promise.resolve(backend.blobs.get(String(blob)) ?? null)
      default:
        return Promise.resolve(null)
    }
  })
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

  it('keeps an attachment as a separate file and gives the Blob back', async () => {
    const store = createTauriSecretStore()
    const file = new Blob(['attachment bytes'], { type: 'text/plain' })

    await store.set('secret-messages', 'chat-1', [{ id: 'm1', file: { blob: file } }])
    const read = await store.get<{ file: { blob: Blob } }[]>('secret-messages', 'chat-1', null)

    expect(backend.blobs.size).toBe(1)
    const wire = backend.values.get('secret-messages|chat-1') as [
      { file: { blob: { __orbitBlob: string } } },
    ]
    expect(wire[0].file.blob.__orbitBlob).toBeTypeOf('string')
    expect(read?.[0]?.file.blob).toBeInstanceOf(Blob)
    await expect(read?.[0]?.file.blob.text()).resolves.toBe('attachment bytes')
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
