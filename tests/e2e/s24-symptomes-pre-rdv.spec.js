// ============================================================
// S24 — Patient pré-remplit ses symptômes avant RDV
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

test.describe.serial('S24 — Patient pré-remplit symptômes avant RDV', () => {

  let page, context, token;
  let rdvId;

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
    genererRapport('S24', 'Patient pré-remplit symptômes avant RDV', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Récupérer RDV du patient', async () => {
    try {
      const rdvs = await apiCall('/appointments/patient/+242069735418', 'GET', null, token);
      const prochainRdv = rdvs.appointments?.find(r => r.status === 'confirme');
      expect(prochainRdv).toBeDefined();
      rdvId = prochainRdv.id;
      resultats.backend = { statut: '✅', details: `RDV confirmé ${rdvId}` };
    } catch (err) {
      bugs.push({ code: 'BUG-S24-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Soumettre symptômes', async () => {
    try {
      const symptomsRes = await apiCall(`/appointments/${rdvId}/symptoms`, 'POST', {
        motif: 'Douleurs abdominales',
        symptomes: ['Nausées', 'Fièvre légère'],
        duree_symptomes: '3 jours',
        intensite: '6',
        traitements_en_cours: 'Paracétamol 500mg',
        remarques_patient: 'Douleurs surtout après repas'
      }, token);
      expect(symptomsRes.success).toBe(true);
      resultats.database = { statut: '✅', details: 'appointment_symptoms enregistré' };
      screenshots.push(await screenshot(page, 's24', 1, 'symptomes-soumis'));
    } catch (err) {
      bugs.push({ code: 'BUG-S24-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Vérifier symptômes enregistrés', async () => {
    try {
      const rdvDetail = await apiCall(`/appointments/${rdvId}`, 'GET', null, token);
      expect(rdvDetail.data.symptomes_motif).toBe('Douleurs abdominales');
      resultats.frontend = { statut: '✅', details: 'symptômes visibles côté RDV' };
    } catch (err) {
      bugs.push({ code: 'BUG-S24-03', description: err.message });
      throw err;
    }
  });

});
