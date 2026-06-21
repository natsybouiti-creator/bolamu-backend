import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'https://bolamu.co',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
    },
    {
      // Remise à zéro destructive SCOPÉE à +242069735418 (DELETE du jour)
      name: 'reset',
      testMatch: /audit-reset\.setup\.js/,
    },
    {
      // Restauration des constantes médicales d'origine après l'audit
      name: 'restore',
      testMatch: /audit-restore\.teardown\.js/,
    },
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/patient.json',
      },
      dependencies: ['setup', 'reset'],
      teardown: 'restore',
    },
  ],
});
