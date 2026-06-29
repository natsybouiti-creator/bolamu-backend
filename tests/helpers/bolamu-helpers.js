const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.TEST_BASE_URL || 'https://www.bolamu.co';
const API_URL = process.env.TEST_API_URL || 'https://api.bolamu.co/api/v1';

const COMPTES = {
  patient:     { phone: '+242069735418', password: 'TestNouveau2026!' },
  agent:       { phone: '+242077000010', password: 'bolamu2026' },
  admin:       { phone: '+242060000099', password: 'bolamu2026' },
  medecin:     { phone: '+242060000001', password: 'bolamu2026' },
  secretaire:  { phone: '+242077000001', password: 'bolamu2026' },
  pharmacie:   { phone: '+242066226116', password: 'WR383LMW' },
  laboratoire: { phone: '+242068582563', password: 'bolamu2026' },
  partenaire:  { phone: '+242063125478', password: 'bolamu2026' },
  rh:          { phone: '+242077000002', password: 'bolamu2026' },
  animateur:   { phone: '+242000000088', password: 'bolamu2026' },
};

const LOGIN_CONFIG = {
  patient:     { url: '/login.html',             tokenKey: 'bolamu_patient_token',    dashboardPattern: '**/patient/dashboard.html',    phoneId: '#phone-input', passwordId: '#password-input' },
  agent:       { url: '/agence/login.html',      tokenKey: 'bolamu_agent_token',      dashboardPattern: '**/agence/dashboard.html',      phoneId: '#phone',      passwordId: '#password' },
  admin:       { url: '/admin/login.html',       tokenKey: 'bolamu_admin_token',      dashboardPattern: '**/admin/dashboard.html',       phoneId: '#phone',      passwordId: '#password' },
  medecin:     { url: '/login.html',             tokenKey: 'bolamu_medecin_token',    dashboardPattern: '**/medecin/dashboard.html',    phoneId: '#phone-input', passwordId: '#password-input' },
  secretaire:  { url: '/secretaire/login.html',  tokenKey: 'bolamu_secretaire_token', dashboardPattern: '**/secretaire/dashboard.html', phoneId: '#phone',      passwordId: '#password' },
  pharmacie:   { url: '/login.html',             tokenKey: 'bolamu_pharmacie_token',  dashboardPattern: '**/pharmacie/dashboard.html',  phoneId: '#phone-input', passwordId: '#password-input' },
  laboratoire: { url: '/login.html',             tokenKey: 'bolamu_labo_token',       dashboardPattern: '**/laboratoire/dashboard.html',phoneId: '#phone-input', passwordId: '#password-input' },
  partenaire:  { url: '/partenaire/login.html',  tokenKey: 'bolamu_partenaire_token', dashboardPattern: '**/partenaire/dashboard.html',phoneId: '#phone',      passwordId: '#password' },
  rh:          { url: '/rh/login.html',          tokenKey: 'bolamu_rh_token',         dashboardPattern: '**/rh/dashboard.html',         phoneId: '#phone',      passwordId: '#password' },
  animateur:   { url: '/animateur/login.html',   tokenKey: 'bolamu_animateur_token',  dashboardPattern: '**/animateur/dashboard.html', phoneId: '#phone',      passwordId: '#password' },
};

// Login via la vraie page login HTML
async function loginAs(page, role, phone, password) {
  const config = LOGIN_CONFIG[role];
  if (!config) throw new Error(`Rôle inconnu : ${role}`);

  // Bloquer le chargement des polices (3.9MB MaterialSymbolsOutlined.woff2)
  await page.route('**/*.woff2', route => route.abort());
  await page.route('**/*.woff', route => route.abort());
  await page.route('**/*.ttf', route => route.abort());

  await page.goto(`${BASE_URL}${config.url}`);
  await page.waitForLoadState('domcontentloaded');

  // Attendre que les champs soient visibles
  await page.waitForSelector(config.phoneId, { state: 'visible', timeout: 10000 });
  await page.fill(config.phoneId, phone || COMPTES[role].phone);
  await page.fill(config.passwordId, password || COMPTES[role].password);
  
  // Attendre que le bouton soit enabled
  await page.waitForSelector('#btn-login', { state: 'visible', timeout: 5000 });
  await page.click('#btn-login');

  await page.waitForURL(config.dashboardPattern, { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');

  const token = await page.evaluate(
    (key) => localStorage.getItem(key),
    config.tokenKey
  );

  if (!token) throw new Error(`Login échoué pour ${role} — token absent`);

  console.log(`✅ ${role} connecté`);
  return token;
}

// Attendre que window.__bolamu_test soit disponible
async function waitForProtocol(page) {
  await page.waitForFunction(
    () => typeof window.__bolamu_test === 'object' && window.__bolamu_test !== null,
    { timeout: 10000 }
  );
}

// Attendre chargement complet + protocole
async function waitForDashboard(page) {
  await page.waitForLoadState('networkidle');
  await waitForProtocol(page);
}

// Uploader un fichier fixture via input file
async function uploadFixture(page, inputSelector, fixtureName) {
  const fPath = path.join(__dirname, '../fixtures', fixtureName);
  if (!fs.existsSync(fPath)) {
    throw new Error(`Fixture introuvable : ${fPath}`);
  }
  const input = page.locator(inputSelector);
  await input.setInputFiles(fPath);
  console.log(`📎 Fichier uploadé : ${fixtureName}`);
}

// Intercepter les dialogs natifs
function handleDialogs(page, action = 'accept') {
  page.on('dialog', async dialog => {
    console.log(`💬 Dialog : ${dialog.message()}`);
    action === 'accept' ? await dialog.accept() : await dialog.dismiss();
  });
}

// Lire l'état via le protocole
async function getState(page) {
  await waitForProtocol(page);
  return await page.evaluate(() => window.__bolamu_test.getState());
}

// Appel API direct depuis Node (pas depuis le browser)
async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${endpoint}`, options);
  return res.json();
}

// Chemin absolu vers un fichier fixture
function fixturePath(name) {
  return path.join(__dirname, '../fixtures', name);
}

// Screenshot avec nom standardisé
async function screenshot(page, scenarioCode, step, label) {
  const dir = `screenshots-${scenarioCode.toLowerCase()}`;
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${dir}/${String(step).padStart(2, '0')}-${label}.png`;
  await page.screenshot({ path: filename });
  console.log(`📸 Screenshot : ${filename}`);
  return filename;
}

// Générer un rapport markdown pour un scénario
function genererRapport(scenarioCode, scenarioNom, resultats, bugs, screenshots) {
  const date = new Date().toISOString();
  const statutGlobal = bugs.length === 0 ? '✅ VALIDÉ' : '⚠️ PARTIEL';

  let md = `# RAPPORT ${scenarioCode} — ${scenarioNom}\n`;
  md += `## Statut : ${statutGlobal}\n`;
  md += `## Date : ${date}\n\n`;

  md += `## Résultats par couche\n\n`;
  md += `| Couche | Statut | Détails |\n`;
  md += `|--------|--------|--------|\n`;
  for (const [couche, r] of Object.entries(resultats)) {
    md += `| ${couche} | ${r.statut} | ${r.details} |\n`;
  }

  if (bugs.length > 0) {
    md += `\n## Bugs identifiés\n\n`;
    bugs.forEach(bug => {
      md += `- **${bug.code}** : ${bug.description}\n`;
    });
  }

  if (screenshots.length > 0) {
    md += `\n## Screenshots\n\n`;
    screenshots.forEach(s => md += `- ${s}\n`);
  }

  const rapportsDir = path.join(__dirname, '../../docs/rapports');
  fs.mkdirSync(rapportsDir, { recursive: true });
  const fichier = path.join(rapportsDir, `RAPPORT_${scenarioCode}.md`);
  fs.writeFileSync(fichier, md);
  console.log(`📄 Rapport généré : ${fichier}`);

  mettreAJourRapportGlobal(scenarioCode, scenarioNom, statutGlobal, bugs);
}

// Mettre à jour le rapport global
function mettreAJourRapportGlobal(scenarioCode, scenarioNom, statut, bugs) {
  const fichierGlobal = path.join(__dirname, '../../docs/rapports/RAPPORT_TESTS_GLOBAL.md');

  let contenu = '';
  if (fs.existsSync(fichierGlobal)) {
    contenu = fs.readFileSync(fichierGlobal, 'utf8');
  } else {
    contenu = `# RAPPORT TESTS GLOBAL BOLAMU\n\n`;
    contenu += `| Scénario | Nom | Statut | Bugs | Date |\n`;
    contenu += `|----------|-----|--------|------|------|\n`;
  }

  const date = new Date().toISOString().split('T')[0];
  const ligne = `| ${scenarioCode} | ${scenarioNom} | ${statut} | ${bugs.length} | ${date} |\n`;

  if (contenu.includes(`| ${scenarioCode} |`)) {
    contenu = contenu.replace(
      new RegExp(`\\| ${scenarioCode} \\|.*\\n`),
      ligne
    );
  } else {
    contenu += ligne;
  }

  fs.writeFileSync(fichierGlobal, contenu);
}

module.exports = {
  loginAs,
  waitForProtocol,
  waitForDashboard,
  uploadFixture,
  handleDialogs,
  getState,
  apiCall,
  fixturePath,
  screenshot,
  genererRapport,
  mettreAJourRapportGlobal,
  COMPTES,
  LOGIN_CONFIG,
  BASE_URL,
  API_URL,
};
