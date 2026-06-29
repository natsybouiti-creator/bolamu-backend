// ============================================================
// S23 — RH valide les retenues SmartFlow du mois
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

test.describe.serial('S23 — RH valide les retenues SmartFlow', () => {

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
    await loginAs(page, 'rh', '+242077000002', 'bolamu2026');
  });

  test.afterAll(async () => {
    genererRapport('S23', 'RH valide les retenues SmartFlow', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Dashboard RH', async () => {
    try {
      const dashRH = await apiCall('/smartflow/rh/dashboard', 'GET', null, token);
      expect(dashRH.success).toBe(true);
      resultats.backend = { statut: '✅', details: 'dashboard RH récupéré' };
      screenshots.push(await screenshot(page, 's23', 1, 'dashboard-rh'));
    } catch (err) {
      bugs.push({ code: 'BUG-S23-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Retenues provisoires', async () => {
    try {
      const retenues = await apiCall('/smartflow/rh/retenues/provisoire?mois=2026-07', 'GET', null, token);
      expect(retenues.success).toBe(true);
      resultats.frontend = { statut: '✅', details: `${retenues.data?.length} employés` };
    } catch (err) {
      bugs.push({ code: 'BUG-S23-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Valider retenues', async () => {
    try {
      const retenues = await apiCall('/smartflow/rh/retenues/provisoire?mois=2026-07', 'GET', null, token);
      if (retenues.data?.length > 0) {
        const employe_ids = retenues.data.map(r => r.employe_id);
        const validerRes = await apiCall('/smartflow/rh/retenues/valider', 'POST', {
          mois: '2026-07',
          employe_ids: employe_ids
        }, token);
        expect(validerRes.success).toBe(true);
        resultats.database = { statut: '✅', details: `${validerRes.data.validated_count} retenues validées` };
        screenshots.push(await screenshot(page, 's23', 2, 'validation-success'));
      } else {
        resultats.database = { statut: '➖', details: 'Aucune retenue à valider' };
      }
    } catch (err) {
      bugs.push({ code: 'BUG-S23-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Export CSV', async () => {
    try {
      const exportUrl = '/smartflow/rh/export/2026-07';
      console.log('Export CSV URL:', exportUrl);
    } catch (err) {
      bugs.push({ code: 'BUG-S23-04', description: err.message });
      throw err;
    }
  });

});
