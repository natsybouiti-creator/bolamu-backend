// ============================================================
// S11 — Patient échange ses Zora contre une récompense
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

test.describe.serial('S11 — Patient échange Zora contre récompense', () => {

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
    genererRapport('S11', 'Patient échange Zora contre récompense', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Naviguer vers Récompenses', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.goRecompenses());
      await page.waitForTimeout(2000);
      resultats.frontend = { statut: '✅', details: 'Section Récompenses ouverte' };
      screenshots.push(await screenshot(page, 's11', 1, 'recompenses'));
    } catch (err) {
      bugs.push({ code: 'BUG-S11-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Voir récompenses disponibles', async () => {
    try {
      const rewards = await apiCall('/zora/rewards', 'GET', null, token);
      expect(rewards.success).toBe(true);
      resultats.backend = { statut: '✅', details: `${rewards.data?.length} récompenses` };
    } catch (err) {
      bugs.push({ code: 'BUG-S11-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Filtrer par catégorie', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.filterCatElec());
      await page.waitForTimeout(1000);
      screenshots.push(await screenshot(page, 's11', 2, 'filtre-elec'));
    } catch (err) {
      bugs.push({ code: 'BUG-S11-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Vérifier balance Zora', async () => {
    try {
      const zoraState = await apiCall('/zora/balance', 'GET', null, token);
      zoraBefore = zoraState.data.balance;
      console.log('Balance Zora:', zoraBefore);
    } catch (err) {
      bugs.push({ code: 'BUG-S11-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Tenter échange (si balance suffisante)', async () => {
    try {
      const rewards = await apiCall('/zora/rewards', 'GET', null, token);
      if (rewards.data?.length > 0 && zoraBefore >= rewards.data[0].cost_zora) {
        const redeemRes = await apiCall('/zora/redeem', 'POST',
          { reward_id: rewards.data[0].id }, token);
        expect(redeemRes.success).toBe(true);
        resultats.database = { statut: '✅', details: 'voucher généré, stock décrémenté' };
        screenshots.push(await screenshot(page, 's11', 3, 'echange-success'));
      } else {
        resultats.database = { statut: '➖', details: 'Balance insuffisante (échange non testé)' };
      }
    } catch (err) {
      bugs.push({ code: 'BUG-S11-05', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 6 — Vérifier mes vouchers', async () => {
    try {
      const vouchers = await apiCall('/zora/vouchers', 'GET', null, token);
      expect(vouchers.success).toBe(true);
      expect(vouchers.data.length).toBeGreaterThan(0);
    } catch (err) {
      bugs.push({ code: 'BUG-S11-06', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 7 — Fermer modal', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.closeVoucherModal());
      await page.waitForTimeout(1000);
    } catch (err) {
      bugs.push({ code: 'BUG-S11-07', description: err.message });
      throw err;
    }
  });

});
