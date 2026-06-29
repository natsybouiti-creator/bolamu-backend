// ============================================================
// S20 — Tiers-payant pharmacie
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

test.describe.serial('S20 — Tiers-payant pharmacie', () => {

  let page, context, token;
  let transId;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');

    const adminLogin = await apiCall('/auth/admin-login', 'POST', {
      phone: '+242060000099',
      password: 'bolamu2026'
    });
    adminToken = adminLogin.accessToken;

    await loginAs(page, 'pharmacie', '+242066226116', 'WR383LMW');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_pharmacie_token'));
  });

  test.afterAll(async () => {
    genererRapport('S20', 'Tiers-payant pharmacie', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Vérifier adhérent', async () => {
    try {
      const adherentRes = await apiCall('/agence/verifier-adherent?q=+242069735418', 'GET', null, token);
      expect(adherentRes.success).toBe(true);
      expect(adherentRes.data.subscription_plan).toBeTruthy();
      resultats.backend = { statut: '✅', details: `adhérent ${adherentRes.data.full_name}` };
      screenshots.push(await screenshot(page, 's20', 1, 'adherent-verifie'));
    } catch (err) {
      bugs.push({ code: 'BUG-S20-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Initier tiers-payant', async () => {
    try {
      const tierRes = await apiCall('/tiers-payant/initier', 'POST', {
        patient_phone: '+242069735418',
        montant: 15000,
        description: 'Amoxicilline 500mg x30'
      }, token);
      expect(tierRes.success).toBe(true);
      transId = tierRes.data.id;
      resultats.frontend = { statut: '✅', details: `transaction ${transId}` };
      screenshots.push(await screenshot(page, 's20', 2, 'transaction-initiee'));
    } catch (err) {
      bugs.push({ code: 'BUG-S20-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Valider transaction', async () => {
    try {
      const validerRes = await apiCall(`/tiers-payant/${transId}/valider`, 'PATCH', null, token);
      expect(validerRes.success).toBe(true);
      expect(validerRes.data.status).toBe('validé');
      resultats.database = { statut: '✅', details: 'transaction validée, remise 15%' };
      screenshots.push(await screenshot(page, 's20', 3, 'validation-success'));
    } catch (err) {
      bugs.push({ code: 'BUG-S20-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Voir mes transactions', async () => {
    try {
      const myTrans = await apiCall('/tiers-payant/mes-transactions', 'GET', null, token);
      expect(myTrans.data?.length).toBeGreaterThan(0);
    } catch (err) {
      bugs.push({ code: 'BUG-S20-04', description: err.message });
      throw err;
    }
  });

});
