// ============================================================
// S22 — Prestataire enregistre un acte hors-catalogue SmartFlow
// Source : SCENARIOS_VIE_BOLAMU.md
// ============================================================
const { test, expect } = require('@playwright/test');
const {
  loginAs, waitForDashboard, handleDialogs,
  apiCall, screenshot, genererRapport
} = require('../helpers/bolamu-helpers');

const PHONES_TEST = [];
const bugs = [];
const screenshots = [];
const resultats = {
  backend:  { statut: '⏳', details: '' },
  database: { statut: '⏳', details: '' },
  frontend: { statut: '⏳', details: '' },
  whatsapp: { statut: '➖', details: 'Aucun' }
};

test.describe.serial('S22 — Prestataire enregistre acte hors-catalogue', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');

    await loginAs(page, 'medecin', '+242060000001', 'bolamu2026');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_medecin_token'));
  });

  test.afterAll(async () => {
    genererRapport('S22', 'Prestataire enregistre acte hors-catalogue', resultats, bugs, screenshots);
    await context.close();
  });

  test('ÉTAPE 1 — Vérifier si médicament SSP ou hors-catalogue', async () => {
    try {
      const checkMed = await apiCall('/smartflow/medicaments/check?nom=Ciprofloxacine', 'GET', null, token);
      expect(checkMed.success).toBe(true);
      resultats.backend = { statut: '✅', details: `type ${checkMed.data?.type}` };
    } catch (err) {
      bugs.push({ code: 'BUG-S22-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Enregistrer acte hors-catalogue', async () => {
    try {
      const horsRes = await apiCall('/smartflow/hors-catalogue', 'POST', {
        patient_phone: '+242069735418',
        medicament: 'Ciprofloxacine 500mg',
        montant: 8500,
        type_acte: 'pharmacie'
      }, token);
      expect(horsRes.success).toBe(true);
      resultats.database = { statut: '✅', details: `acte ${horsRes.data.transaction_id} pending_validation` };
      screenshots.push(await screenshot(page, 's22', 1, 'acte-soumis'));
    } catch (err) {
      bugs.push({ code: 'BUG-S22-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Stats prestataire', async () => {
    try {
      const statsRes = await apiCall('/smartflow/stats/moi?mois=2026-07', 'GET', null, token);
      expect(statsRes.success).toBe(true);
      resultats.frontend = { statut: '✅', details: 'stats prestataire récupérées' };
    } catch (err) {
      bugs.push({ code: 'BUG-S22-03', description: err.message });
      throw err;
    }
  });

});
