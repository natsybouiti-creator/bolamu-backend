// ============================================================
// S10 — Patient joue quiz Zora
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

test.describe.serial('S10 — Patient joue quiz Zora', () => {

  let page, context, token;
  let playId;

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
    genererRapport('S10', 'Patient joue quiz Zora', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Naviguer vers Gagner', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.goGagner());
      await page.waitForTimeout(2000);
      resultats.frontend = { statut: '✅', details: 'Section Gagner ouverte' };
      screenshots.push(await screenshot(page, 's10', 1, 'gagner'));
    } catch (err) {
      bugs.push({ code: 'BUG-S10-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Ouvrir quiz', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.openQuiz());
      await page.waitForSelector('#quiz-modal', { state: 'visible' });
      screenshots.push(await screenshot(page, 's10', 2, 'quiz-open'));
    } catch (err) {
      bugs.push({ code: 'BUG-S10-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Démarrer quiz', async () => {
    try {
      const quizStart = await apiCall('/zora/games/play', 'POST',
        { game_type: 'quiz', play_type: 'free' }, token);
      expect(quizStart.success).toBe(true);
      expect(quizStart.data.question).toBeTruthy();
      playId = quizStart.data.play_id;
      resultats.backend = { statut: '✅', details: 'quiz démarré' };
    } catch (err) {
      bugs.push({ code: 'BUG-S10-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Répondre (première option)', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.pickQuiz0());
      await page.waitForTimeout(1000);
      screenshots.push(await screenshot(page, 's10', 3, 'reponse-selectionnee'));
    } catch (err) {
      bugs.push({ code: 'BUG-S10-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Soumettre réponse', async () => {
    try {
      const quizResult = await apiCall('/zora/games/quiz/answer', 'POST',
        { play_id: playId, answer: 0 }, token);
      expect(quizResult.success).toBe(true);
      resultats.database = { statut: '✅', details: 'zora_game_plays quiz + ledger' };
      screenshots.push(await screenshot(page, 's10', 4, 'quiz-result'));
    } catch (err) {
      bugs.push({ code: 'BUG-S10-05', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 6 — Fermer jeu', async () => {
    try {
      await page.evaluate(() => window.__bolamu_test.closeGame());
      await page.waitForTimeout(1000);
    } catch (err) {
      bugs.push({ code: 'BUG-S10-06', description: err.message });
      throw err;
    }
  });

});
