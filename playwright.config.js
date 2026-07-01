import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 120000,  // timeout global par test
  use: {
    baseURL: process.env.API_URL || 'https://www.bolamu.co',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 30000,
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
      testIgnore: /tests\/e2e\/(0[1-6]|s04|s05|s06|s07|s20)-/,
    },
    {
      // Tests API E2E critiques — pas de browser, pas de dépendance auth
      name: 'api-e2e',
      testMatch: /tests\/e2e\/(0[1-6])-.*\.spec\.js/,
      use: {},
    },
    {
      // Tests Clubs + Chat — pas de dépendance auth (JWT direct)
      name: 'clubs-chat',
      testMatch: /tests\/e2e\/07-clubs\.spec\.js/,
      use: {},
      dependencies: [],
    },
    {
      // Tests Soins (s04/s05/s06/s07/s20) — nécessitent reset audit
      name: 'soins',
      testMatch: /tests\/e2e\/(s04|s05|s06|s07|s20)-.*\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['reset'],
      teardown: 'restore',
    },
  ],
});
