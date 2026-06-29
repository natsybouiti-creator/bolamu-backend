// ============================================================
// S16 — Patient envoie un message dans le chat communauté
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
  whatsapp: { statut: '⏳', details: 'bolamu_message_offline (si destinataire hors ligne)' }
};

test.describe.serial('S16 — Patient envoie message chat communauté', () => {

  let page, context, token;
  let convId;

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
    genererRapport('S16', 'Patient envoie message chat communauté', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Ouvrir chat', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.openChat());
      await page.waitForTimeout(2000);
      resultats.frontend = { statut: '✅', details: 'Chat ouvert' };
      screenshots.push(await screenshot(page, 's16', 1, 'chat-open'));
    } catch (err) {
      bugs.push({ code: 'BUG-S16-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Aller vers chat communauté', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.openChatReal());
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.__bolamu_test.chatCommunaute());
      await page.waitForTimeout(2000);
      screenshots.push(await screenshot(page, 's16', 2, 'communaute'));
    } catch (err) {
      bugs.push({ code: 'BUG-S16-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Récupérer conversation communauté', async () => {
    try {
      const communaute = await apiCall('/chat/communaute', 'GET', null, token);
      expect(communaute.success).toBe(true);
      convId = communaute.data.id;
      resultats.backend = { statut: '✅', details: 'conversation communauté récupérée' };
    } catch (err) {
      bugs.push({ code: 'BUG-S16-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Envoyer message', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.sendChatMessage());
      await page.waitForTimeout(2000);
      screenshots.push(await screenshot(page, 's16', 3, 'message-envoye'));
    } catch (err) {
      bugs.push({ code: 'BUG-S16-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Vérifier message envoyé via API', async () => {
    try {
      const msgs = await apiCall(`/chat/conversations/${convId}/messages`, 'GET', null, token);
      expect(msgs.data?.length).toBeGreaterThan(0);
      resultats.database = { statut: '✅', details: 'messages + conversation_participants' };
    } catch (err) {
      bugs.push({ code: 'BUG-S16-05', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 6 — Marquer comme lu + fermer', async () => {
    try {
      await apiCall(`/chat/conversations/${convId}/read`, 'POST', null, token);
      await page.evaluate(() => window.__bolamu_test.closeChat());
      await page.waitForTimeout(1000);
    } catch (err) {
      bugs.push({ code: 'BUG-S16-06', description: err.message });
      throw err;
    }
  });

});
