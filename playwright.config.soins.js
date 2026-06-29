import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  // Pas de globalSetup pour les tests Soins
  use: {
    baseURL: process.env.API_URL || 'https://api.bolamu.co',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'soins',
      testMatch: /tests\/e2e\/(s04|s05|s06|s07|s20)-.*\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
