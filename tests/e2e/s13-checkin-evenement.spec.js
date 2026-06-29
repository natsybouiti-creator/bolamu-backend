// ============================================================
// S13 — Check-in patient à un événement Elonga (scan QR)
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
  whatsapp: { statut: '⏳', details: 'bolamu_checkin_confirme (vérif. manuelle)' }
};

test.describe.serial('S13 — Check-in patient à événement', () => {

  let pagePatient, pageAnim, contextPatient, contextAnim;
  let tokenPatient, tokenAnim, eventId, checkinToken;

  test.beforeAll(async ({ browser }) => {
    const adminLogin = await apiCall('/auth/admin-login', 'POST', {
      phone: '+242060000099',
      password: 'bolamu2026'
    });
    adminToken = adminLogin.accessToken;

    contextPatient = await browser.newContext();
    pagePatient = await contextPatient.newPage();
    handleDialogs(pagePatient, 'accept');
    await loginAs(pagePatient, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(pagePatient);
    tokenPatient = await pagePatient.evaluate(() => localStorage.getItem('bolamu_patient_token'));

    contextAnim = await browser.newContext();
    pageAnim = await contextAnim.newPage();
    handleDialogs(pageAnim, 'accept');
    await loginAs(pageAnim, 'animateur', '+242000000088', 'bolamu2026');
    await waitForDashboard(pageAnim);
    tokenAnim = await pageAnim.evaluate(() => localStorage.getItem('bolamu_animateur_token'));
  });

  test.afterAll(async () => {
    genererRapport('S13', 'Check-in patient à événement', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await contextPatient.close();
    await contextAnim.close();
  });

  test('ÉTAPE 1 — Patient affiche son QR', async () => {
    try {
      await pagePatient.evaluate(() => window.__bolamu_test.openDmnQrModal());
      await pagePatient.waitForTimeout(2000);
      resultats.frontend = { statut: '✅', details: 'QR patient affiché' };
      screenshots.push(await screenshot(pagePatient, 's13', 1, 'patient-qr'));
    } catch (err) {
      bugs.push({ code: 'BUG-S13-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Récupérer checkin token du patient', async () => {
    try {
      const myRegs = await apiCall('/events/my/registrations', 'GET', null, tokenPatient);
      expect(myRegs.data?.length).toBeGreaterThan(0);
      eventId = myRegs.data[0].event_id;
      checkinToken = myRegs.data[0].checkin_token;
      resultats.backend = { statut: '✅', details: 'checkin_token récupéré' };
    } catch (err) {
      bugs.push({ code: 'BUG-S13-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Animateur scanne et valide', async () => {
    try {
      const checkinRes = await apiCall(`/events/${eventId}/checkin`, 'POST',
        { token: checkinToken }, tokenAnim);
      expect(checkinRes.success).toBe(true);
      expect(checkinRes.points_credited).toBe(30);
      resultats.database = { statut: '✅', details: 'event_checkin_log + zora +30' };
      screenshots.push(await screenshot(pageAnim, 's13', 2, 'checkin-success'));
    } catch (err) {
      bugs.push({ code: 'BUG-S13-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Vérifier registration check-in', async () => {
    try {
      const myRegs = await apiCall('/events/my/registrations', 'GET', null, tokenPatient);
      expect(myRegs.data[0].checked_in).toBe(true);
    } catch (err) {
      bugs.push({ code: 'BUG-S13-04', description: err.message });
      throw err;
    }
  });

});
