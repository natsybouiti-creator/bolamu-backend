// TEST S26 — MODÉRATION PLATEFORME ADMIN
// Script Node.js pur (sans framework Playwright Test)
// Compte admin : +242060000099 / bolamu2026

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const ADMIN_PHONE = '+242060000099';
const ADMIN_PASSWORD = 'bolamu2026';
const BASE_URL = 'http://localhost:3005';
const API_URL = 'http://localhost:3005/api/v1';
const SCREENSHOT_DIR = path.join(__dirname, '../screenshots-s26');

// Créer le dossier de screenshots
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const results = {
  steps: [],
  apiResponses: [],
  violations: [],
  bugs: []
};

let authToken = null;

function logStep(step, status, details = '') {
  const entry = { step, status, details, timestamp: new Date().toISOString() };
  results.steps.push(entry);
  console.log(`[${status === 'success' ? '✅' : status === 'failed' ? '❌' : '⏭️'}] ${step} ${details ? '- ' + details : ''}`);
}

function logApiCall(endpoint, response) {
  results.apiResponses.push({ endpoint, response, timestamp: new Date().toISOString() });
  console.log(`📡 API: ${endpoint} → ${JSON.stringify(response).substring(0, 200)}...`);
}

async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${API_URL}${endpoint}`, options);
  const data = await response.json();
  logApiCall(`${method} ${endpoint}`, data);
  return data;
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('\n=== DÉBUT TEST MODÉRATION ADMIN ===\n');

    // ÉTAPE 1 : Admin se connecte
    logStep('ÉTAPE 1: Connexion admin', 'in_progress');
    
    const loginRes = await apiCall('/auth/admin-login', 'POST', {
      phone: ADMIN_PHONE,
      password: ADMIN_PASSWORD
    });
    
    if (loginRes.success) {
      authToken = loginRes.accessToken || loginRes.data?.access_token || loginRes.data?.accessToken;
      logStep('ÉTAPE 1: Connexion admin', 'success', 'JWT reçu');
      
      await page.goto(`${BASE_URL}/admin/dashboard.html`);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-login-success.png'), fullPage: true });
    } else {
      logStep('ÉTAPE 1: Connexion admin', 'failed', loginRes.message);
      results.bugs.push('Login admin échoué');
      throw new Error('Login admin échoué');
    }

    // ÉTAPE 2 : Voir la liste des dossiers en attente
    logStep('ÉTAPE 2: Liste dossiers en attente', 'in_progress');
    
    const pendingRes = await apiCall('/admin/pending?limit=50');
    
    if (pendingRes.success) {
      const pendingCount = pendingRes.data?.length || 0;
      logStep('ÉTAPE 2: Liste dossiers en attente', 'success', `${pendingCount} dossiers en attente`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-pending-list.png'), fullPage: true });
    } else {
      logStep('ÉTAPE 2: Liste dossiers en attente', 'failed', pendingRes.message);
      results.bugs.push('Récupération pending échouée');
    }

    // ÉTAPE 3 : Valider un dossier
    logStep('ÉTAPE 3: Valider un dossier', 'in_progress');
    
    const pendingUser = pendingRes.data?.find(u => u.role === 'doctor' || u.role === 'pharmacie' || u.role === 'laboratoire');
    
    if (pendingUser) {
      const validateRes = await apiCall('/admin/validate-user', 'POST', { phone: pendingUser.phone });
      
      if (validateRes.success) {
        logStep('ÉTAPE 3: Valider un dossier', 'success', `Compte ${pendingUser.phone} validé`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-validate-success.png'), fullPage: true });
      } else {
        logStep('ÉTAPE 3: Valider un dossier', 'failed', validateRes.message);
        results.bugs.push('Validation dossier échouée');
      }
    } else {
      logStep('ÉTAPE 3: Valider un dossier', 'skipped', 'Aucun dossier en attente à valider');
    }

    // ÉTAPE 4 : Refuser un dossier
    logStep('ÉTAPE 4: Refuser un dossier', 'in_progress');
    
    const testPhone = '+242099999998';
    
    try {
      await apiCall('/admin/validate-user', 'POST', { phone: testPhone });
    } catch(e) {}
    
    const rejectRes = await apiCall('/admin/reject-user', 'POST', { 
      phone: testPhone, 
      reason: 'Test refus - documents incomplets' 
    });
    
    if (rejectRes.success) {
      logStep('ÉTAPE 4: Refuser un dossier', 'success', `Compte ${testPhone} rejeté`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-reject-success.png'), fullPage: true });
    } else {
      logStep('ÉTAPE 4: Refuser un dossier', 'failed', rejectRes.message);
      results.bugs.push('Rejet dossier échoué');
    }

    // ÉTAPE 5 : Suspendre un compte partenaire
    logStep('ÉTAPE 5: Suspendre un compte partenaire', 'in_progress');
    
    const suspendPhone = '+242060000001';
    
    const suspendRes = await apiCall('/admin/suspend-user', 'POST', { 
      phone: suspendPhone, 
      reason: 'Test suspension - maintenance' 
    });
    
    if (suspendRes.success) {
      logStep('ÉTAPE 5: Suspendre un compte partenaire', 'success', `Compte ${suspendPhone} suspendu`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-suspend-success.png'), fullPage: true });
      
      await apiCall(`/admin/users/${encodeURIComponent(suspendPhone)}/unban`, 'PATCH');
    } else {
      logStep('ÉTAPE 5: Suspendre un compte partenaire', 'failed', suspendRes.message);
      results.bugs.push('Suspension compte échouée');
    }

    // ÉTAPE 6 : Consulter les logs BHP
    logStep('ÉTAPE 6: Consulter les logs BHP', 'in_progress');
    
    const statsRes = await apiCall('/admin/stats');
    
    if (statsRes.success && statsRes.data?.logs) {
      const logsCount = statsRes.data.logs?.length || 0;
      logStep('ÉTAPE 6: Consulter les logs BHP', 'success', `${logsCount} logs récupérés`);
      console.log('📋 Logs récents:', JSON.stringify(statsRes.data.logs, null, 2));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-logs-bhp.png'), fullPage: true });
    } else {
      logStep('ÉTAPE 6: Consulter les logs BHP', 'failed', 'Logs non récupérés');
      results.bugs.push('Logs BHP non accessibles');
    }

    // ÉTAPE 7 : Statistiques globales
    logStep('ÉTAPE 7: Statistiques globales plateforme', 'in_progress');
    
    if (statsRes.success) {
      const stats = statsRes.data;
      logStep('ÉTAPE 7: Statistiques globales plateforme', 'success', 
        `Patients: ${stats.users?.patients}, Médecins: ${stats.users?.doctors}, Pharmacies: ${stats.users?.pharmacies}, Labs: ${stats.users?.laboratories}`);
      console.log('📊 Stats globales:', JSON.stringify(stats, null, 2));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-stats-globales.png'), fullPage: true });
    } else {
      logStep('ÉTAPE 7: Statistiques globales plateforme', 'failed', 'Stats non récupérées');
      results.bugs.push('Stats globales non accessibles');
    }

    // Vérification contrat API
    console.log('\n=== VÉRIFICATION CONTRAT API ===\n');
    
    const apiViolations = [];
    results.apiResponses.forEach(api => {
      if (!api.response.hasOwnProperty('success')) {
        apiViolations.push(`${api.endpoint}: missing 'success' field`);
      }
      if (api.response.success && !api.response.hasOwnProperty('data')) {
        apiViolations.push(`${api.endpoint}: missing 'data' field on success`);
      }
      if (!api.response.success && !api.response.hasOwnProperty('message')) {
        apiViolations.push(`${api.endpoint}: missing 'message' field on error`);
      }
    });
    
    if (apiViolations.length > 0) {
      results.violations = apiViolations;
      console.log('⚠️ Violations contrat API détectées:');
      apiViolations.forEach(v => console.log('  -', v));
    } else {
      console.log('✅ Aucune violation contrat API détectée');
    }

  } catch (error) {
    console.error('❌ Erreur critique:', error.message);
    results.bugs.push(`Erreur critique: ${error.message}`);
  } finally {
    await browser.close();
  }

  // Générer rapport
  const reportPath = path.join(__dirname, '../RAPPORT_S26_MODERATION_ADMIN.md');
  const reportContent = generateReport();
  fs.writeFileSync(reportPath, reportContent);
  console.log(`\n📄 Rapport généré: ${reportPath}`);
}

function generateReport() {
  const successSteps = results.steps.filter(s => s.status === 'success').length;
  const failedSteps = results.steps.filter(s => s.status === 'failed').length;
  const skippedSteps = results.steps.filter(s => s.status === 'skipped').length;
  
  let report = `# RAPPORT S26 — MODÉRATION ADMIN\n\n`;
  report += `> Test exécuté le ${new Date().toISOString()}\n`;
  report += `> Compte admin: ${ADMIN_PHONE}\n\n`;
  
  report += `## RÉSUMÉ\n\n`;
  report += `- **Étapes réussies:** ${successSteps} ✅\n`;
  report += `- **Étapes échouées:** ${failedSteps} ❌\n`;
  report += `- **Étapes ignorées:** ${skippedSteps} ⏭️\n\n`;
  
  report += `## ÉTAPES DU TEST\n\n`;
  results.steps.forEach(step => {
    const icon = step.status === 'success' ? '✅' : step.status === 'failed' ? '❌' : '⏭️';
    report += `${icon} **${step.step}**\n`;
    if (step.details) report += `   ${step.details}\n`;
    report += `   _${step.timestamp}_\n\n`;
  });
  
  report += `## RÉPONSES API\n\n`;
  results.apiResponses.forEach(api => {
    report += `### ${api.endpoint}\n`;
    report += `\`\`\`json\n${JSON.stringify(api.response, null, 2)}\n\`\`\`\n\n`;
  });
  
  if (results.violations.length > 0) {
    report += `## VIOLATIONS CONTRAT API\n\n`;
    results.violations.forEach(v => {
      report += `- ❌ ${v}\n`;
    });
    report += `\n`;
  } else {
    report += `## VIOLATIONS CONTRAT API\n\n✅ Aucune violation détectée\n\n`;
  }
  
  if (results.bugs.length > 0) {
    report += `## BUGS IDENTIFIÉS\n\n`;
    results.bugs.forEach(bug => {
      report += `- 🐛 ${bug}\n`;
    });
    report += `\n`;
  } else {
    report += `## BUGS IDENTIFIÉS\n\n✅ Aucun bug détecté\n\n`;
  }
  
  report += `## CORRECTIONS À FAIRE\n\n`;
  if (results.bugs.length > 0) {
    results.bugs.forEach(bug => {
      report += `- [ ] Corriger: ${bug}\n`;
    });
  } else {
    report += `Aucune correction requise.\n`;
  }
  
  return report;
}

main().catch(console.error);
