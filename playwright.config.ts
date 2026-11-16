import { defineConfig, devices } from '@playwright/test';
import { authFile, targets } from './e2e/ha';

// Needs running HA instances: `npm run build && npm run ha:up -- 2024.8.0 8124 && npm run ha:up -- stable 8125`.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/ha-setup.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: targets().flatMap((t) => [
    {
      name: t.name,
      testIgnore: /shelly\.spec/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        baseURL: t.url,
        storageState: authFile(t),
      },
    },
    {
      name: `${t.name}-shelly`,
      testMatch: /shelly\.spec/,
      use: {
        viewport: { width: 1440, height: 720 },
        hasTouch: true,
        isMobile: true,
        userAgent:
          'Mozilla/5.0 (Linux; Android 12; Wall Display X2 Build/SQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Safari/537.36',
        baseURL: t.url,
        storageState: authFile(t),
      },
    },
  ]),
});
