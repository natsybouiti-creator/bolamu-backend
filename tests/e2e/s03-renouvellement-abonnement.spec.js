// ============================================================
// S03 — Renouvellement abonnement avec upgrade de plan
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

test.describe.serial('S03 — Renouvellement avec upgrade', () => {

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
    genererRapport('S03', 'Renouvellement avec upgrade', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Voir abonnement actuel', async () => {
    try {
      const subRes = await apiCall('/patients/subscription', 'GET', null, token);
      expect(subRes.success).toBe(true);
      expect(subRes.data.plan).toBe('essentiel');
      resultats.backend = { statut: '✅', details: 'subscription = essentiel' };
      screenshots.push(await screenshot(page, 's03', 1, 'abonnement-actuel'));
    } catch (err) {
      bugs.push({ code: 'BUG-S03-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Initier upgrade vers premium', async () => {
    try {
      const upgradeRes = await apiCall('/patients/subscription/upgrade', 'PATCH', { new_plan: 'premium' }, token);
      expect(upgradeRes.success).toBe(true);
      expect(upgradeRes.data.prorata_amount).toBeGreaterThan(0);
      resultats.frontend = { statut: '✅', details: `prorata ${upgradeRes.data.prorata_amount}` };
      screenshots.push(await screenshot(page, 's03', 2, 'upgrade-initie'));
    } catch (err) {
      bugs.push({ code: 'BUG-S03-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Payer différentiel', async () => {
    try {
      const momoRes = await apiCall('/momo/request', 'POST', { amount: 15000, phone: '+242069735418' }, token);
      expect(momoRes.success).toBe(true);
    } catch (err) {
      bugs.push({ code: 'BUG-S03-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Vérifier nouvelle subscription', async () => {
    try {
      const subRes = await apiCall('/patients/subscription', 'GET', null, token);
      expect(subRes.data.plan).toBe('premium');
      expect(subRes.data.status).toBe('active');
      resultats.database = { statut: '✅', details: 'subscription premium active' };
      screenshots.push(await screenshot(page, 's03', 3, 'upgrade-success'));
    } catch (err) {
      bugs.push({ code: 'BUG-S03-04', description: err.message });
      throw err;
    }
  });

});
