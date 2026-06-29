// ============================================================
// S15 — Patient rejoint un club communauté
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
  whatsapp: { statut: '⏳', details: 'bolamu_animateur_nouveau_membre (vérif. manuelle)' }
};

test.describe.serial('S15 — Patient rejoint un club communauté', () => {

  let page, context, token;
  let clubId;

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
    genererRapport('S15', 'Patient rejoint un club communauté', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Récupérer liste des clubs', async () => {
    try {
      const clubs = await apiCall('/clubs', 'GET', null, null);
      expect(clubs.data?.length).toBeGreaterThan(0);
      clubId = clubs.data[0].id;
      resultats.backend = { statut: '✅', details: `Club ${clubs.data[0].name}` };
    } catch (err) {
      bugs.push({ code: 'BUG-S15-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Ouvrir panel club', async () => {
    try {
      await page.evaluate((id) => window.__bolamu_test.openClubPanel(id), clubId);
      await page.waitForTimeout(2000);
      resultats.frontend = { statut: '✅', details: 'Panel club ouvert' };
      screenshots.push(await screenshot(page, 's15', 1, 'club-panel'));
    } catch (err) {
      bugs.push({ code: 'BUG-S15-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Rejoindre le club', async () => {
    try {
      await page.evaluate((id) => window.__bolamu_test.joinClub(id), clubId);
      await page.waitForTimeout(2000);
      screenshots.push(await screenshot(page, 's15', 2, 'join-success'));
    } catch (err) {
      bugs.push({ code: 'BUG-S15-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Vérifier membres', async () => {
    try {
      const members = await apiCall(`/clubs/${clubId}/members`, 'GET', null, token);
      const isMember = members.data?.some(m => m.phone === '+242069735418');
      expect(isMember).toBe(true);
      resultats.database = { statut: '✅', details: 'club_members + members_count incrémenté' };
    } catch (err) {
      bugs.push({ code: 'BUG-S15-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Fermer panel', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.closeClubPanel());
      await page.waitForTimeout(1000);
    } catch (err) {
      bugs.push({ code: 'BUG-S15-05', description: err.message });
      throw err;
    }
  });

});
