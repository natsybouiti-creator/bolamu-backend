// ============================================================
// S26 — Animateur gère ses clubs et notifie les membres
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
  whatsapp: { statut: '⏳', details: 'bolamu_club_activite (vérif. manuelle)' }
};

test.describe.serial('S26 — Animateur gère ses clubs et notifie les membres', () => {

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

    await loginAs(page, 'animateur', '+242000000088', 'bolamu2026');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_animateur_token'));
  });

  test.afterAll(async () => {
    genererRapport('S26', 'Animateur gère ses clubs et notifie les membres', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Stats animateur', async () => {
    try {
      const stats = await apiCall('/animateur/stats', 'GET', null, token);
      expect(stats.success).toBe(true);
      resultats.backend = { statut: '✅', details: 'stats animateur récupérées' };
      screenshots.push(await screenshot(page, 's26', 1, 'stats-animateur'));
    } catch (err) {
      bugs.push({ code: 'BUG-S26-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Mes clubs', async () => {
    try {
      const clubs = await apiCall('/animateur/clubs', 'GET', null, token);
      expect(clubs.success).toBe(true);
      resultats.frontend = { statut: '✅', details: `${clubs.data?.length} clubs` };
    } catch (err) {
      bugs.push({ code: 'BUG-S26-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Notifier le club', async () => {
    try {
      const clubs = await apiCall('/animateur/clubs', 'GET', null, token);
      if (clubs.data?.[0]) {
        const club = clubs.data[0];
        const notifRes = await apiCall(`/animateur/clubs/${club.id}/notify`, 'POST', {
          message_type: 'bolamu_club_message',
          params: [club.name, 'Activité sportive samedi matin 7h au stade !']
        }, token);
        console.log('[S26 ÉTAPE 3] Réponse API notification brute :', JSON.stringify(notifRes, null, 2));
        expect(notifRes.success).toBe(true);
        resultats.database = { statut: '✅', details: `${notifRes.data.notified_count} membres notifiés` };
        screenshots.push(await screenshot(page, 's26', 2, 'notification-envoyee'));
      } else {
        resultats.database = { statut: '➖', details: 'Aucun club à notifier' };
      }
    } catch (err) {
      bugs.push({ code: 'BUG-S26-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Check-ins du jour', async () => {
    try {
      const checkinsToday = await apiCall('/animateur/checkins/today', 'GET', null, token);
      expect(checkinsToday.success).toBe(true);
    } catch (err) {
      bugs.push({ code: 'BUG-S26-04', description: err.message });
      throw err;
    }
  });

});
