// ============================================================
// S14 — Animateur crée un événement (validation admin)
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
  whatsapp: { statut: '⏳', details: 'bolamu_admin_event_soumis / bolamu_animateur_event_valide' }
};

test.describe.serial('S14 — Animateur crée un événement', () => {

  let pageAnim, pageAdmin, contextAnim, contextAdmin;
  let tokenAnim, tokenAdmin, newEventId;

  test.beforeAll(async ({ browser }) => {
    const adminLogin = await apiCall('/auth/admin-login', 'POST', {
      phone: '+242060000099',
      password: 'bolamu2026'
    });
    adminToken = adminLogin.accessToken;

    contextAnim = await browser.newContext();
    pageAnim = await contextAnim.newPage();
    handleDialogs(pageAnim, 'accept');
    await loginAs(pageAnim, 'animateur', '+242000000088', 'bolamu2026');
    await waitForDashboard(pageAnim);
    tokenAnim = await pageAnim.evaluate(() => localStorage.getItem('bolamu_animateur_token'));

    contextAdmin = await browser.newContext();
    pageAdmin = await contextAdmin.newPage();
    handleDialogs(pageAdmin, 'accept');
    await loginAs(pageAdmin, 'admin', '+242060000099', 'bolamu2026');
    await waitForDashboard(pageAdmin);
    tokenAdmin = await pageAdmin.evaluate(() => localStorage.getItem('bolamu_admin_token'));
  });

  test.afterAll(async () => {
    genererRapport('S14', 'Animateur crée un événement', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await contextAnim.close();
    await contextAdmin.close();
  });

  test('ÉTAPE 1 — Créer événement via API', async () => {
    try {
      const createRes = await apiCall('/animateur/events', 'POST', {
        title: 'Marche Santé Test 2026',
        description: 'Événement test Playwright',
        date: '2026-08-15',
        location: 'Brazzaville',
        capacity: '50'
      }, tokenAnim);
      expect(createRes.success).toBe(true);
      newEventId = createRes.data?.id || createRes.data?.event?.id;
      resultats.backend = { statut: '✅', details: `Événement créé ${newEventId}` };
      screenshots.push(await screenshot(pageAnim, 's14', 1, 'event-cree'));
    } catch (err) {
      bugs.push({ code: 'BUG-S14-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Vérifier status pending_validation', async () => {
    try {
      const eventDetail = await apiCall(`/events/${newEventId}`, 'GET', null, null);
      expect(eventDetail.data.status).toBe('pending_validation');
      resultats.database = { statut: '✅', details: 'status pending_validation' };
    } catch (err) {
      bugs.push({ code: 'BUG-S14-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Admin publie l\'événement', async () => {
    try {
      const publishRes = await apiCall(`/events/${newEventId}/publish`, 'PATCH', null, tokenAdmin);
      expect(publishRes.success).toBe(true);
      resultats.frontend = { statut: '✅', details: 'Publication admin OK' };
      screenshots.push(await screenshot(pageAdmin, 's14', 2, 'event-publie'));
    } catch (err) {
      bugs.push({ code: 'BUG-S14-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Vérifier status published', async () => {
    try {
      const eventDetail = await apiCall(`/events/${newEventId}`, 'GET', null, null);
      expect(eventDetail.data.status).toBe('published');
    } catch (err) {
      bugs.push({ code: 'BUG-S14-04', description: err.message });
      throw err;
    }
  });

});
