// ============================================================
// S02 — Souscription en ligne (patient existant)
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

test.describe.serial('S02 — Souscription en ligne', () => {
  test.describe.configure({ timeout: 60000 });

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
    genererRapport('S02', 'Souscription en ligne', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Vérifier statut abonnement', async () => {
    try {
      const subCheck = await apiCall('/patients/check-subscription?phone=+242069735418', 'GET', null, token);
      expect(subCheck.success).toBe(true);
      resultats.backend = { statut: '✅', details: 'check-subscription répond' };
      screenshots.push(await screenshot(page, 's02', 1, 'statut-compte'));
    } catch (err) {
      bugs.push({ code: 'BUG-S02-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Choisir plan essentiel', async () => {
    try {
      // Naviguer vers register.html pour accéder au protocole window.__bolamu_test
      await page.goto('https://www.bolamu.co/register.html');
      await page.waitForLoadState('domcontentloaded');
      
      await page.evaluate(() => window.__bolamu_test.selectionnerPlan('essentiel'));
      await page.waitForTimeout(1000);
      resultats.frontend = { statut: '✅', details: 'Plan essentiel sélectionné' };
      screenshots.push(await screenshot(page, 's02', 2, 'plan-selectionne'));
    } catch (err) {
      bugs.push({ code: 'BUG-S02-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Initier paiement MoMo', async () => {
    try {
      const momoRes = await apiCall('/momo/request', 'POST', { amount: 5000, phone: '+242069735418' }, token);
      expect(momoRes.success).toBe(true);
      expect(momoRes.data.reference_id).toBeTruthy();
      resultats.backend = { statut: '✅', details: 'momo/request → reference_id' };
      screenshots.push(await screenshot(page, 's02', 3, 'paiement-initie'));
    } catch (err) {
      bugs.push({ code: 'BUG-S02-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Simuler webhook succès', async () => {
    try {
      const webhookRes = await apiCall('/momo/simulate-success', 'POST', { reference_id: 'TEST_REF_001' }, token);
      expect(webhookRes.success).toBe(true);
    } catch (err) {
      bugs.push({ code: 'BUG-S02-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Vérifier subscription active', async () => {
    try {
      const subCheck = await apiCall('/patients/check-subscription?phone=+242069735418', 'GET', null, token);
      expect(subCheck.data.active).toBe(true);
      expect(subCheck.data.current_plan).toBe('essentiel');
      resultats.database = { statut: '✅', details: 'subscription active essentiel' };
      screenshots.push(await screenshot(page, 's02', 4, 'souscription-active'));
    } catch (err) {
      bugs.push({ code: 'BUG-S02-05', description: err.message });
      throw err;
    }
  });

});
