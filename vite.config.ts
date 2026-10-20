import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

import { contentSecurityPolicy, secureHtml } from './scripts/security-html.ts'

// https://vite.dev/config/
/** CSP and SRI for the built app; development keeps its inline HMR client. */
const securityPlugin = (mode: string) => {
  let outDir = 'dist'
  return {
    name: 'orbit-security',
    apply: 'build' as const,
    configResolved(config: { build: { outDir: string } }) {
      outDir = config.build.outDir
    },
    // Integrity must hash the files as written: a chunk is still being rendered
    // when the HTML transform runs, so hashing there gives a digest that is
    // already stale by the time the browser checks it.
    async writeBundle(_options: unknown, bundle: Record<string, unknown>) {
      const env = loadEnv(mode, process.cwd(), 'VITE_')
      const apiOrigin = env.VITE_API_URL ? new URL(env.VITE_API_URL).origin : undefined
      const htmlPath = resolve(outDir, 'index.html')
      const html = await readFile(htmlPath, 'utf8')
      const assets: Record<string, { source: Uint8Array }> = {}
      for (const file of Object.keys(bundle)) {
        if (file.endsWith('.js') || file.endsWith('.css')) {
          assets[file] = { source: await readFile(resolve(outDir, file)) }
        }
      }
      await writeFile(htmlPath, await secureHtml(html, assets, apiOrigin))
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiOrigin = env.VITE_API_URL ? new URL(env.VITE_API_URL).origin : undefined
  return {
    plugins: [react(), tailwindcss(), securityPlugin(mode)],
    // The server allows CORS only from this origin (ORBIT_CORS_ORIGINS). Fail on a busy port
    // instead of silently moving to 5174, where every API request is blocked.
    server: {
      port: 5173,
      strictPort: true,
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      css: true,
      exclude: ['e2e/**', 'node_modules/**'],
    },
    preview: {
      headers: {
        'Content-Security-Policy': `${contentSecurityPolicy(apiOrigin)}; frame-ancestors 'none'`,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    },
  }
})
