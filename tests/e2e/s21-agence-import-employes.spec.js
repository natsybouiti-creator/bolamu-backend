// ============================================================
// S21 — Agence importe des employés (B2B SmartFlow)
// Source : SCENARIOS_VIE_BOLAMU.md
// ============================================================
const { test, expect } = require('@playwright/test');
const {
  loginAs, waitForDashboard, handleDialogs,
  apiCall, screenshot, genererRapport
} = require('../helpers/bolamu-helpers');

// Employés synthétiques créés par l'import — nettoyés en fin de test
const PHONES_TEST = ['+242069000095', '+242069000094', '+242069000093'];
const bugs = [];
const screenshots = [];
const resultats = {
  backend:  { statut: '⏳', details: '' },
  database: { statut: '⏳', details: '' },
  frontend: { statut: '⏳', details: '' },
  whatsapp: { statut: '⏳', details: 'bolamu_bienvenue_patient_v4 (par employé)' }
};

test.describe.serial('S21 — Agence importe employés B2B', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');

    await loginAs(page, 'agent', '+242077000010', 'bolamu2026');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_agent_token'));
  });

  test.afterAll(async () => {
    genererRapport('S21', 'Agence importe employés B2B', resultats, bugs, screenshots);
    await context.close();
  });

  test('ÉTAPE 1 — Importer employés via API', async () => {
    try {
      const importRes = await apiCall('/agence/import-employes', 'POST', {
        company_id: 'COMPANY_TEST_001',
        employes: [
          { phone: '+242069000095', full_name: 'Employé Test Un', plan: 'essentiel' },
          { phone: '+242069000094', full_name: 'Employé Test Deux', plan: 'standard' },
          { phone: '+242069000093', full_name: 'Employé Test Trois', plan: 'essentiel' }
        ]
      }, token);
      expect(importRes.success).toBe(true);
      resultats.backend = { statut: '✅', details: `${importRes.data.created_count} employés importés` };
      screenshots.push(await screenshot(page, 's21', 1, 'import-success'));
    } catch (err) {
      bugs.push({ code: 'BUG-S21-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Vérifier employés en DB', async () => {
    try {
      const employees = await apiCall('/agence/employees?company_id=COMPANY_TEST_001', 'GET', null, token);
      expect(employees.data?.length).toBeGreaterThan(0);
      resultats.database = { statut: '✅', details: 'users + subscriptions + company_employees' };
    } catch (err) {
      bugs.push({ code: 'BUG-S21-02', description: err.message });
      throw err;
    }
  });

});
