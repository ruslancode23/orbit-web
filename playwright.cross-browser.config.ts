import { defineConfig, devices } from '@playwright/test'

// The cross-browser pass: the same smoke scenario in Chromium, Firefox and
// WebKit (Safari's engine). The main `test:e2e` run stays Chromium-only; the
// voice scenarios and the recorded screenshots are Chromium's.
//   pnpm exec playwright install firefox webkit
//   pnpm test:e2e:cross-browser
//
// `pnpm test:e2e:cross-browser` runs Chromium and WebKit. Playwright's Firefox
// Nightly (157) does not start on macOS 27 in this environment — it exits with
// "Could not find profile folder" before any page opens — so Firefox is a
// separate run on a machine where it starts:
//   pnpm exec playwright test --config playwright.cross-browser.config.ts --project=firefox
export default defineConfig({
  testDir: './e2e',
  testMatch: /cross-browser\.spec\.ts/,
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm dev --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
