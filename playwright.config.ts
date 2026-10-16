import { defineConfig, devices } from '@playwright/test'

// End-to-end tests against real orbit-server and LiveKit:
//   cd ../orbit-server && make up && make run   (ORBIT_ENV=development)
//   pnpm test:e2e
// Vite is started here; orbit-server is checked in global setup.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    permissions: ['microphone'],
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // A fake microphone that plays a tone, a fake screen to share, and no permission prompts.
          args: [
            '--auto-select-desktop-capture-source=Entire screen',
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'pnpm dev --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
