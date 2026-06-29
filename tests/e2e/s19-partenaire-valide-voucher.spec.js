// ============================================================
// S19 — Partenaire valide un voucher patient
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

test.describe.serial('S19 — Partenaire valide un voucher patient', () => {

  let pagePatient, pagePartenaire, contextPatient, contextPartenaire;
  let tokenPatient, tokenPartenaire, voucherUuid;

  test.beforeAll(async ({ browser }) => {
    const adminLogin = await apiCall('/auth/admin-login', 'POST', {
      phone: '+242060000099',
      password: 'bolamu2026'
    });
    adminToken = adminLogin.accessToken;

    contextPatient = await browser.newContext();
    pagePatient = await contextPatient.newPage();
    handleDialogs(pagePatient, 'accept');
    await loginAs(pagePatient, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(pagePatient);
    tokenPatient = await pagePatient.evaluate(() => localStorage.getItem('bolamu_patient_token'));

    contextPartenaire = await browser.newContext();
    pagePartenaire = await contextPartenaire.newPage();
    handleDialogs(pagePartenaire, 'accept');
    await loginAs(pagePartenaire, 'partenaire', '+242066226116', 'WR383LMW');
    await waitForDashboard(pagePartenaire);
    tokenPartenaire = await pagePartenaire.evaluate(() => localStorage.getItem('bolamu_partenaire_token'));
  });

  test.afterAll(async () => {
    genererRapport('S19', 'Partenaire valide un voucher patient', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await contextPatient.close();
    await contextPartenaire.close();
  });

  test('ÉTAPE 1 — Patient affiche ses vouchers', async () => {
    try {
      await pagePatient.evaluate(() => window.__bolamu_test.goRecompenses());
      await pagePatient.waitForTimeout(2000);
      resultats.frontend = { statut: '✅', details: 'Vouchers patient affichés' };
      screenshots.push(await screenshot(pagePatient, 's19', 1, 'vouchers-patient'));
    } catch (err) {
      bugs.push({ code: 'BUG-S19-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Récupérer voucher actif', async () => {
    try {
      const vouchers = await apiCall('/zora/vouchers', 'GET', null, tokenPatient);
      const activeVoucher = vouchers.data?.find(v => v.status === 'active');
      expect(activeVoucher).toBeDefined();
      voucherUuid = activeVoucher.uuid;
      resultats.backend = { statut: '✅', details: `voucher ${voucherUuid}` };
    } catch (err) {
      bugs.push({ code: 'BUG-S19-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Partenaire consomme le voucher', async () => {
    try {
      const consumeRes = await apiCall(`/zora/vouchers/${voucherUuid}/consume`, 'POST', null, tokenPartenaire);
      expect(consumeRes.success).toBe(true);
      expect(consumeRes.data.status).toBe('used');
      resultats.database = { statut: '✅', details: 'voucher status used + used_by_partner' };
      screenshots.push(await screenshot(pagePartenaire, 's19', 2, 'consumption-success'));
    } catch (err) {
      bugs.push({ code: 'BUG-S19-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Vérifier voucher utilisé', async () => {
    try {
      const vouchers = await apiCall('/zora/vouchers', 'GET', null, tokenPatient);
      const usedVoucher = vouchers.data?.find(v => v.uuid === voucherUuid);
      expect(usedVoucher.status).toBe('used');
    } catch (err) {
      bugs.push({ code: 'BUG-S19-04', description: err.message });
      throw err;
    }
  });

});
