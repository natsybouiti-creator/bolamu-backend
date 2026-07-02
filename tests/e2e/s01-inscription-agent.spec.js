// ============================================================
// S01 — Inscription patient via agence (wizard complet)
// Source : SCENARIOS_VIE_BOLAMU.md
// ============================================================
const { test, expect } = require('@playwright/test');
const {
  loginAs, waitForDashboard, uploadFixture, handleDialogs,
  apiCall, screenshot, genererRapport
} = require('../helpers/bolamu-helpers');
const { Pool } = require('pg');
require('dotenv').config();

// Numéros de test créés pendant ce spec — pour le nettoyage
const PHONES_TEST = ['+242069000099'];
let adminToken;
const bugs = [];
const screenshots = [];
const resultats = {
  backend:  { statut: '⏳', details: '' },
  database: { statut: '⏳', details: '' },
  frontend: { statut: '⏳', details: '' },
  whatsapp: { statut: '⏳', details: 'bolamu_bienvenue_patient_v4 (vérif. manuelle)' }
};

test.describe.serial('S01 — Inscription patient via agence', () => {

  let page, context;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    
    // Login admin pour vérifications DB et cleanup
    const adminLogin = await apiCall('/auth/admin-login', 'POST', {
      phone: '+242060000099',
      password: 'bolamu2026'
    });
    adminToken = adminLogin.accessToken;
    
    // Login agent via la vraie page HTML
    await loginAs(page, 'agent', '+242077000010', 'bolamu2026');
  });

  test.afterAll(async () => {
    genererRapport('S01', 'Inscription patient via agence', resultats, bugs, screenshots);
    if (PHONES_TEST.length > 0) {
      await apiCall('/admin/test/cleanup', 'DELETE', { phones: PHONES_TEST }, adminToken);
    }
    await context.close();
  });

  test('ÉTAPE 1 — Ouvrir wizard souscription', async () => {
    try {
      // Onglet Souscription (DOM direct — dashboard agence)
      await page.click('.nav-item[data-tab="souscription"]');
      await page.waitForSelector('#wizard-step-1', { state: 'visible' });
      resultats.frontend = { statut: '✅', details: 'Wizard étape 1 visible' };
      screenshots.push(await screenshot(page, 's01', 1, 'wizard-open'));
    } catch (err) {
      bugs.push({ code: 'BUG-S01-01', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 2 — Remplir identité', async () => {
    try {
      await page.fill('#w-phone', '+242069000099');
      await page.fill('#w-nom', 'Test');
      await page.fill('#w-prenom', 'Nouveau Patient');
      await page.fill('#w-dob', '1990-01-01');
      await page.selectOption('#w-genre', 'homme');
      await page.selectOption('#w-ville', 'Brazzaville');
      await page.fill('#w-adresse', 'Quartier Test');
      await page.click('.canal-card[data-canal="whatsapp"]');
      screenshots.push(await screenshot(page, 's01', 2, 'identite-remplie'));

      await page.click('#wizard-step-1 .btn-primary');
      await page.waitForSelector('#wizard-step-2', { state: 'visible' });
    } catch (err) {
      bugs.push({ code: 'BUG-S01-02', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 3 — Documents (type + numéro + photo)', async () => {
    try {
      await page.selectOption('#w-doc-type', 'cni');
      await page.fill('#w-doc-numero', 'CNI-TEST-0001');
      await uploadFixture(page, '#w-photo-input', 'photo.png');
      await page.waitForFunction(() => document.getElementById('w-photo-data').value !== '', { timeout: 10000 });
      screenshots.push(await screenshot(page, 's01', 3, 'documents-remplis'));

      await page.click('#wizard-step-2 .btn-primary');
      await page.waitForSelector('#wizard-step-3', { state: 'visible' });
    } catch (err) {
      bugs.push({ code: 'BUG-S01-03', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 4 — Choisir formule + CGU', async () => {
    try {
      await page.waitForSelector('.plan-card[data-plan="essentiel"]', { state: 'visible' });
      await page.click('.plan-card[data-plan="essentiel"]');
      await page.check('#w-cgu-accept');
      screenshots.push(await screenshot(page, 's01', 4, 'formule-selectionnee'));

      await page.click('#wizard-step-3 .btn-primary');
      await page.waitForSelector('#wizard-step-4', { state: 'visible' });
    } catch (err) {
      bugs.push({ code: 'BUG-S01-04', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 5 — Paiement et validation', async () => {
    try {
      await page.click('.payment-card[data-method="especes"]');
      await page.click('#btn-confirmer-souscription');

      await page.waitForSelector('#w-souscription-result.result-msg', { state: 'visible', timeout: 15000 });
      const resultText = await page.textContent('#w-souscription-result');
      expect(resultText).toContain('Souscription réussie');
      resultats.frontend = { statut: '✅', details: 'Souscription confirmée (panneau résultat)' };
      screenshots.push(await screenshot(page, 's01', 5, 'validation-success'));
    } catch (err) {
      bugs.push({ code: 'BUG-S01-05', description: err.message });
      throw err;
    }
  });

  test('ÉTAPE 6 — Vérifier backend API + persistance DB', async () => {
    try {
      // Backend API
      const adherent = await apiCall('/admin/users/+242069000099/profile', 'GET', null, adminToken);
      expect(adherent.success).toBe(true);
      expect(adherent.data.user.statut_abonnement).toBe('actif');
      expect(adherent.data.user.member_code).toMatch(/^BLM-/);
      resultats.backend = { statut: '✅', details: 'admin/users/profile → actif + member_code' };

      // Database SELECT (lecture seule)
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      try {
        const dbResult = await pool.query(
          `SELECT phone, statut_abonnement, member_code FROM users WHERE phone = $1`,
          ['+242069000099']
        );
        expect(dbResult.rows.length).toBeGreaterThan(0);
        expect(dbResult.rows[0].statut_abonnement).toBe('actif');
        expect(dbResult.rows[0].member_code).toMatch(/^BLM-/);
        resultats.database = { statut: '✅', details: 'SELECT users → patient créé avec abonnement actif' };
      } finally {
        await pool.end();
      }
    } catch (err) {
      bugs.push({ code: 'BUG-S01-06', description: err.message });
      throw err;
    }
  });

});
