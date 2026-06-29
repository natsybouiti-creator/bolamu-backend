// ============================================================
// S17 — Patient consulte et discute avec son médecin
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
  whatsapp: { statut: '⏳', details: 'bolamu_message_offline (si médecin hors ligne)' }
};

test.describe.serial('S17 — Patient discute avec son médecin', () => {

  let page, context, token;
  let medecinPhone, convId;

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
    genererRapport('S17', 'Patient discute avec son médecin', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Ouvrir chat médecins', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.openChat());
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.__bolamu_test.openChatReal());
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.__bolamu_test.chatMedecins());
      await page.waitForTimeout(2000);
      resultats.frontend = { statut: '✅', details: 'Onglet médecins ouvert' };
      screenshots.push(await screenshot(page, 's17', 1, 'medecins-chat'));
    } catch (err) {
      bugs.push({ code: 'BUG-S17-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Récupérer médecins disponibles', async () => {
    try {
      const doctors = await apiCall('/chat/doctors', 'GET', null, token);
      expect(doctors.data?.length).toBeGreaterThan(0);
      medecinPhone = doctors.data[0].phone;
      resultats.backend = { statut: '✅', details: 'médecins disponibles récupérés' };
    } catch (err) {
      bugs.push({ code: 'BUG-S17-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Créer/trouver conversation', async () => {
    try {
      const convRes = await apiCall(`/chat/medecin/${medecinPhone}`, 'POST', null, token);
      expect(convRes.success).toBe(true);
      convId = convRes.data.id;
    } catch (err) {
      bugs.push({ code: 'BUG-S17-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Envoyer message', async () => {
    try {
      const msgRes = await apiCall(`/chat/conversations/${convId}/messages`, 'POST',
        { content: 'Bonjour Docteur, j\'ai une question suite à notre consultation.' }, token);
      expect(msgRes.success).toBe(true);
      resultats.database = { statut: '✅', details: 'messages + last_message_at mis à jour' };
      screenshots.push(await screenshot(page, 's17', 2, 'message-envoye'));
    } catch (err) {
      bugs.push({ code: 'BUG-S17-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Fermer chat', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.closeChat());
      await page.waitForTimeout(1000);
    } catch (err) {
      bugs.push({ code: 'BUG-S17-05', description: err.message });
      throw err;
    }
  });

});
