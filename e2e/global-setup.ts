const API_URL = process.env.VITE_API_URL ?? 'http://localhost:8080'

export default async function globalSetup() {
  const fail = (reason: string) =>
    new Error(
      `orbit-server is not ready at ${API_URL} (${reason}).\n` +
        'Start it with ORBIT_ENV=development: cd ../orbit-server && make up && make run',
    )
  const ready = await fetch(`${API_URL}/readyz`).catch((error: unknown) => {
    throw fail(String(error))
  })
  if (!ready.ok) {
    throw fail(`readyz answered ${String(ready.status)}`)
  }
}
