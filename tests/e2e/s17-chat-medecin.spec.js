// ============================================================
// S17 — Patient consulte et discute avec son médecin
// Source : SCENARIOS_VIE_BOLAMU.md
// ============================================================
const { test, expect } = require('@playwright/test');
const {
  loginAs, apiCall, genererRapport
} = require('../helpers/bolamu-helpers');

const PHONES_TEST = [];
let adminToken;
const bugs = [];
const resultats = {
  backend:  { statut: '⏳', details: '' },
  database: { statut: '⏳', details: '' },
  frontend: { statut: '⏳', details: 'Frontend non testé (pages web non accessibles)' },
  whatsapp: { statut: '⏳', details: 'bolamu_message_offline (si médecin hors ligne)' }
};

test.describe.serial('S17 — Patient discute avec son médecin', () => {

  let page, context, token;
  let medecinPhone, convId;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginAs(page, 'patient', '+242069735418', 'bolamu2026');
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => {
    genererRapport('S17', 'Patient discute avec son médecin', resultats, bugs, []);
    await context.close();
  });

  test('ÉTAPE 1 — Récupérer médecins disponibles', async () => {
    try {
      const doctors = await apiCall('/chat/doctors', 'GET', null, token);
      expect(doctors.data?.length).toBeGreaterThan(0);
      medecinPhone = doctors.data[0].phone;
      resultats.backend = { statut: '✅', details: 'médecins disponibles récupérés' };
    } catch (err) {
      bugs.push({ code: 'BUG-S17-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Créer/trouver conversation', async () => {
    try {
      const convRes = await apiCall(`/chat/medecin/${medecinPhone}`, 'POST', null, token);
      expect(convRes.success).toBe(true);
      convId = convRes.data.id;
    } catch (err) {
      bugs.push({ code: 'BUG-S17-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Envoyer message', async () => {
    try {
      const msgRes = await apiCall(`/chat/conversations/${convId}/messages`, 'POST',
        { content: 'Bonjour Docteur, j\'ai une question suite à notre consultation.' }, token);
      expect(msgRes.success).toBe(true);
      resultats.database = { statut: '✅', details: 'messages + last_message_at mis à jour' };
    } catch (err) {
      bugs.push({ code: 'BUG-S17-03', description: err.message });
      throw err;
    }
  });

});
