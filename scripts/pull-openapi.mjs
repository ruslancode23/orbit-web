// Updates the orbit-server spec snapshot in api/.
//   pnpm api:pull                         — from orbit-server main on GitHub
//   pnpm api:pull <git ref>               — from a branch, tag or commit
//   pnpm api:pull ../orbit-server/api/openapi.yaml — from a local checkout
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'

const TARGET = new URL('../api/orbit-server.openapi.yaml', import.meta.url)
const REPO = 'ruslancode23/orbit-server'
const source = process.argv[2] ?? 'main'

const spec = existsSync(source)
  ? await readFile(source, 'utf8')
  : await fetch(`https://raw.githubusercontent.com/${REPO}/${source}/api/openapi.yaml`).then(
      (res) => {
        if (!res.ok) {
          throw new Error(`Cannot download the spec at ${source}: HTTP ${res.status}`)
        }
        return res.text()
      },
    )

if (!spec.startsWith('openapi:')) {
  throw new Error(`${source} does not look like an OpenAPI document`)
}
await writeFile(TARGET, spec)
console.log(`api/orbit-server.openapi.yaml updated from ${source}`)
