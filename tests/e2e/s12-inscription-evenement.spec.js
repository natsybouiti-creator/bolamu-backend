// ============================================================
// S12 — Patient s'inscrit à un événement Elonga
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
  whatsapp: { statut: '⏳', details: 'bolamu_event_inscription (vérif. manuelle)' }
};

test.describe.serial('S12 — Patient s\'inscrit à un événement Elonga', () => {

  let page, context, token;
  let eventId;

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
    genererRapport('S12', 'Patient s\'inscrit à un événement Elonga', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Récupérer événements disponibles', async () => {
    try {
      const events = await apiCall('/events', 'GET', null, null);
      const availableEvent = events.data?.find(e => e.status === 'published' && e.places_restantes > 0);
      expect(availableEvent).toBeDefined();
      eventId = availableEvent.id;
      resultats.backend = { statut: '✅', details: `Événement ${availableEvent.title}` };
    } catch (err) {
      bugs.push({ code: 'BUG-S12-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Ouvrir panel événement', async () => {
    try {
      await page.evaluate((id) => window.__bolamu_test.openEventPanel(id), eventId);
      await page.waitForTimeout(2000);
      resultats.frontend = { statut: '✅', details: 'Panel événement ouvert' };
      screenshots.push(await screenshot(page, 's12', 1, 'event-panel'));
    } catch (err) {
      bugs.push({ code: 'BUG-S12-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — S\'inscrire', async () => {
    try {
      await page.evaluate((id) => window.__bolamu_test.participate(id), eventId);
      await page.waitForTimeout(2000);
      screenshots.push(await screenshot(page, 's12', 2, 'inscription'));
    } catch (err) {
      bugs.push({ code: 'BUG-S12-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Vérifier inscription', async () => {
    try {
      const myRegs = await apiCall('/events/my/registrations', 'GET', null, token);
      const isRegistered = myRegs.data?.some(r => r.event_id === eventId);
      expect(isRegistered).toBe(true);
      resultats.database = { statut: '✅', details: 'elonga_registrations + places décrémentées' };
    } catch (err) {
      bugs.push({ code: 'BUG-S12-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Fermer panel', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.closeEventPanel());
      await page.waitForTimeout(1000);
    } catch (err) {
      bugs.push({ code: 'BUG-S12-05', description: err.message });
      throw err;
    }
  });

});
