const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3005';

// Logger vers fichier + console
const logFile = path.join(__dirname, 'setup.log');
function log(msg) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

const COMPTES = {
  patient: {
    url: '/patient/login.html',
    phone: '+242069735418',
    password: 'TestNouveau2026!',
    tokenKey: 'bolamu_patient_token',
    dashboardPattern: '**/patient/dashboard.html'
  },
  agent: {
    url: '/agence/login.html',
    phone: '+242077000010',
    password: 'bolamu2026',
    tokenKey: 'bolamu_agent_token',
    dashboardPattern: '**/agence/dashboard.html'
  },
  admin: {
    url: '/admin/login.html',
    phone: '+242060000099',
    password: 'bolamu2026',
    tokenKey: 'bolamu_admin_token',
    dashboardPattern: '**/admin/dashboard.html'
  },
  medecin: {
    url: '/login.html',
    phone: '+242060000001',
    password: 'bolamu2026',
    tokenKey: 'bolamu_medecin_token',
    dashboardPattern: '**/medecin/dashboard.html'
  },
  secretaire: {
    url: '/secretaire/login.html',
    phone: '+242077000001',
    password: 'bolamu2026',
    tokenKey: 'bolamu_secretaire_token',
    dashboardPattern: '**/secretaire/dashboard.html'
  },
  pharmacie: {
    url: '/pharmacie/login.html',
    phone: '+242066226116',
    password: 'WR383LMW',
    tokenKey: 'bolamu_pharmacie_token',
    dashboardPattern: '**/pharmacie/dashboard.html'
  },
  laboratoire: {
    url: '/laboratoire/login.html',
    phone: '+242068582563',
    password: 'bolamu2026',
    tokenKey: 'bolamu_labo_token',
    dashboardPattern: '**/laboratoire/dashboard.html'
  },
  rh: {
    url: '/rh/login.html',
    phone: '+242077000002',
    password: 'bolamu2026',
    tokenKey: 'bolamu_rh_token',
    dashboardPattern: '**/rh/dashboard.html'
  },
};

async function loginAndSave(browser, role, compte) {
  log(`[Setup] Login ${role}...`);
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Intercepter les dialogs
    page.on('dialog', async dialog => {
      log(`[Setup] Dialog ${role}: ${dialog.message()}`);
      await dialog.dismiss();
    });

    // Naviguer vers la page login
    await page.goto(`${BASE_URL}${compte.url}`);
    await page.waitForLoadState('networkidle');

    // Remplir les champs login
    await page.fill('#phone', compte.phone);
    await page.fill('#password', compte.password);
    await page.click('#btn-login');

    // Attendre la redirection vers le dashboard
    await page.waitForURL(compte.dashboardPattern, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Vérifier le token
    const token = await page.evaluate(
      (key) => localStorage.getItem(key),
      compte.tokenKey
    );

    if (!token) {
      throw new Error(`Token absent pour ${role} — login échoué`);
    }

    // Sauvegarder la session
    const sessionsDir = path.join(__dirname, 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });
    await context.storageState({
      path: path.join(sessionsDir, `${role}.json`)
    });

    log(`[Setup] ✅ ${role} — session sauvegardée`);

  } catch (err) {
    log(`[Setup] ❌ ${role} échoué : ${err.message}`);
  } finally {
    await context.close();
  }
}

async function globalSetup() {
  // Nettoyer le fichier log précédent
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

  log('\n========================================');
  log('[Setup] BOLAMU — Global Setup démarré');
  log('========================================\n');

  // Vérifier les fixtures
  const fixturesDir = path.join(__dirname, '../fixtures');
  if (fs.existsSync(fixturesDir)) {
    const fixtures = fs.readdirSync(fixturesDir);
    log('[Setup] Fixtures disponibles : ' + fixtures.join(', '));
  } else {
    log('[Setup] ⚠️ Dossier fixtures absent : ' + fixturesDir);
  }

  // Vérifier que l'API répond
  try {
    const apiUrl = process.env.TEST_API_URL || 'http://localhost:3005/api/v1';
    const res = await fetch(`${apiUrl}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+242060000099', password: 'bolamu2026' })
    });
    log('[Setup] API Bolamu : ' + (res.ok ? '✅ ' + res.status : '⚠️ ' + res.status));
  } catch (err) {
    log('[Setup] ❌ API inaccessible : ' + err.message);
    process.exit(1);
  }

  // Lancer le browser
  const browser = await chromium.launch({ headless: true });

  // Login séquentiel pour éviter les conflits
  for (const [role, compte] of Object.entries(COMPTES)) {
    await loginAndSave(browser, role, compte);
  }

  await browser.close();

  log('\n========================================');
  log('[Setup] ✅ Global Setup terminé');
  log('========================================\n');
}

module.exports = globalSetup;

// Exécution standalone si appelé directement via node
if (require.main === module) {
  globalSetup().catch(err => {
    console.error('Erreur fatale:', err);
    process.exit(1);
  });
}
