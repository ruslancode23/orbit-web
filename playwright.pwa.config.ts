import { defineConfig, devices } from '@playwright/test'

// The offline shell needs a production build: the service worker is registered
// only there, and Vite's dev server serves modules from source.
//   pnpm test:e2e:pwa
export default defineConfig({
  testDir: './e2e',
  testMatch: /pwa\.spec\.ts/,
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
