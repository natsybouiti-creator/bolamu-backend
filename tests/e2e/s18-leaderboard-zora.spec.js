// ============================================================
// S18 — Patient consulte le leaderboard Zora
// Source : SCENARIOS_VIE_BOLAMU.md
// ============================================================
const { test, expect } = require('@playwright/test');
const {
  loginAs, apiCall, genererRapport
} = require('../helpers/bolamu-helpers');

const PHONES_TEST = [];
let adminToken;
const bugs = [];
const resultats = {
  backend:  { statut: '⏳', details: '' },
  database: { statut: '⏳', details: '' },
  frontend: { statut: '⏳', details: 'Frontend non testé (pages web non accessibles)' },
  whatsapp: { statut: '➖', details: 'Aucun' }
};

test.describe.serial('S18 — Patient consulte leaderboard Zora', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginAs(page, 'patient', '+242069735418', 'bolamu2026');
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => {
    genererRapport('S18', 'Patient consulte leaderboard Zora', resultats, bugs, []);
    await context.close();
  });

  test('ÉTAPE 1 — Top 3 public', async () => {
    try {
      const top3 = await apiCall('/leaderboard/weekly/top3', 'GET', null, null);
      expect(top3.success).toBe(true);
      resultats.backend = { statut: '✅', details: 'top3 récupéré' };
    } catch (err) {
      bugs.push({ code: 'BUG-S18-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Leaderboard complet avec position', async () => {
    try {
      const leaderboard = await apiCall('/leaderboard/weekly', 'GET', null, token);
      expect(leaderboard.success).toBe(true);
      resultats.database = { statut: '✅', details: 'leaderboard_weekly calculé' };
    } catch (err) {
      bugs.push({ code: 'BUG-S18-02', description: err.message });
      throw err;
    }
  });

});
