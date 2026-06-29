// ============================================================
// S08 — Patient génère son QR d'identité médicale
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

test.describe.serial('S08 — Patient génère son QR d\'identité médicale', () => {

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
    genererRapport('S08', 'Patient génère son QR d\'identité médicale', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Ouvrir QR urgence', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.openQrUrg());
      await page.waitForSelector('#qr-modal', { state: 'visible' });
      resultats.frontend = { statut: '✅', details: '#qr-modal visible' };
      screenshots.push(await screenshot(page, 's08', 1, 'qr-modal'));
    } catch (err) {
      bugs.push({ code: 'BUG-S08-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Vérifier QR payload généré', async () => {
    try {
      const qrRes = await apiCall('/dmn/qr-payload', 'GET', null, token);
      expect(qrRes.success).toBe(true);
      expect(qrRes.data.payload).toBeTruthy();
      resultats.backend = { statut: '✅', details: 'qr-payload signé généré' };
      screenshots.push(await screenshot(page, 's08', 2, 'qr-genere'));
    } catch (err) {
      bugs.push({ code: 'BUG-S08-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Vérifier access-log', async () => {
    try {
      const accessLog = await apiCall('/dmn/access-log', 'GET', null, token);
      const qrLog = accessLog.data.logs.find(l => l.event_type === 'qr_scan');
      expect(qrLog).toBeDefined();
      resultats.database = { statut: '✅', details: 'dmn_access_log qr_scan' };
    } catch (err) {
      bugs.push({ code: 'BUG-S08-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Fermer QR', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.closeQrUrg());
      await page.waitForTimeout(1000);
    } catch (err) {
      bugs.push({ code: 'BUG-S08-04', description: err.message });
      throw err;
    }
  });

});
