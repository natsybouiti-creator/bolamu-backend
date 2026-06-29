// ============================================================
// S25 — Patient récupère ses notifications
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

test.describe.serial('S25 — Patient récupère ses notifications', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    const adminLogin = await apiCall('/auth/admin-login', 'POST', {
      phone: '+242060000099',
      password: 'bolamu2026'
    });
    adminToken = adminLogin.accessToken;
    await loginAs(page, 'patient', '+242069735418', 'bolamu2026');
  });

  test.afterAll(async () => {
    genererRapport('S25', 'Patient récupère ses notifications', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Badge non lus', async () => {
    try {
      const unreadCount = await apiCall('/notifications/unread-count', 'GET', null, token);
      expect(unreadCount.success).toBe(true);
      resultats.backend = { statut: '✅', details: `${unreadCount.data?.count} non lus` };
    } catch (err) {
      bugs.push({ code: 'BUG-S25-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Liste notifications', async () => {
    try {
      const notifs = await apiCall('/notifications', 'GET', null, token);
      expect(notifs.success).toBe(true);
      resultats.frontend = { statut: '✅', details: `${notifs.data?.length} notifications` };
      screenshots.push(await screenshot(page, 's25', 1, 'notifications-list'));
    } catch (err) {
      bugs.push({ code: 'BUG-S25-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Marquer première comme lue', async () => {
    try {
      const notifs = await apiCall('/notifications', 'GET', null, token);
      if (notifs.data?.length > 0) {
        const readRes = await apiCall(`/notifications/${notifs.data[0].id}/read`, 'PATCH', null, token);
        expect(readRes.success).toBe(true);
      }
    } catch (err) {
      bugs.push({ code: 'BUG-S25-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Tout marquer lu', async () => {
    try {
      const readAllRes = await apiCall('/notifications/read-all', 'PATCH', null, token);
      expect(readAllRes.success).toBe(true);
      resultats.database = { statut: '✅', details: 'is_read true + read_at mis à jour' };
    } catch (err) {
      bugs.push({ code: 'BUG-S25-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Vérifier badge réinitialisé', async () => {
    try {
      const unreadAfter = await apiCall('/notifications/unread-count', 'GET', null, token);
      expect(unreadAfter.data?.count).toBe(0);
    } catch (err) {
      bugs.push({ code: 'BUG-S25-05', description: err.message });
      throw err;
    }
  });

});
