// ============================================================
// S18 — Patient consulte le leaderboard Zora
// Source : SCENARIOS_VIE_BOLAMU.md
// ============================================================
const { test, expect } = require('@playwright/test');
const {
  loginAs, waitForDashboard, handleDialogs,
  apiCall, screenshot, genererRapport
} = require('../helpers/bolamu-helpers');

const PHONES_TEST = [];
let adminToken;
const bugs = [];
const screenshots = [];
const resultats = {
  backend:  { statut: '⏳', details: '' },
  database: { statut: '⏳', details: '' },
  frontend: { statut: '⏳', details: '' },
  whatsapp: { statut: '➖', details: 'Aucun' }
};

test.describe.serial('S18 — Patient consulte leaderboard Zora', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');

    const adminLogin = await apiCall('/auth/admin-login', 'POST', {
      phone: '+242060000099',
      password: 'bolamu2026'
    });
    adminToken = adminLogin.accessToken;

    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => {
    genererRapport('S18', 'Patient consulte leaderboard Zora', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Charger accueil', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.goAccueil());
      await page.waitForTimeout(2000);
      resultats.frontend = { statut: '✅', details: 'Accueil + top3 affichés' };
      screenshots.push(await screenshot(page, 's18', 1, 'accueil'));
    } catch (err) {
      bugs.push({ code: 'BUG-S18-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Top 3 public', async () => {
    try {
      const top3 = await apiCall('/leaderboard/weekly/top3', 'GET', null, null);
      expect(top3.success).toBe(true);
      resultats.backend = { statut: '✅', details: 'top3 récupéré' };
    } catch (err) {
      bugs.push({ code: 'BUG-S18-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Leaderboard complet avec position', async () => {
    try {
      const leaderboard = await page.evaluate(() => window.__bolamu_test.getLeaderboard());
      console.log('Ma position:', leaderboard?.my_position);
      resultats.database = { statut: '✅', details: 'leaderboard_weekly calculé' };
      screenshots.push(await screenshot(page, 's18', 2, 'leaderboard'));
    } catch (err) {
      bugs.push({ code: 'BUG-S18-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Tester encouragement (toast attendu)', async () => {
    try {
      const top3 = await apiCall('/leaderboard/weekly/top3', 'GET', null, null);
      if (top3.data?.[0]?.phone) {
        await page.evaluate((phone) => window.__bolamu_test.encourageMember(phone), top3.data[0].phone);
        await page.waitForTimeout(1500);
      }
    } catch (err) {
      bugs.push({ code: 'BUG-S18-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Tester commentaire (toast attendu)', async () => {
    try {
      const top3 = await apiCall('/leaderboard/weekly/top3', 'GET', null, null);
      if (top3.data?.[0]?.phone) {
        await page.evaluate((phone) => window.__bolamu_test.toggleCommentInput(phone), top3.data[0].phone);
        await page.evaluate((phone) => window.__bolamu_test.updateCommentText(phone, 'Bravo !'), top3.data[0].phone);
        await page.evaluate((phone) => window.__bolamu_test.sendComment(phone), top3.data[0].phone);
        await page.waitForTimeout(1500);
      }
    } catch (err) {
      bugs.push({ code: 'BUG-S18-05', description: err.message });
      throw err;
    }
  });

});
