// ============================================================
// S06 — Patient accède à son DMN (Dossier Médical Numérique)
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

test.describe.serial('S06 — Patient accède à son DMN', () => {

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
    genererRapport('S06', 'Patient accède à son DMN', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Naviguer vers Suivre → Dossier', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.goSuivre());
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.__bolamu_test.suivreDossier());
      await page.waitForTimeout(2000);
      resultats.frontend = { statut: '✅', details: 'Panel dossier ouvert' };
      screenshots.push(await screenshot(page, 's06', 1, 'dossier-ouvert'));
    } catch (err) {
      bugs.push({ code: 'BUG-S06-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Vérifier DMN summary appelé', async () => {
    try {
      const dmnSummary = await apiCall('/dmn/summary', 'GET', null, token);
      expect(dmnSummary.success).toBe(true);
      expect(dmnSummary.data.documents).toBeDefined();
      resultats.backend = { statut: '✅', details: 'dmn/summary OK' };
    } catch (err) {
      bugs.push({ code: 'BUG-S06-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Ouvrir modal password', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.openDmnPasswordModal());
      await page.waitForSelector('#password-modal', { state: 'visible' });
      screenshots.push(await screenshot(page, 's06', 2, 'modal-password'));
    } catch (err) {
      bugs.push({ code: 'BUG-S06-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Confirmer mot de passe', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.confirmDmnPassword());
      await page.waitForTimeout(2000);
      screenshots.push(await screenshot(page, 's06', 3, 'password-confirme'));
    } catch (err) {
      bugs.push({ code: 'BUG-S06-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Vérifier access-log', async () => {
    try {
      const accessLog = await apiCall('/dmn/access-log', 'GET', null, token);
      expect(accessLog.success).toBe(true);
      expect(accessLog.data.logs.length).toBeGreaterThan(0);
      resultats.database = { statut: '✅', details: 'dmn_access_log alimenté' };
    } catch (err) {
      bugs.push({ code: 'BUG-S06-05', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 6 — Fermer modal', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.closeDmnPasswordModal());
      await page.waitForTimeout(1000);
    } catch (err) {
      bugs.push({ code: 'BUG-S06-06', description: err.message });
      throw err;
    }
  });

});
