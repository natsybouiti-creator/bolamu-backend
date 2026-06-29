const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  const apiViolations = [];
  const testResults = [];

  function log(msg) {
    console.log(msg);
    logs.push(msg);
  }

  function recordTest(action, toast, consoleError, domChange, apiResponse, screenshot) {
    testResults.push({ action, toast, consoleError, domChange, apiResponse, screenshot });
  }

  // Interceptor réseau
  page.on('response', async (response) => {
    if (!response.url().includes('/api/')) return;
    try {
      const body = await response.json();
      if (body.success === undefined) {
        log(`CONTRAT_FAIL: success absent — ${response.url()}`);
        apiViolations.push({ url: response.url(), issue: 'success absent' });
      }
      if (body.success === true && body.data === undefined) {
        log(`CONTRAT_FAIL: data absent — ${response.url()}`);
        apiViolations.push({ url: response.url(), issue: 'data absent' });
      }
      if (body.success === false && !body.error?.code) {
        log(`CONTRAT_FAIL: error.code absent — ${response.url()}`);
        apiViolations.push({ url: response.url(), issue: 'error.code absent' });
      }
    } catch (e) {
      log(`CONTRAT_FAIL: non-JSON — ${response.url()}`);
      apiViolations.push({ url: response.url(), issue: 'non-JSON' });
    }
  });

  // Console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      log(`CONSOLE_ERROR: ${msg.text()}`);
    }
  });

  // Navigation login
  log('=== Navigation vers login ===');
  await page.goto('https://www.bolamu.co/login.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  log('=== Remplissage formulaire login ===');
  await page.fill('#phone-input', '+242069735418');
  await page.fill('#password-input', 'TestNouveau2026!');
  await page.waitForTimeout(2000);
  await page.click('#btn-login', { force: true, timeout: 60000 });
  await page.waitForTimeout(5000);

  // Navigation dashboard
  log('=== Navigation vers dashboard ===');
  await page.goto('https://www.bolamu.co/patient/dashboard.html');
  await page.waitForTimeout(8000);

  // Vérification protocole
  log('=== Vérification protocole ===');
  const protocolOk = await page.evaluate(() => !!window.__bolamu_test);
  if (!protocolOk) {
    log('ERREUR: Protocole absent — arrêt');
    await browser.close();
    process.exit(1);
  }
  log('✅ Protocole window.__bolamu_test disponible');

  // Helper screenshot
  let screenshotIndex = 0;
  async function takeScreenshot(name) {
    const filename = `groupes-${String(screenshotIndex).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: filename, fullPage: false, timeout: 60000 });
    log(`📸 Screenshot: ${filename}`);
    screenshotIndex++;
    return filename;
  }

  // Helper check toast
  async function checkToast() {
    const toast = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="toast-message"]');
      return el ? el.textContent : null;
    });
    return toast;
  }

  // Navigation vers sport
  log('=== Navigation vers section sport ===');
  await page.evaluate(() => window.__bolamu_test.goGagner());
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__bolamu_test.gagnerSport());
  await page.waitForTimeout(3000);
  
  const sportScreenshot = await takeScreenshot('section-sport');
  recordTest('Navigation sport', null, null, 'Section sport visible', null, sportScreenshot);

  // TEST 1 — Rejoindre groupe 2
  log('=== TEST 1 — Rejoindre groupe ID 2 ===');
  await page.evaluate(async (id) => {
    const token = localStorage.getItem('bolamu_patient_token');
    if (!token) return;
    try {
      const res = await fetch('https://api.bolamu.co/api/v1/clubs/' + id + '/join', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const d = await res.json();
      console.log('joinGroup result:', d);
    } catch (e) {
      console.error('joinGroup error:', e);
    }
  }, 2);
  await page.waitForTimeout(2000);
  
  const toast1 = await checkToast();
  const screenshot1 = await takeScreenshot('join-group-2');
  recordTest('joinGroup(2)', toast1, null, 'Groupe 2 rejoint', null, screenshot1);

  // TEST 2 — Rejoindre groupe 3
  log('=== TEST 2 — Rejoindre groupe ID 3 ===');
  await page.evaluate(async (id) => {
    const token = localStorage.getItem('bolamu_patient_token');
    if (!token) return;
    try {
      const res = await fetch('https://api.bolamu.co/api/v1/clubs/' + id + '/join', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const d = await res.json();
      console.log('joinGroup result:', d);
    } catch (e) {
      console.error('joinGroup error:', e);
    }
  }, 3);
  await page.waitForTimeout(2000);
  
  const toast2 = await checkToast();
  const screenshot2 = await takeScreenshot('join-group-3');
  recordTest('joinGroup(3)', toast2, null, 'Groupe 3 rejoint', null, screenshot2);

  // TEST 3 — Rejoindre groupe 5
  log('=== TEST 3 — Rejoindre groupe ID 5 ===');
  await page.evaluate(async (id) => {
    const token = localStorage.getItem('bolamu_patient_token');
    if (!token) return;
    try {
      const res = await fetch('https://api.bolamu.co/api/v1/clubs/' + id + '/join', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const d = await res.json();
      console.log('joinGroup result:', d);
    } catch (e) {
      console.error('joinGroup error:', e);
    }
  }, 5);
  await page.waitForTimeout(2000);
  
  const toast3 = await checkToast();
  const screenshot3 = await takeScreenshot('join-group-5');
  recordTest('joinGroup(5)', toast3, null, 'Groupe 5 rejoint', null, screenshot3);

  // TEST 4 — Ouvrir panel groupe 2
  log('=== TEST 4 — Ouvrir panel groupe ID 2 ===');
  await page.evaluate(() => window.__bolamu_test.openClubPanel(2));
  await page.waitForTimeout(2000);
  
  const screenshot4 = await takeScreenshot('open-club-panel-2');
  recordTest('openClubPanel(2)', null, null, 'Panel groupe 2 ouvert', null, screenshot4);

  await page.evaluate(() => window.__bolamu_test.closeClubPanel());
  log('Panel fermé');

  // TEST 5 — Créer groupe modal
  log('=== TEST 5 — Modal création groupe ===');
  await page.evaluate(() => window.__bolamu_test.openCreateGroupModal());
  await page.waitForTimeout(2000);
  
  const toast5 = await checkToast();
  const screenshot5 = await takeScreenshot('open-create-group-modal');
  recordTest('openCreateGroupModal', toast5, null, 'Modal création ouvert', null, screenshot5);

  await page.evaluate(() => window.__bolamu_test.closeCreateGroupModal());
  log('Modal fermé');

  // Génération rapport
  log('=== Génération rapport ===');
  
  let report = `# RAPPORT TEST GROUPES SPORT
> Test de rejoindre groupes avec vrais IDs
> Date: ${new Date().toISOString()}
> Compte: +242069735418

---

## Violations contrat API

`;

  if (apiViolations.length === 0) {
    report += '✅ Aucune violation contrat API détectée\n\n';
  } else {
    apiViolations.forEach(v => {
      report += `- ❌ ${v.url} — ${v.issue}\n`;
    });
    report += '\n';
  }

  report += `---

## Résultats tests

| Action | Toast affiché | Erreur console | Changement DOM | Screenshot | VERDICT |
|--------|---------------|---------------|----------------|------------|---------|
`;

  testResults.forEach(r => {
    const verdict = r.toast ? '✅' : '⚠️';
    report += `| ${r.action} | ${r.toast || 'N/A'} | ${r.consoleError || 'N/A'} | ${r.domChange || 'N/A'} | ${r.screenshot || 'N/A'} | ${verdict} |\n`;
  });

  report += `---

## Logs d'exécution

\`\`\`
${logs.join('\n')}
\`\`\`
`;

  fs.writeFileSync('RAPPORT_TEST_GROUPES_SPORT.md', report);
  log('✅ Rapport généré: RAPPORT_TEST_GROUPES_SPORT.md');

  await browser.close();
})();
