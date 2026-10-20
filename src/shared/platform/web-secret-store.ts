import type { PlatformSecretStore } from './platform-adapter'

const databaseName = 'orbit-secret'
const storeName = 'values'

/** One row per (scope, key); the scope keeps chats from stepping on each other. */
interface StoredValue {
  id: string
  value: unknown
}

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.addEventListener('upgradeneeded', () => {
      request.result.createObjectStore(storeName, { keyPath: 'id' })
    })
    request.addEventListener('success', () => {
      resolve(request.result)
    })
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('indexedDB is unavailable'))
    })
  })

const idOf = (scope: string, key: string) => `${scope}:${key}`

const awaitRequest = <T>(request: IDBRequest): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => {
      // The DOM typings give IDBRequest no type parameter to carry here.
      resolve(request.result as T)
    })
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('indexedDB request failed'))
    })
  })

const transaction = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T> => {
  const database = await openDatabase()
  try {
    const tx = database.transaction(storeName, mode)
    const request = run(tx.objectStore(storeName))
    return await awaitRequest<T>(request)
  } finally {
    database.close()
  }
}

/**
 * IndexedDB, and nothing else: no cookie, no localStorage, no cache the service
 * worker could keep. A non-extractable `CryptoKey` can be stored here because
 * IndexedDB clones it, which is how the Olm pickles stay wrapped at rest.
 */
export const createWebSecretStore = (): PlatformSecretStore => ({
  async get<T>(scope: string, key: string, fallback: T | null): Promise<T | null> {
    const row = await transaction<StoredValue | undefined>('readonly', (store) =>
      store.get(idOf(scope, key)),
    )
    // Stored by us under this key; the type is the caller's knowledge of it.
    return row === undefined ? fallback : (row.value as T)
  },
  async set<T>(scope: string, key: string, value: T): Promise<T> {
    await transaction('readwrite', (store) => store.put({ id: idOf(scope, key), value }))
    return value
  },
  async remove(scope: string, key: string): Promise<void> {
    await transaction('readwrite', (store) => store.delete(idOf(scope, key)))
  },
  async keys(scope: string): Promise<string[]> {
    const rows = await transaction<StoredValue[]>('readonly', (store) => store.getAll())
    const prefix = `${scope}:`
    return rows
      .map((row) => row.id)
      .filter((id) => id.startsWith(prefix))
      .map((id) => id.slice(prefix.length))
  },
  async clear(scope: string): Promise<void> {
    const database = await openDatabase()
    try {
      const tx = database.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const rows = await awaitRequest<StoredValue[]>(store.getAll())
      const prefix = `${scope}:`
      for (const row of rows) {
        if (row.id.startsWith(prefix)) {
          store.delete(row.id)
        }
      }
    } finally {
      database.close()
    }
  },
})
