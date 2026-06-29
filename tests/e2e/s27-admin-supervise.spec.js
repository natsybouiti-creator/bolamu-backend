// ============================================================
// S27 — Admin supervise la plateforme
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
  whatsapp: { statut: '⏳', details: 'bolamu_animateur_event_valide / _refuse (selon décision)' }
};

test.describe.serial('S27 — Admin supervise la plateforme', () => {

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

    await loginAs(page, 'admin', '+242060000099', 'bolamu2026');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_admin_token'));
  });

  test.afterAll(async () => {
    genererRapport('S27', 'Admin supervise la plateforme', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Événements en attente', async () => {
    try {
      const pendingEvents = await apiCall('/events/admin/events/pending', 'GET', null, token);
      expect(pendingEvents.success).toBe(true);
      resultats.backend = { statut: '✅', details: `${pendingEvents.data?.length} événements en attente` };
      screenshots.push(await screenshot(page, 's27', 1, 'pending-events'));
    } catch (err) {
      bugs.push({ code: 'BUG-S27-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Publier premier événement en attente', async () => {
    try {
      const pendingEvents = await apiCall('/events/admin/events/pending', 'GET', null, token);
      if (pendingEvents.data?.length > 0) {
        const publishRes = await apiCall(`/events/${pendingEvents.data[0].id}/publish`, 'PATCH', null, token);
        expect(publishRes.success).toBe(true);
        resultats.frontend = { statut: '✅', details: 'événement publié' };
        screenshots.push(await screenshot(page, 's27', 2, 'event-published'));
      } else {
        resultats.frontend = { statut: '➖', details: 'Aucun événement à publier' };
      }
    } catch (err) {
      bugs.push({ code: 'BUG-S27-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Stats SmartFlow', async () => {
    try {
      const sfStats = await apiCall('/admin/smartflow/stats?mois=2026-07', 'GET', null, token);
      expect(sfStats.success).toBe(true);
      resultats.database = { statut: '✅', details: 'stats SmartFlow agrégées' };
    } catch (err) {
      bugs.push({ code: 'BUG-S27-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Crédit Zora manuel test', async () => {
    try {
      const zoraEarnRes = await apiCall('/zora/earn', 'POST', {
        phone: '+242069735418',
        points: 100,
        reason: 'Crédit manuel test admin Playwright'
      }, token);
      expect(zoraEarnRes.success).toBe(true);
      console.log('Zora crédité:', zoraEarnRes.data.balance);
    } catch (err) {
      bugs.push({ code: 'BUG-S27-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Recherche patient', async () => {
    try {
      const searchRes = await apiCall('/patients/search?q=+242069735418', 'GET', null, token);
      expect(searchRes.success).toBe(true);
      expect(searchRes.data?.[0]?.full_name).toBeTruthy();
    } catch (err) {
      bugs.push({ code: 'BUG-S27-05', description: err.message });
      throw err;
    }
  });

});
