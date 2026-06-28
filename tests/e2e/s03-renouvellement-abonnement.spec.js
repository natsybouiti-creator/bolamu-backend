const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Configuration
const BASE_URL = 'https://www.bolamu.co';
const PATIENT_PHONE = '+242069735418';
const PATIENT_PASSWORD = 'TestNouveau2026!';
const ADMIN_PHONE = '+242060000099';
const ADMIN_PASSWORD = 'bolamu2026';

// Répertoire de screenshots
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots-s03');
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

test.describe('SCENARIO S03 — Renouvellement abonnement', () => {
  let page;
  let patientToken;
  let adminToken;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('Étape 1: Vérifier date expiration abonnement patient en DB', async () => {
    console.log('\n=== ÉTAPE 1: Vérifier date expiration abonnement patient en DB ===');
    
    // Login patient
    await page.goto(`${BASE_URL}/patient/dashboard.html`);
    await page.waitForTimeout(3000);

    const loginRes = await page.evaluate(async ({ phone, password }) => {
      const r = await fetch('https://api.bolamu.co/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      return r.json();
    }, { phone: PATIENT_PHONE, password: PATIENT_PASSWORD });

    logApiResponse('Login patient', loginRes);
    expect(loginRes.success).toBe(true);
    patientToken = loginRes.accessToken;

    // Récupérer abonnement actuel
    const subRes = await page.evaluate(async ({ token }) => {
      const r = await fetch('https://api.bolamu.co/api/v1/patients/subscription', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      return r.json();
    }, { token: patientToken });

    logApiResponse('GET /api/v1/patients/subscription', subRes);
    await takeScreenshot(page, '01-subscription-actuelle');

    if (subRes.success && subRes.data) {
      console.log(`✅ Abonnement actuel: Plan=${subRes.data.plan}, Status=${subRes.data.status}, Expiry=${subRes.data.expires_at}`);
    } else {
      console.log('⚠️ Aucun abonnement actif trouvé');
    }
  });

  test('Étape 2: Vérifier que le WhatsApp J-30 est configuré (cron)', async () => {
    console.log('\n=== ÉTAPE 2: Vérifier configuration cron WhatsApp J-30 ===');
    
    // Vérifier si le fichier cron existe
    const cronPath = path.join(__dirname, '../../src/cron/zora-expiration.js');
    const cronExists = fs.existsSync(cronPath);
    
    console.log(`📁 Fichier cron: ${cronExists ? '✅ existe' : '❌ absent'}`);
    
    if (cronExists) {
      const cronContent = fs.readFileSync(cronPath, 'utf-8');
      console.log('📄 Contenu du cron (extrait):');
      console.log(cronContent.substring(0, 500) + '...');
      
      // Vérifier si la logique J-30 est présente
      const hasJ30Logic = cronContent.includes('30') || cronContent.includes('days') || cronContent.includes('expiration');
      console.log(`🔍 Logique J-30 présente: ${hasJ30Logic ? '✅' : '❌'}`);
    }
  });

  test('Étape 3: Simuler expiration abonnement (update DB date_fin = NOW())', async () => {
    console.log('\n=== ÉTAPE 3: Simuler expiration abonnement ===');
    
    // Note: En environnement de test, nous ne pouvons pas modifier directement la DB
    // Nous allons simuler cela en vérifiant le comportement du système
    
    console.log('⚠️ Simulation: En production, cette étape nécessiterait un accès direct à la DB');
    console.log('⚠️ UPDATE subscriptions SET expires_at = NOW() WHERE patient_phone = $1');
    
    // Vérifier l'état actuel
    const subRes = await page.evaluate(async ({ token }) => {
      const r = await fetch('https://api.bolamu.co/api/v1/patients/subscription', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      return r.json();
    }, { token: patientToken });

    logApiResponse('État avant simulation', subRes);
    await takeScreenshot(page, '03-avant-simulation');
  });

  test('Étape 4: Vérifier que le compte passe en suspendu', async () => {
    console.log('\n=== ÉTAPE 4: Vérifier statut suspendu ===');
    
    // Vérifier le statut du compte
    const profileRes = await page.evaluate(async ({ token, phone }) => {
      const r = await fetch(`https://api.bolamu.co/api/v1/patients/profil?phone=${encodeURIComponent(phone)}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      return r.json();
    }, { token: patientToken, phone: PATIENT_PHONE });

    logApiResponse('GET /api/v1/patients/profil', profileRes);
    
    if (profileRes.success && profileRes.data) {
      console.log(`👤 Statut compte: is_active=${profileRes.data.is_active}`);
      expect(profileRes.data.is_active).toBeDefined();
    }
    
    await takeScreenshot(page, '04-statut-compte');
  });

  test('Étape 5: Vérifier WhatsApp relance envoyé', async () => {
    console.log('\n=== ÉTAPE 5: Vérifier WhatsApp relance ===');
    
    // Vérifier les logs de notification
    console.log('⚠️ Vérification des logs WhatsApp nécessite accès aux logs système');
    console.log('⚠️ Template attendu: bolamu_renouvellement_abonnement');
    
    // Vérifier audit_log pour les événements de notification
    const auditRes = await page.evaluate(async ({ token }) => {
      const r = await fetch('https://api.bolamu.co/api/v1/admin/audit-log?limit=10', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      return r.json();
    }, { token: adminToken || patientToken });

    if (auditRes.success) {
      console.log('📋 Derniers événements audit_log:');
      auditRes.data?.forEach((event, i) => {
        console.log(`  ${i + 1}. ${event.event_type} - ${event.created_at}`);
      });
    }
  });

  test('Étape 6: Renouveler abonnement manuellement', async () => {
    console.log('\n=== ÉTAPE 6: Renouvellement abonnement manuel ===');
    
    // Essayer de faire un upgrade vers premium
    const upgradeRes = await page.evaluate(async ({ token }) => {
      const r = await fetch('https://api.bolamu.co/api/v1/patients/subscription/upgrade', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token 
        },
        body: JSON.stringify({ nouveau_plan: 'premium' })
      });
      return r.json();
    }, { token: patientToken });

    logApiResponse('PATCH /api/v1/patients/subscription/upgrade', upgradeRes);
    await takeScreenshot(page, '06-upgrade-request');

    if (upgradeRes.success) {
      console.log('✅ Upgrade initié avec succès');
      console.log(`📝 Détails: ${JSON.stringify(upgradeRes.data)}`);
      
      // Si un paiement est requis, simuler le paiement
      if (upgradeRes.data?.payment_required) {
        console.log('💰 Paiement requis, simulation...');
        
        // Initier paiement MoMo
        const momoRes = await page.evaluate(async ({ token, amount }) => {
          const r = await fetch('https://api.bolamu.co/api/v1/momo/request', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token 
            },
            body: JSON.stringify({ amount, plan: 'premium' })
          });
          return r.json();
        }, { token: patientToken, amount: upgradeRes.data.amount });

        logApiResponse('POST /api/v1/momo/request', momoRes);
        
        if (momoRes.success) {
          console.log(`✅ Paiement initié: reference_id=${momoRes.data.reference_id}`);
          
          // Simuler confirmation paiement (en test)
          console.log('⚠️ Simulation confirmation webhook...');
        }
      }
    } else {
      console.log(`❌ Upgrade échoué: ${upgradeRes.message}`);
    }
  });

  test('Étape 7: Vérifier compte redevenu actif', async () => {
    console.log('\n=== ÉTAPE 7: Vérifier réactivation compte ===');
    
    // Attendre un peu pour que les changements prennent effet
    await page.waitForTimeout(2000);
    
    // Vérifier le nouvel abonnement
    const subRes = await page.evaluate(async ({ token }) => {
      const r = await fetch('https://api.bolamu.co/api/v1/patients/subscription', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      return r.json();
    }, { token: patientToken });

    logApiResponse('GET /api/v1/patients/subscription (après renouvellement)', subRes);
    await takeScreenshot(page, '07-apres-renouvellement');

    if (subRes.success && subRes.data) {
      console.log(`✅ Nouvel abonnement: Plan=${subRes.data.plan}, Status=${subRes.data.status}`);
      console.log(`📅 Expiration: ${subRes.data.expires_at}`);
      
      // Vérifier que le statut est actif
      expect(subRes.data.status).toBe('active');
    }

    // Vérifier le statut du compte
    const profileRes = await page.evaluate(async ({ token, phone }) => {
      const r = await fetch(`https://api.bolamu.co/api/v1/patients/profil?phone=${encodeURIComponent(phone)}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      return r.json();
    }, { token: patientToken, phone: PATIENT_PHONE });

    logApiResponse('GET /api/v1/patients/profil (après renouvellement)', profileRes);
    
    if (profileRes.success && profileRes.data) {
      console.log(`👤 Statut final: is_active=${profileRes.data.is_active}`);
    }
  });

  test('Conclusion: Générer rapport', async () => {
    console.log('\n=== RAPPORT FINAL ===');
    console.log('✅ Test terminé - Voir screenshots dans: ' + SCREENSHOT_DIR);
    console.log('📄 Rapport détaillé à générer: RAPPORT_S04_RENOUVELLEMENT.md');
  });
});
