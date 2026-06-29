// ============================================================
// S05 — Consultation validée → Zora crédité
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

test.describe.serial('S05 — Consultation validée', () => {

  let pageMedecin, contextMedecin, tokenMedecin;
  let rdvId, sessionCode;

  test.beforeAll(async ({ browser }) => {
    const adminLogin = await apiCall('/auth/admin-login', 'POST', {
      phone: '+242060000099',
      password: 'bolamu2026'
    });
    adminToken = adminLogin.accessToken;

    contextMedecin = await browser.newContext();
    pageMedecin = await contextMedecin.newPage();
    handleDialogs(pageMedecin, 'accept');
    await loginAs(pageMedecin, 'medecin', '+242060000001', 'bolamu2026');
    await waitForDashboard(pageMedecin);
    tokenMedecin = await pageMedecin.evaluate(() => localStorage.getItem('bolamu_medecin_token'));
  });

  test.afterAll(async () => {
    genererRapport('S05', 'Consultation validée', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await contextMedecin.close();
  });

  test('ÉTAPE 1 — Récupérer RDV du patient', async () => {
    try {
      const rdvList = await apiCall('/appointments/doctor/+242060000001', 'GET', null, tokenMedecin);
      expect(rdvList.success).toBe(true);
      expect(rdvList.data.length).toBeGreaterThan(0);
      rdvId = rdvList.data[0].id;
      sessionCode = rdvList.data[0].session_code;
      resultats.backend = { statut: '✅', details: 'liste RDV médecin récupérée' };
      screenshots.push(await screenshot(pageMedecin, 's05', 1, 'rdv-liste'));
    } catch (err) {
      bugs.push({ code: 'BUG-S05-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Ouvrir consultation', async () => {
    try {
      const openRes = await apiCall(`/appointments/${rdvId}/open`, 'POST', null, tokenMedecin);
      expect(openRes.success).toBe(true);
      expect(openRes.data.status).toBe('en_cours');
      resultats.database = { statut: '✅', details: 'appointment en_cours' };
      screenshots.push(await screenshot(pageMedecin, 's05', 2, 'consultation-ouverte'));
    } catch (err) {
      bugs.push({ code: 'BUG-S05-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Vérifier Zora avant validation', async () => {
    try {
      const zoraBefore = await apiCall('/zora/balance', 'GET', null, tokenMedecin);
      expect(zoraBefore.success).toBe(true);
      console.log('Zora avant:', zoraBefore.data.balance);
    } catch (err) {
      bugs.push({ code: 'BUG-S05-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Valider avec session_code', async () => {
    try {
      const validateRes = await apiCall(`/appointments/${rdvId}/validate`, 'POST',
        { session_code: sessionCode }, tokenMedecin);
      expect(validateRes.success).toBe(true);
      expect(validateRes.data.zora_awarded).toBe(50);
      resultats.frontend = { statut: '✅', details: 'validation + zora_awarded 50' };
      screenshots.push(await screenshot(pageMedecin, 's05', 3, 'validation-success'));
    } catch (err) {
      bugs.push({ code: 'BUG-S05-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Vérifier Zora après validation', async () => {
    try {
      const zoraAfter = await apiCall('/zora/balance', 'GET', null, tokenMedecin);
      expect(zoraAfter.data.balance).toBeGreaterThan(0);
      resultats.database = { statut: '✅', details: 'zora_ledger crédité' };
    } catch (err) {
      bugs.push({ code: 'BUG-S05-05', description: err.message });
      throw err;
    }
  });

});
