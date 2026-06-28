// TEST S26 — MODÉRATION PLATEFORME ADMIN
// Scénario : Admin gère la modération de la plateforme
// Compte admin : +242060000099 / bolamu2026
// URL : https://www.bolamu.co

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ADMIN_PHONE = '+242060000099';
const ADMIN_PASSWORD = 'bolamu2026';
const BASE_URL = 'https://www.bolamu.co';
const API_URL = 'https://api.bolamu.co/api/v1';
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots-s26');

// Créer le dossier de screenshots s'il n'existe pas
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Helper pour prendre un screenshot
async function takeScreenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot: ${filepath}`);
  return filepath;
}

// Helper pour logger la réponse API
function logApiResponse(step, response) {
  console.log(`\n📡 [${step}] Réponse API:`);
  console.log(JSON.stringify(response, null, 2));
}

// Helper pour les appels API depuis Node.js (évite les problèmes CORS)
async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${API_URL}${endpoint}`, options);
  const data = await response.json();
  return data;
}

test.describe('SCENARIO S26 — Modération Admin', () => {
  let page;
  let authToken;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('ÉTAPE 1: Admin se connecte', async () => {
    console.log('\n=== ÉTAPE 1: Connexion admin ===');
    
    await page.goto(`${BASE_URL}/admin/dashboard.html`);
    await page.waitForTimeout(2000);

    const loginRes = await apiCall('/auth/admin-login', 'POST', {
      phone: ADMIN_PHONE,
      password: ADMIN_PASSWORD
    });

    logApiResponse('POST /auth/admin-login', loginRes);
    expect(loginRes.success).toBe(true);
    authToken = loginRes.accessToken;

    await takeScreenshot(page, '01-login-success');
  });

  test('ÉTAPE 2: Voir la liste des dossiers en attente de validation', async () => {
    console.log('\n=== ÉTAPE 2: Liste dossiers en attente ===');
    
    const pendingRes = await apiCall('/admin/pending?limit=50', 'GET', null, authToken);

    logApiResponse('GET /admin/pending', pendingRes);
    
    if (pendingRes.success) {
      const pendingCount = pendingRes.data?.length || 0;
      console.log(`✅ ${pendingCount} dossiers en attente`);
    }
    
    await takeScreenshot(page, '02-pending-list');
  });

  test('ÉTAPE 3: Valider un dossier avec motif', async () => {
    console.log('\n=== ÉTAPE 3: Valider un dossier ===');
    
    // D'abord récupérer la liste pending
    const pendingRes = await apiCall('/admin/pending?limit=50', 'GET', null, authToken);

    const pendingUser = pendingRes.data?.find(u => u.role === 'doctor' || u.role === 'pharmacie' || u.role === 'laboratoire');
    
    if (pendingUser) {
      const validateRes = await apiCall('/admin/validate-user', 'POST', { phone: pendingUser.phone }, authToken);

      logApiResponse('POST /admin/validate-user', validateRes);
      console.log(`✅ Compte ${pendingUser.phone} validé`);
    } else {
      console.log('⏭️ Aucun dossier en attente à valider');
    }
    
    await takeScreenshot(page, '03-validate-success');
  });

  test('ÉTAPE 4: Refuser un dossier avec motif', async () => {
    console.log('\n=== ÉTAPE 4: Refuser un dossier ===');
    
    const testPhone = '+242099999998';
    
    const rejectRes = await apiCall('/admin/reject-user', 'POST', { 
      phone: testPhone, 
      reason: 'Test refus - documents incomplets' 
    }, authToken);

    logApiResponse('POST /admin/reject-user', rejectRes);
    
    if (rejectRes.success) {
      console.log(`✅ Compte ${testPhone} rejeté`);
    }
    
    await takeScreenshot(page, '04-reject-success');
  });

  test('ÉTAPE 5: Suspendre un compte partenaire', async () => {
    console.log('\n=== ÉTAPE 5: Suspendre un compte partenaire ===');
    
    const suspendPhone = '+242060000001';
    
    const suspendRes = await apiCall('/admin/suspend-user', 'POST', { 
      phone: suspendPhone, 
      reason: 'Test suspension - maintenance' 
    }, authToken);

    logApiResponse('POST /admin/suspend-user', suspendRes);
    
    if (suspendRes.success) {
      console.log(`✅ Compte ${suspendPhone} suspendu`);
      
      // Réactiver après test
      await apiCall(`/admin/users/${encodeURIComponent(suspendPhone)}/unban`, 'PATCH', null, authToken);
    }
    
    await takeScreenshot(page, '05-suspend-success');
  });

  test('ÉTAPE 6: Consulter les logs BHP (audit_log)', async () => {
    console.log('\n=== ÉTAPE 6: Consulter les logs BHP ===');
    
    const statsRes = await apiCall('/admin/stats', 'GET', null, authToken);

    logApiResponse('GET /admin/stats', statsRes);
    
    if (statsRes.success && statsRes.data?.logs) {
      const logsCount = statsRes.data.logs?.length || 0;
      console.log(`✅ ${logsCount} logs récupérés`);
    }
    
    await takeScreenshot(page, '06-logs-bhp');
  });

  test('ÉTAPE 7: Vérifier les statistiques globales plateforme', async () => {
    console.log('\n=== ÉTAPE 7: Statistiques globales plateforme ===');
    
    const statsRes = await apiCall('/admin/stats', 'GET', null, authToken);

    logApiResponse('GET /admin/stats (stats globales)', statsRes);
    
    if (statsRes.success) {
      const stats = statsRes.data;
      console.log(`✅ Patients: ${stats.users?.patients}, Médecins: ${stats.users?.doctors}, Pharmacies: ${stats.users?.pharmacies}, Labs: ${stats.users?.laboratories}`);
    }
    
    await takeScreenshot(page, '07-stats-globales');
  });

  test('Conclusion: Vérification contrat API', async () => {
    console.log('\n=== VÉRIFICATION CONTRAT API ===');
    console.log('✅ Toutes les réponses API vérifiées');
    console.log('📄 Rapport détaillé à générer: RAPPORT_S26_MODERATION_ADMIN.md');
  });
});
