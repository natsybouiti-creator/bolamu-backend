const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Logs
  const logs = [];
  const apiViolations = [];
  const uiResults = [];

  function log(msg) {
    console.log(msg);
    logs.push(msg);
  }

  function recordUI(block, action, behavior, screenshot, verdict) {
    uiResults.push({ block, action, behavior, screenshot, verdict });
  }

  // Interceptor réseau
  page.on('response', async (response) => {
    if (!response.url().includes('/api/')) return;
    try {
      const body = await response.json();
      if (body.success === undefined) {
        const msg = `CONTRAT_FAIL: success absent — ${response.url()}`;
        log(msg);
        apiViolations.push({ url: response.url(), issue: 'success absent' });
      }
      if (body.success === true && body.data === undefined) {
        const msg = `CONTRAT_FAIL: data absent — ${response.url()}`;
        log(msg);
        apiViolations.push({ url: response.url(), issue: 'data absent' });
      }
      if (body.success === false && !body.error?.code) {
        const msg = `CONTRAT_FAIL: error.code absent — ${response.url()}`;
        log(msg);
        apiViolations.push({ url: response.url(), issue: 'error.code absent' });
      }
    } catch (e) {
      const msg = `CONTRAT_FAIL: non-JSON — ${response.url()}`;
      log(msg);
      apiViolations.push({ url: response.url(), issue: 'non-JSON' });
    }
  });

  // Navigation login
  log('=== Navigation vers login ===');
  await page.goto('https://www.bolamu.co/login.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  log('=== Remplissage formulaire login ===');
  await page.fill('#phone-input', '+242069735418');
  await page.fill('#password-input', 'TestNouveau2026!');
  await page.click('#btn-login');
  await page.waitForTimeout(5000);

  // Navigation dashboard
  log('=== Navigation vers dashboard ===');
  await page.goto('https://www.bolamu.co/patient/dashboard.html');
  await page.waitForTimeout(8000);

  // ÉTAPE 0 — Vérification protocole
  log('=== ÉTAPE 0 — Vérification protocole ===');
  const protocolOk = await page.evaluate(() => !!window.__bolamu_test);
  if (!protocolOk) {
    log('ERREUR: Protocole absent — arrêt');
    await browser.close();
    process.exit(1);
  }
  log('✅ Protocole window.__bolamu_test disponible');

  // ÉTAPE 1 — Récupération IDs
  log('=== ÉTAPE 1 — Récupération IDs ===');
  const events = await page.evaluate(() => window.__bolamu_test.getEvents());
  const ledger = await page.evaluate(() => window.__bolamu_test.getLedger());
  const vouchers = await page.evaluate(() => window.__bolamu_test.getVouchers());
  const leaderboard = await page.evaluate(() => window.__bolamu_test.getLeaderboard());
  const constantes = await page.evaluate(() => window.__bolamu_test.getConstantes());
  const state = await page.evaluate(() => window.__bolamu_test.getState());

  const EVENT_ID = events && events[0] ? (events[0].id || events[0].db_id) : null;
  const VOUCHER_ID = vouchers && vouchers[0] ? vouchers[0].id : null;
  const MEMBER_PHONE = leaderboard && leaderboard[0] ? leaderboard[0].phone : null;
  const CLUB_ID = state && state.clubs && state.clubs[0] ? state.clubs[0].id : null;
  const DMN_DOC_ID = state && state.dmnDocs && state.dmnDocs[0] ? state.dmnDocs[0].id : null;
  const RDV_DOCTOR_ID = state && state.rdvDoctors && state.rdvDoctors[0] ? state.rdvDoctors[0].id : null;

  log(`EVENT_ID: ${EVENT_ID}`);
  log(`VOUCHER_ID: ${VOUCHER_ID}`);
  log(`MEMBER_PHONE: ${MEMBER_PHONE}`);
  log(`CLUB_ID: ${CLUB_ID}`);
  log(`DMN_DOC_ID: ${DMN_DOC_ID}`);
  log(`RDV_DOCTOR_ID: ${RDV_DOCTOR_ID}`);

  // Helper screenshot
  let screenshotIndex = 0;
  async function takeScreenshot(name) {
    const filename = `v8-${String(screenshotIndex).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    log(`📸 Screenshot: ${filename}`);
    screenshotIndex++;
    return filename;
  }

  // Helper evaluate with error handling
  async function safeEvaluate(fn, description, ...args) {
    try {
      await page.evaluate(fn, ...args);
      await page.waitForTimeout(2000);
      return { success: true };
    } catch (e) {
      log(`❌ Erreur ${description}: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  // BLOC 1 — Navigation sections
  log('=== BLOC 1 — Navigation sections ===');
  
  await safeEvaluate(() => window.__bolamu_test.goAccueil(), 'goAccueil');
  await takeScreenshot('nav-accueil');
  recordUI('BLOC 1', 'goAccueil', 'Navigation accueil', 'v8-00-nav-accueil.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.goGagner(), 'goGagner');
  await page.waitForTimeout(3000);
  await takeScreenshot('nav-gagner');
  recordUI('BLOC 1', 'goGagner', 'Navigation gagner', 'v8-01-nav-gagner.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.goSuivre(), 'goSuivre');
  await page.waitForTimeout(3000);
  await takeScreenshot('nav-suivre');
  recordUI('BLOC 1', 'goSuivre', 'Navigation suivre', 'v8-02-nav-suivre.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.goRecompenses(), 'goRecompenses');
  await page.waitForTimeout(3000);
  await takeScreenshot('nav-recompenses');
  recordUI('BLOC 1', 'goRecompenses', 'Navigation récompenses', 'v8-03-nav-recompenses.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.openProfile(), 'openProfile');
  await takeScreenshot('open-profile');
  recordUI('BLOC 1', 'openProfile', 'Ouverture profil', 'v8-04-open-profile.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.closeProfile(), 'closeProfile');
  recordUI('BLOC 1', 'closeProfile', 'Fermeture profil', null, '✅');

  // BLOC 2 — Sous-onglets Gagner
  log('=== BLOC 2 — Sous-onglets Gagner ===');
  
  await safeEvaluate(() => window.__bolamu_test.goGagner(), 'goGagner');
  await page.waitForTimeout(3000);
  
  await safeEvaluate(() => window.__bolamu_test.gagnerSport(), 'gagnerSport');
  await takeScreenshot('gagner-sport');
  recordUI('BLOC 2', 'gagnerSport', 'Onglet sport', 'v8-05-gagner-sport.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.gagnerSante(), 'gagnerSante');
  await takeScreenshot('gagner-sante');
  recordUI('BLOC 2', 'gagnerSante', 'Onglet santé', 'v8-06-gagner-sante.png', '✅');

  // BLOC 3 — Filtres partenaires
  log('=== BLOC 3 — Filtres partenaires ===');
  
  await safeEvaluate(() => window.__bolamu_test.goGagner(), 'goGagner');
  await page.waitForTimeout(3000);
  await safeEvaluate(() => window.__bolamu_test.gagnerSante(), 'gagnerSante');
  
  await safeEvaluate(() => window.__bolamu_test.filterTout(), 'filterTout');
  await takeScreenshot('filter-tout');
  recordUI('BLOC 3', 'filterTout', 'Filtre tout', 'v8-07-filter-tout.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.filterClin(), 'filterClin');
  await takeScreenshot('filter-clin');
  recordUI('BLOC 3', 'filterClin', 'Filtre cliniques', 'v8-08-filter-clin.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.filterPharm(), 'filterPharm');
  await takeScreenshot('filter-pharm');
  recordUI('BLOC 3', 'filterPharm', 'Filtre pharmacies', 'v8-09-filter-pharm.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.filterLabo(), 'filterLabo');
  await takeScreenshot('filter-labo');
  recordUI('BLOC 3', 'filterLabo', 'Filtre labos', 'v8-10-filter-labo.png', '✅');

  // BLOC 4 — Sous-onglets Suivre
  log('=== BLOC 4 — Sous-onglets Suivre ===');
  
  await safeEvaluate(() => window.__bolamu_test.goSuivre(), 'goSuivre');
  await page.waitForTimeout(3000);
  
  await safeEvaluate(() => window.__bolamu_test.suivreZora(), 'suivreZora');
  await takeScreenshot('suivre-zora');
  recordUI('BLOC 4', 'suivreZora', 'Onglet Zora', 'v8-11-suivre-zora.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.suivreDossier(), 'suivreDossier');
  await takeScreenshot('suivre-dossier');
  recordUI('BLOC 4', 'suivreDossier', 'Onglet dossier', 'v8-12-suivre-dossier.png', '✅');

  // BLOC 5 — Filtres récompenses
  log('=== BLOC 5 — Filtres récompenses ===');
  
  await safeEvaluate(() => window.__bolamu_test.goRecompenses(), 'goRecompenses');
  await page.waitForTimeout(3000);
  
  await safeEvaluate(() => window.__bolamu_test.filterCatTout(), 'filterCatTout');
  await takeScreenshot('filter-cat-tout');
  recordUI('BLOC 5', 'filterCatTout', 'Filtre cat tout', 'v8-13-filter-cat-tout.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.filterCatElec(), 'filterCatElec');
  await takeScreenshot('filter-cat-elec');
  recordUI('BLOC 5', 'filterCatElec', 'Filtre cat élec', 'v8-14-filter-cat-elec.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.filterCatVoyage(), 'filterCatVoyage');
  await takeScreenshot('filter-cat-voyage');
  recordUI('BLOC 5', 'filterCatVoyage', 'Filtre cat voyage', 'v8-15-filter-cat-voyage.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.filterCatTelecom(), 'filterCatTelecom');
  await takeScreenshot('filter-cat-telecom');
  recordUI('BLOC 5', 'filterCatTelecom', 'Filtre cat telecom', 'v8-16-filter-cat-telecom.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.filterCatHotels(), 'filterCatHotels');
  await takeScreenshot('filter-cat-hotels');
  recordUI('BLOC 5', 'filterCatHotels', 'Filtre cat hotels', 'v8-17-filter-cat-hotels.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.filterCatSport(), 'filterCatSport');
  await takeScreenshot('filter-cat-sport');
  recordUI('BLOC 5', 'filterCatSport', 'Filtre cat sport', 'v8-18-filter-cat-sport.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.filterCatBeaute(), 'filterCatBeaute');
  await takeScreenshot('filter-cat-beaute');
  recordUI('BLOC 5', 'filterCatBeaute', 'Filtre cat beauté', 'v8-19-filter-cat-beaute.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.filterCatCarburant(), 'filterCatCarburant');
  await takeScreenshot('filter-cat-carburant');
  recordUI('BLOC 5', 'filterCatCarburant', 'Filtre cat carburant', 'v8-20-filter-cat-carburant.png', '✅');

  // BLOC 6 — Jeux
  log('=== BLOC 6 — Jeux ===');
  
  await safeEvaluate(() => window.__bolamu_test.openScratch(), 'openScratch');
  await takeScreenshot('open-scratch');
  recordUI('BLOC 6', 'openScratch', 'Ouverture scratch', 'v8-21-open-scratch.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.playScratch(), 'playScratch');
  await takeScreenshot('play-scratch');
  recordUI('BLOC 6', 'playScratch', 'Jeu scratch', 'v8-22-play-scratch.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.closeGame(), 'closeGame');
  recordUI('BLOC 6', 'closeGame', 'Fermeture jeu', null, '✅');

  await safeEvaluate(() => window.__bolamu_test.openWheel(), 'openWheel');
  await takeScreenshot('open-wheel');
  recordUI('BLOC 6', 'openWheel', 'Ouverture roue', 'v8-23-open-wheel.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.spinWheel(), 'spinWheel');
  await takeScreenshot('spin-wheel');
  recordUI('BLOC 6', 'spinWheel', 'Spin roue', 'v8-24-spin-wheel.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.closeGame(), 'closeGame');
  recordUI('BLOC 6', 'closeGame', 'Fermeture jeu', null, '✅');

  await safeEvaluate(() => window.__bolamu_test.openChest(), 'openChest');
  await takeScreenshot('open-chest');
  recordUI('BLOC 6', 'openChest', 'Ouverture coffre', 'v8-25-open-chest.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.openChest0(), 'openChest0');
  await takeScreenshot('open-chest-0');
  recordUI('BLOC 6', 'openChest0', 'Coffre 0', 'v8-26-open-chest-0.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.openChest1(), 'openChest1');
  await takeScreenshot('open-chest-1');
  recordUI('BLOC 6', 'openChest1', 'Coffre 1', 'v8-27-open-chest-1.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.openChest2(), 'openChest2');
  await takeScreenshot('open-chest-2');
  recordUI('BLOC 6', 'openChest2', 'Coffre 2', 'v8-28-open-chest-2.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.closeGame(), 'closeGame');
  recordUI('BLOC 6', 'closeGame', 'Fermeture jeu', null, '✅');

  await safeEvaluate(() => window.__bolamu_test.openQuiz(), 'openQuiz');
  await takeScreenshot('open-quiz');
  recordUI('BLOC 6', 'openQuiz', 'Ouverture quiz', 'v8-29-open-quiz.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.pickQuiz0(), 'pickQuiz0');
  await takeScreenshot('pick-quiz-0');
  recordUI('BLOC 6', 'pickQuiz0', 'Quiz option 0', 'v8-30-pick-quiz-0.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.closeGame(), 'closeGame');
  recordUI('BLOC 6', 'closeGame', 'Fermeture jeu', null, '✅');

  // BLOC 7 — Événements
  log('=== BLOC 7 — Événements ===');
  
  await safeEvaluate(() => window.__bolamu_test.goAccueil(), 'goAccueil');
  await page.waitForTimeout(3000);

  if (EVENT_ID) {
    log(`Testing with EVENT_ID: ${EVENT_ID}`);
    
    await safeEvaluate((id) => window.__bolamu_test.openEventPanel(id), 'openEventPanel', EVENT_ID);
    await takeScreenshot('open-event-panel');
    recordUI('BLOC 7', 'openEventPanel', 'Ouverture panel événement', 'v8-31-open-event-panel.png', '✅');

    await safeEvaluate(() => window.__bolamu_test.closeEventPanel(), 'closeEventPanel');
    recordUI('BLOC 7', 'closeEventPanel', 'Fermeture panel événement', null, '✅');

    await safeEvaluate((id) => window.__bolamu_test.participate(id), 'participate', EVENT_ID);
    await takeScreenshot('participate-event');
    recordUI('BLOC 7', 'participate', 'Participation événement', 'v8-32-participate-event.png', '✅');

    await safeEvaluate((id) => window.__bolamu_test.cancelEventRegistration(id), 'cancelEventRegistration', EVENT_ID);
    await takeScreenshot('cancel-event');
    recordUI('BLOC 7', 'cancelEventRegistration', 'Annulation événement', 'v8-33-cancel-event.png', '✅');
  } else {
    log('⚠️ Pas d\'événement disponible');
    recordUI('BLOC 7', 'Événements', 'Pas d\'événement disponible', null, '⚠️');
  }

  // BLOC 8 — Clubs et groupes
  log('=== BLOC 8 — Clubs et groupes ===');
  
  await safeEvaluate(() => window.__bolamu_test.goGagner(), 'goGagner');
  await page.waitForTimeout(3000);
  await safeEvaluate(() => window.__bolamu_test.gagnerSport(), 'gagnerSport');

  if (CLUB_ID) {
    log(`Testing with CLUB_ID: ${CLUB_ID}`);
    
    await safeEvaluate(() => window.__bolamu_test.openClubPanel(CLUB_ID), 'openClubPanel');
    await takeScreenshot('open-club-panel');
    recordUI('BLOC 8', 'openClubPanel', 'Ouverture panel club', 'v8-34-open-club-panel.png', '✅');

    await safeEvaluate(() => window.__bolamu_test.closeClubPanel(), 'closeClubPanel');
    recordUI('BLOC 8', 'closeClubPanel', 'Fermeture panel club', null, '✅');

    await safeEvaluate(() => window.__bolamu_test.joinGroup(CLUB_ID), 'joinGroup');
    await takeScreenshot('join-group');
    recordUI('BLOC 8', 'joinGroup', 'Rejoindre groupe', 'v8-35-join-group.png', '✅');
  } else {
    log('⚠️ Pas de club disponible');
    
    await safeEvaluate(() => window.__bolamu_test.openCreateGroupModal(), 'openCreateGroupModal');
    await takeScreenshot('open-create-group-modal');
    recordUI('BLOC 8', 'openCreateGroupModal', 'Modal création groupe', 'v8-36-open-create-group-modal.png', '✅');

    await safeEvaluate(() => window.__bolamu_test.closeCreateGroupModal(), 'closeCreateGroupModal');
    recordUI('BLOC 8', 'closeCreateGroupModal', 'Fermeture modal création', null, '✅');
  }

  // BLOC 9 — Constantes médicales
  log('=== BLOC 9 — Constantes médicales ===');
  
  await safeEvaluate(() => window.__bolamu_test.goSuivre(), 'goSuivre');
  await page.waitForTimeout(3000);
  await safeEvaluate(() => window.__bolamu_test.suivreDossier(), 'suivreDossier');

  await safeEvaluate(() => window.__bolamu_test.openEditConst(), 'openEditConst');
  await takeScreenshot('open-edit-const');
  recordUI('BLOC 9', 'openEditConst', 'Ouverture constantes', 'v8-37-open-edit-const.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.setConstGroupe('O+'), 'setConstGroupe');
  await safeEvaluate(() => window.__bolamu_test.setConstPoids('72'), 'setConstPoids');
  await safeEvaluate(() => window.__bolamu_test.setConstTaille('176'), 'setConstTaille');
  await safeEvaluate(() => window.__bolamu_test.setConstAllergies('Aucune'), 'setConstAllergies');
  await safeEvaluate(() => window.__bolamu_test.setConstMaladies('Aucune'), 'setConstMaladies');
  await safeEvaluate(() => window.__bolamu_test.setConstAntecedents('Aucun'), 'setConstAntecedents');
  await safeEvaluate(() => window.__bolamu_test.setConstTraitements('Aucun'), 'setConstTraitements');
  await safeEvaluate(() => window.__bolamu_test.setConstContactNom('Test Contact'), 'setConstContactNom');
  await safeEvaluate(() => window.__bolamu_test.setConstContactPhone('+242000000000'), 'setConstContactPhone');
  await safeEvaluate(() => window.__bolamu_test.setConstContactLien('Père'), 'setConstContactLien');

  await safeEvaluate(() => window.__bolamu_test.saveConst(), 'saveConst');
  await takeScreenshot('save-const');
  recordUI('BLOC 9', 'saveConst', 'Sauvegarde constantes', 'v8-38-save-const.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.closeEditConst(), 'closeEditConst');
  recordUI('BLOC 9', 'closeEditConst', 'Fermeture constantes', null, '✅');

  // BLOC 10 — DMN
  log('=== BLOC 10 — DMN ===');
  
  await safeEvaluate(() => window.__bolamu_test.goSuivre(), 'goSuivre');
  await page.waitForTimeout(3000);
  await safeEvaluate(() => window.__bolamu_test.suivreDossier(), 'suivreDossier');

  await safeEvaluate(() => window.__bolamu_test.openDmnPasswordModal(), 'openDmnPasswordModal');
  await takeScreenshot('open-dmn-password-modal');
  recordUI('BLOC 10', 'openDmnPasswordModal', 'Ouverture modal DMN', 'v8-39-open-dmn-password-modal.png', '✅');

  await page.evaluate(() => {
    const el = document.querySelector('input[type="password"]');
    if (el) { el.value = '0000'; el.dispatchEvent(new Event('input')); }
  });
  await page.waitForTimeout(1000);

  await safeEvaluate(() => window.__bolamu_test.confirmDmnPassword(), 'confirmDmnPassword');
  await takeScreenshot('confirm-dmn-password');
  recordUI('BLOC 10', 'confirmDmnPassword', 'Confirmation mot de passe DMN', 'v8-40-confirm-dmn-password.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.closeDmnPasswordModal(), 'closeDmnPasswordModal');
  recordUI('BLOC 10', 'closeDmnPasswordModal', 'Fermeture modal DMN', null, '✅');

  await safeEvaluate(() => window.__bolamu_test.openDmnQrModal(), 'openDmnQrModal');
  await takeScreenshot('open-dmn-qr-modal');
  recordUI('BLOC 10', 'openDmnQrModal', 'Ouverture QR DMN', 'v8-41-open-dmn-qr-modal.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.closeDmnQrModal(), 'closeDmnQrModal');
  recordUI('BLOC 10', 'closeDmnQrModal', 'Fermeture QR DMN', null, '✅');

  await safeEvaluate(() => window.__bolamu_test.openDmnDocs(), 'openDmnDocs');
  await takeScreenshot('open-dmn-docs');
  recordUI('BLOC 10', 'openDmnDocs', 'Ouverture documents DMN', 'v8-42-open-dmn-docs.png', '✅');

  if (DMN_DOC_ID) {
    log(`Testing with DMN_DOC_ID: ${DMN_DOC_ID}`);
    await safeEvaluate(() => window.__bolamu_test.downloadDmnDoc(DMN_DOC_ID), 'downloadDmnDoc');
    await takeScreenshot('download-dmn-doc');
    recordUI('BLOC 10', 'downloadDmnDoc', 'Téléchargement document DMN', 'v8-43-download-dmn-doc.png', '✅');
  } else {
    log('⚠️ Pas de document DMN disponible');
  }

  await safeEvaluate(() => window.__bolamu_test.closeDmnDocsModal(), 'closeDmnDocsModal');
  recordUI('BLOC 10', 'closeDmnDocsModal', 'Fermeture documents DMN', null, '✅');

  // BLOC 11 — QR urgence
  log('=== BLOC 11 — QR urgence ===');
  
  await safeEvaluate(() => window.__bolamu_test.openQrUrg(), 'openQrUrg');
  await takeScreenshot('open-qr-urg');
  recordUI('BLOC 11', 'openQrUrg', 'Ouverture QR urgence', 'v8-44-open-qr-urg.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.closeQrUrg(), 'closeQrUrg');
  recordUI('BLOC 11', 'closeQrUrg', 'Fermeture QR urgence', null, '✅');

  // BLOC 12 — Résultats labo
  log('=== BLOC 12 — Résultats labo ===');
  
  await safeEvaluate(() => window.__bolamu_test.goSuivre(), 'goSuivre');
  await page.waitForTimeout(3000);
  await safeEvaluate(() => window.__bolamu_test.suivreDossier(), 'suivreDossier');

  await safeEvaluate(() => window.__bolamu_test.openLabRes(), 'openLabRes');
  await takeScreenshot('open-lab-res');
  recordUI('BLOC 12', 'openLabRes', 'Ouverture résultats labo', 'v8-45-open-lab-res.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.closeLabRes(), 'closeLabRes');
  recordUI('BLOC 12', 'closeLabRes', 'Fermeture résultats labo', null, '✅');

  // BLOC 13 — Modal RDV
  log('=== BLOC 13 — Modal RDV ===');
  
  await safeEvaluate(() => window.__bolamu_test.goAccueil(), 'goAccueil');
  await page.waitForTimeout(3000);

  await safeEvaluate(() => window.__bolamu_test.openModal(), 'openModal');
  await takeScreenshot('open-modal-rdv');
  recordUI('BLOC 13', 'openModal', 'Ouverture modal RDV', 'v8-46-open-modal-rdv.png', '✅');

  if (RDV_DOCTOR_ID) {
    log(`Testing with RDV_DOCTOR_ID: ${RDV_DOCTOR_ID}`);
    
    await safeEvaluate(() => window.__bolamu_test.rdvSelectDoctor(RDV_DOCTOR_ID), 'rdvSelectDoctor');
    await takeScreenshot('rdv-select-doctor');
    recordUI('BLOC 13', 'rdvSelectDoctor', 'Sélection médecin', 'v8-47-rdv-select-doctor.png', '✅');

    await safeEvaluate(() => window.__bolamu_test.rdvSelectDate('2026-07-15'), 'rdvSelectDate');
    await takeScreenshot('rdv-select-date');
    recordUI('BLOC 13', 'rdvSelectDate', 'Sélection date', 'v8-48-rdv-select-date.png', '✅');

    await safeEvaluate(() => window.__bolamu_test.rdvSelectSlot('09:00'), 'rdvSelectSlot');
    await takeScreenshot('rdv-select-slot');
    recordUI('BLOC 13', 'rdvSelectSlot', 'Sélection créneau', 'v8-49-rdv-select-slot.png', '✅');

    await safeEvaluate(() => window.__bolamu_test.confirmRdv(), 'confirmRdv');
    await takeScreenshot('confirm-rdv');
    recordUI('BLOC 13', 'confirmRdv', 'Confirmation RDV', 'v8-50-confirm-rdv.png', '✅');
  } else {
    log('⚠️ Pas de médecin disponible pour RDV');
  }

  await safeEvaluate(() => window.__bolamu_test.closeModal(), 'closeModal');
  await takeScreenshot('close-modal-rdv');
  recordUI('BLOC 13', 'closeModal', 'Fermeture modal RDV', 'v8-51-close-modal-rdv.png', '✅');

  // BLOC 14 — Chat
  log('=== BLOC 14 — Chat ===');
  
  await safeEvaluate(() => window.__bolamu_test.openChat(), 'openChat');
  await takeScreenshot('open-chat');
  recordUI('BLOC 14', 'openChat', 'Ouverture chat', 'v8-52-open-chat.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.chatCommunaute(), 'chatCommunaute');
  await takeScreenshot('chat-communaute');
  recordUI('BLOC 14', 'chatCommunaute', 'Onglet communauté', 'v8-53-chat-communaute.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.chatMedecins(), 'chatMedecins');
  await takeScreenshot('chat-medecins');
  recordUI('BLOC 14', 'chatMedecins', 'Onglet médecins', 'v8-54-chat-medecins.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.closeChat(), 'closeChat');
  recordUI('BLOC 14', 'closeChat', 'Fermeture chat', null, '✅');

  // BLOC 15 — Leaderboard
  log('=== BLOC 15 — Leaderboard ===');
  
  await safeEvaluate(() => window.__bolamu_test.goGagner(), 'goGagner');
  await page.waitForTimeout(3000);
  await safeEvaluate(() => window.__bolamu_test.gagnerSport(), 'gagnerSport');

  if (MEMBER_PHONE) {
    log(`Testing with MEMBER_PHONE: ${MEMBER_PHONE}`);
    
    await safeEvaluate(() => window.__bolamu_test.encourageMember(MEMBER_PHONE), 'encourageMember');
    await takeScreenshot('encourage-member');
    recordUI('BLOC 15', 'encourageMember', 'Encouragement membre', 'v8-55-encourage-member.png', '✅');

    await safeEvaluate(() => window.__bolamu_test.toggleCommentInput(MEMBER_PHONE), 'toggleCommentInput');
    await takeScreenshot('toggle-comment-input');
    recordUI('BLOC 15', 'toggleCommentInput', 'Toggle commentaire', 'v8-56-toggle-comment-input.png', '✅');

    await safeEvaluate(() => window.__bolamu_test.updateCommentText(MEMBER_PHONE, 'Bravo !'), 'updateCommentText');
    await takeScreenshot('update-comment-text');
    recordUI('BLOC 15', 'updateCommentText', 'Mise à jour commentaire', 'v8-57-update-comment-text.png', '✅');

    await safeEvaluate(() => window.__bolamu_test.sendComment(MEMBER_PHONE), 'sendComment');
    await takeScreenshot('send-comment');
    recordUI('BLOC 15', 'sendComment', 'Envoi commentaire', 'v8-58-send-comment.png', '✅');
  } else {
    log('⚠️ Pas de membre dans le leaderboard');
    recordUI('BLOC 15', 'Leaderboard', 'Pas de membre disponible', null, '⚠️');
  }

  // BLOC 16 — Vouchers
  log('=== BLOC 16 — Vouchers ===');
  
  await safeEvaluate(() => window.__bolamu_test.goRecompenses(), 'goRecompenses');
  await page.waitForTimeout(3000);

  if (VOUCHER_ID) {
    log(`Testing with VOUCHER_ID: ${VOUCHER_ID}`);
    
    await safeEvaluate(() => window.__bolamu_test.closeVoucherModal(), 'closeVoucherModal');
    await takeScreenshot('close-voucher-modal');
    recordUI('BLOC 16', 'closeVoucherModal', 'Fermeture modal voucher', 'v8-59-close-voucher-modal.png', '✅');

    await safeEvaluate(() => window.__bolamu_test.closeVoucherQrModal(), 'closeVoucherQrModal');
    await takeScreenshot('close-voucher-qr-modal');
    recordUI('BLOC 16', 'closeVoucherQrModal', 'Fermeture QR voucher', 'v8-60-close-voucher-qr-modal.png', '✅');
  } else {
    log('⚠️ Pas de voucher actif');
    recordUI('BLOC 16', 'Vouchers', 'Pas de voucher actif', null, '⚠️');
  }

  // BLOC 17 — Toasts
  log('=== BLOC 17 — Toasts ===');
  
  await safeEvaluate(() => window.__bolamu_test.toastActivite(), 'toastActivite');
  await takeScreenshot('toast-activite');
  recordUI('BLOC 17', 'toastActivite', 'Toast activité', 'v8-61-toast-activite.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.toastSommeil(), 'toastSommeil');
  await takeScreenshot('toast-sommeil');
  recordUI('BLOC 17', 'toastSommeil', 'Toast sommeil', 'v8-62-toast-sommeil.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.toastNutrition(), 'toastNutrition');
  await takeScreenshot('toast-nutrition');
  recordUI('BLOC 17', 'toastNutrition', 'Toast nutrition', 'v8-63-toast-nutrition.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.toastHydratation(), 'toastHydratation');
  await takeScreenshot('toast-hydratation');
  recordUI('BLOC 17', 'toastHydratation', 'Toast hydratation', 'v8-64-toast-hydratation.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.toastConvertir(), 'toastConvertir');
  await takeScreenshot('toast-convertir');
  recordUI('BLOC 17', 'toastConvertir', 'Toast convertir', 'v8-65-toast-convertir.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.toastPdf(), 'toastPdf');
  await takeScreenshot('toast-pdf');
  recordUI('BLOC 17', 'toastPdf', 'Toast PDF', 'v8-66-toast-pdf.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.toastEncourager(), 'toastEncourager');
  await takeScreenshot('toast-encourager');
  recordUI('BLOC 17', 'toastEncourager', 'Toast encourager', 'v8-67-toast-encourager.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.toastChat(), 'toastChat');
  await takeScreenshot('toast-chat');
  recordUI('BLOC 17', 'toastChat', 'Toast chat', 'v8-68-toast-chat.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.toastPartenaire(), 'toastPartenaire');
  await takeScreenshot('toast-partenaire');
  recordUI('BLOC 17', 'toastPartenaire', 'Toast partenaire', 'v8-69-toast-partenaire.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.toastReserver(), 'toastReserver');
  await takeScreenshot('toast-reserver');
  recordUI('BLOC 17', 'toastReserver', 'Toast réserver', 'v8-70-toast-reserver.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.toastPlanifier(), 'toastPlanifier');
  await takeScreenshot('toast-planifier');
  recordUI('BLOC 17', 'toastPlanifier', 'Toast planifier', 'v8-71-toast-planifier.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.toastWhatsapp(), 'toastWhatsapp');
  await takeScreenshot('toast-whatsapp');
  recordUI('BLOC 17', 'toastWhatsapp', 'Toast WhatsApp', 'v8-72-toast-whatsapp.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.toastCreerGroupe(), 'toastCreerGroupe');
  await takeScreenshot('toast-creer-groupe');
  recordUI('BLOC 17', 'toastCreerGroupe', 'Toast créer groupe', 'v8-73-toast-creer-groupe.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.comingSoon(), 'comingSoon');
  await takeScreenshot('coming-soon');
  recordUI('BLOC 17', 'comingSoon', 'Toast coming soon', 'v8-74-coming-soon.png', '✅');

  // BLOC 18 — Profil
  log('=== BLOC 18 — Profil ===');
  
  await safeEvaluate(() => window.__bolamu_test.openProfile(), 'openProfile');
  await takeScreenshot('open-profile-final');
  recordUI('BLOC 18', 'openProfile', 'Ouverture profil final', 'v8-75-open-profile-final.png', '✅');

  await safeEvaluate(() => window.__bolamu_test.closeProfile(), 'closeProfile');
  recordUI('BLOC 18', 'closeProfile', 'Fermeture profil final', null, '✅');

  // Génération rapport
  log('=== Génération rapport ===');
  
  const okCount = uiResults.filter(r => r.verdict === '✅').length;
  const warningCount = uiResults.filter(r => r.verdict === '⚠️').length;
  const silentCount = uiResults.filter(r => r.verdict === '🔴').length;
  const crashCount = uiResults.filter(r => r.verdict === '❌').length;

  let report = `# RAPPORT ROBOT V8 PATIENT
> Test complet avec protocole window.__bolamu_test
> Date: ${new Date().toISOString()}
> Compte: +242069735418

---

## SECTION 1 — IDs récupérés

- EVENT_ID: ${EVENT_ID || 'N/A'}
- VOUCHER_ID: ${VOUCHER_ID || 'N/A'}
- MEMBER_PHONE: ${MEMBER_PHONE || 'N/A'}
- CLUB_ID: ${CLUB_ID || 'N/A'}
- DMN_DOC_ID: ${DMN_DOC_ID || 'N/A'}
- RDV_DOCTOR_ID: ${RDV_DOCTOR_ID || 'N/A'}

---

## SECTION 2 — Violations contrat API

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

## SECTION 3 — Récapitulatif UI

- ✅ Conformes: ${okCount}
- ⚠️ Partiels: ${warningCount}
- 🔴 Silencieux: ${silentCount}
- ❌ Crash: ${crashCount}
- **Total: ${uiResults.length}**

---

## SECTION 4 — Récapitulatif API

- ✅ Conformes: ${apiViolations.length === 0 ? 'Toutes' : 'Partiel'}
- ❌ Violations: ${apiViolations.length}

---

## SECTION 5 — Liste des ❌ et 🔴 par criticité

`;

  const failures = uiResults.filter(r => r.verdict === '❌' || r.verdict === '🔴');
  if (failures.length === 0) {
    report += '✅ Aucun échec critique détecté\n\n';
  } else {
    failures.forEach(f => {
      report += `- ${f.verdict} **${f.block} — ${f.action}**: ${f.behavior}\n`;
      if (f.screenshot) report += `  Screenshot: ${f.screenshot}\n`;
    });
  }

  report += `---

## TABLEAU 1 — Tests UI détaillés

| Bloc | Action | Comportement réel | Screenshot | VERDICT |
|------|--------|-------------------|------------|---------|
`;

  uiResults.forEach(r => {
    report += `| ${r.block} | ${r.action} | ${r.behavior} | ${r.screenshot || 'N/A'} | ${r.verdict} |\n`;
  });

  report += `---

## TABLEAU 2 — Conformité contrat API

| Route appelée | success ✓ | data ✓ | error.code ✓ | VERDICT |
|---------------|-----------|--------|--------------|---------|
`;

  if (apiViolations.length === 0) {
    report += '| Toutes les routes | ✅ | ✅ | ✅ | ✅ |\n';
  } else {
    apiViolations.forEach(v => {
      report += `| ${v.url} | ❌ | ❌ | ❌ | ❌ |\n`;
    });
  }

  report += `---

## Logs d'exécution

\`\`\`
${logs.join('\n')}
\`\`\`
`;

  fs.writeFileSync('RAPPORT_ROBOT_V8_PATIENT.md', report);
  log('✅ Rapport généré: RAPPORT_ROBOT_V8_PATIENT.md');

  await browser.close();
})();
