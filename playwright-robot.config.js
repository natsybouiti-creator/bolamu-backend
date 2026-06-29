import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /robot-patient-scan\.spec\.js/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: true,
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
  },
});
