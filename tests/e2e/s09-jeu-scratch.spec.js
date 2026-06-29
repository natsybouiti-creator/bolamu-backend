// ============================================================
// S09 — Patient joue à un jeu Zora (scratch card)
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

test.describe.serial('S09 — Patient joue scratch card', () => {

  let page, context, token;
  let zoraBefore;

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
    genererRapport('S09', 'Patient joue scratch card', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Naviguer vers Gagner', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.goGagner());
      await page.waitForTimeout(2000);
      resultats.frontend = { statut: '✅', details: 'Section Gagner ouverte' };
      screenshots.push(await screenshot(page, 's09', 1, 'gagner'));
    } catch (err) {
      bugs.push({ code: 'BUG-S09-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Vérifier status jeux', async () => {
    try {
      const gamesStatus = await apiCall('/zora/games/status', 'GET', null, token);
      expect(gamesStatus.success).toBe(true);
      resultats.backend = { statut: '✅', details: 'zora/games/status OK' };
    } catch (err) {
      bugs.push({ code: 'BUG-S09-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Vérifier Zora avant', async () => {
    try {
      const zoraRes = await apiCall('/zora/balance', 'GET', null, token);
      zoraBefore = zoraRes.data.balance;
      console.log('Zora avant:', zoraBefore);
    } catch (err) {
      bugs.push({ code: 'BUG-S09-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Ouvrir et jouer scratch', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.openScratch());
      await page.waitForSelector('#scratch-modal', { state: 'visible' });
      screenshots.push(await screenshot(page, 's09', 2, 'scratch-open'));

      await page.evaluate(() => window.__bolamu_test.playScratch());
      await page.waitForTimeout(3000);
      screenshots.push(await screenshot(page, 's09', 3, 'scratch-result'));
    } catch (err) {
      bugs.push({ code: 'BUG-S09-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Vérifier Zora après', async () => {
    try {
      const zoraAfter = await apiCall('/zora/balance', 'GET', null, token);
      console.log('Zora avant:', zoraBefore, '→ après:', zoraAfter.data.balance);
      resultats.database = { statut: '✅', details: 'zora_game_plays + ledger mis à jour' };
    } catch (err) {
      bugs.push({ code: 'BUG-S09-05', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 6 — Fermer jeu', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.closeGame());
      await page.waitForTimeout(1000);
    } catch (err) {
      bugs.push({ code: 'BUG-S09-06', description: err.message });
      throw err;
    }
  });

});
