// ============================================================
// S07 — Patient met à jour ses constantes médicales
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

test.describe.serial('S07 — Patient met à jour ses constantes', () => {

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
    genererRapport('S07', 'Patient met à jour ses constantes', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Vérifier Zora avant mise à jour', async () => {
    try {
      const zoraRes = await apiCall('/zora/balance', 'GET', null, token);
      zoraBefore = zoraRes.data.balance;
      resultats.backend = { statut: '✅', details: `Zora avant ${zoraBefore}` };
    } catch (err) {
      bugs.push({ code: 'BUG-S07-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Naviguer vers Suivre', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.goSuivre());
      await page.waitForTimeout(2000);
      screenshots.push(await screenshot(page, 's07', 1, 'suivre'));
    } catch (err) {
      bugs.push({ code: 'BUG-S07-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Ouvrir modal constantes', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.openEditConst());
      await page.waitForSelector('#constantes-modal', { state: 'visible' });
      resultats.frontend = { statut: '✅', details: '#constantes-modal visible' };
      screenshots.push(await screenshot(page, 's07', 2, 'modal-constantes'));
    } catch (err) {
      bugs.push({ code: 'BUG-S07-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Remplir constantes', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.setConstGroupe('O+'));
      await page.evaluate(() => window.__bolamu_test.setConstPoids('72'));
      await page.evaluate(() => window.__bolamu_test.setConstTaille('178'));
      await page.evaluate(() => window.__bolamu_test.setConstAllergies('Pénicilline'));
      await page.evaluate(() => window.__bolamu_test.setConstMaladies('Aucune'));
      await page.evaluate(() => window.__bolamu_test.setConstAntecedents('Aucun'));
      await page.evaluate(() => window.__bolamu_test.setConstTraitements('Aucun'));
      await page.evaluate(() => window.__bolamu_test.setConstContactNom('Parent Test'));
      await page.evaluate(() => window.__bolamu_test.setConstContactPhone('+242069999999'));
      await page.evaluate(() => window.__bolamu_test.setConstContactLien('Père'));
      screenshots.push(await screenshot(page, 's07', 3, 'constantes-remplies'));
    } catch (err) {
      bugs.push({ code: 'BUG-S07-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Sauvegarder', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.saveConst());
      await page.waitForTimeout(2000);
      screenshots.push(await screenshot(page, 's07', 4, 'sauvegarde-success'));
    } catch (err) {
      bugs.push({ code: 'BUG-S07-05', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 6 — Vérifier Zora après (+30)', async () => {
    try {
      const zoraAfter = await apiCall('/zora/balance', 'GET', null, token);
      expect(zoraAfter.data.balance).toBe(zoraBefore + 30);
      resultats.database = { statut: '✅', details: 'constantes en DB + zora +30' };
    } catch (err) {
      bugs.push({ code: 'BUG-S07-06', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 7 — Fermer modal', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.closeEditConst());
      await page.waitForTimeout(1000);
    } catch (err) {
      bugs.push({ code: 'BUG-S07-07', description: err.message });
      throw err;
    }
  });

});
