// ============================================================
// S04 — Patient prend un RDV médecin
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
  whatsapp: { statut: '⏳', details: 'bolamu_rdv_confirme (vérif. manuelle)' }
};

test.describe.serial('S04 — Patient prend un RDV médecin', () => {

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
    genererRapport('S04', 'Patient prend un RDV médecin', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Naviguer vers accueil', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.goAccueil());
      await page.waitForTimeout(2000);
      screenshots.push(await screenshot(page, 's04', 1, 'accueil'));
    } catch (err) {
      bugs.push({ code: 'BUG-S04-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Ouvrir modal RDV', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.openModal());
      await page.waitForSelector('#rdv-modal', { state: 'visible' });
      resultats.frontend = { statut: '✅', details: '#rdv-modal visible' };
      screenshots.push(await screenshot(page, 's04', 2, 'modal-open'));
    } catch (err) {
      bugs.push({ code: 'BUG-S04-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Sélectionner médecin', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.rdvSelectDoctor('1'));
      await page.waitForTimeout(1000);
      screenshots.push(await screenshot(page, 's04', 3, 'medecin-selectionne'));
    } catch (err) {
      bugs.push({ code: 'BUG-S04-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Sélectionner date', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.rdvSelectDate('2026-07-15'));
      await page.waitForTimeout(1500);
      screenshots.push(await screenshot(page, 's04', 4, 'date-selectionnee'));
    } catch (err) {
      bugs.push({ code: 'BUG-S04-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Sélectionner créneau', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.rdvSelectSlot('09:00'));
      await page.waitForTimeout(1000);
      screenshots.push(await screenshot(page, 's04', 5, 'creneau-selectionne'));
    } catch (err) {
      bugs.push({ code: 'BUG-S04-05', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 6 — Confirmer RDV', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.confirmRdv());
      await page.waitForTimeout(2000);

      const state = await page.evaluate(() => window.__bolamu_test.getState());
      expect(state.last_appointment_id).toBeTruthy();
      expect(state.session_code).toBeTruthy();
      resultats.frontend = { statut: '✅', details: 'RDV confirmé côté UI' };
      screenshots.push(await screenshot(page, 's04', 6, 'rdv-confirme'));
    } catch (err) {
      bugs.push({ code: 'BUG-S04-06', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 7 — Vérifier backend API', async () => {
    try {
      const rdvs = await apiCall('/appointments/patient/+242069735418', 'GET', null, token);
      expect(rdvs.success).toBe(true);
      expect(rdvs.appointments.length).toBeGreaterThan(0);
      expect(rdvs.appointments[0].status).toBe('confirme');
      resultats.backend = { statut: '✅', details: 'appointment status confirme' };
      resultats.database = { statut: '✅', details: 'RDV présent en DB' };
    } catch (err) {
      bugs.push({ code: 'BUG-S04-07', description: err.message });
      throw err;
    }
  });

});
