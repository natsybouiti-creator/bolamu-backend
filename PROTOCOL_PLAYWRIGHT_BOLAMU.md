# PROTOCOLE D'ACCORD PLAYWRIGHT ↔ BOLAMU
Version 1.0 — NBA Gestion SARLU

## PRINCIPE FONDAMENTAL
Playwright se comporte TOUJOURS comme un vrai utilisateur :
- Il navigue vers la vraie page login
- Il remplit les vrais champs avec les vrais identifiants
- Il clique les vrais boutons
- Il suit les vraies redirections
- Il uploade de vrais fichiers depuis le disque local
- Il attend les vrais chargements

Aucun bypass. Aucun contournement. Tout ce que Playwright fait,
un vrai utilisateur peut le faire.

---

## 1. COMPTES DE TEST

| Rôle | Téléphone | Mot de passe | URL Login | Token localStorage |
|------|-----------|--------------|-----------|-------------------|
| Patient | +242069735418 | TestNouveau2026! | /login.html | bolamu_patient_token |
| Agent | +242077000010 | bolamu2026 | /agence/login.html | bolamu_agent_token |
| Admin | +242060000099 | bolamu2026 | /admin/login.html | bolamu_admin_token |
| Médecin | +242060000001 | bolamu2026 | /login.html | bolamu_medecin_token |
| Secrétaire | +242077000001 | bolamu2026 | /secretaire/login.html | bolamu_secretaire_token |
| Pharmacie | +242066226116 | WR383LMW | /login.html | bolamu_pharmacie_token |
| Laboratoire | +242068582563 | bolamu2026 | /login.html | bolamu_labo_token |
| Partenaire | +242063125478 | bolamu2026 | /partenaire/login.html | bolamu_partenaire_token |
| RH | +242000000088 | bolamu2026 | /rh/login.html | bolamu_rh_token |

---

## 2. FICHIERS FIXTURES

Emplacement : `tests/fixtures/` 

| Fichier | Usage |
|---------|-------|
| test-cni.png | Upload CNI patient, agent |
| test-photo.png | Photo identité patient |
| test-resultat-labo.pdf | Résultats laboratoire |
| test-ordonnance.pdf | Ordonnance médecin |

Ces fichiers sont de vrais fichiers valides uploadés sur Cloudinary pendant les tests.

---

## 3. SÉQUENCE LOGIN STANDARD

```javascript
// Étape 1 — Naviguer vers la page login
await page.goto('https://www.bolamu.co/agence/login.html');
await page.waitForLoadState('networkidle');

// Étape 2 — Remplir les champs
await page.fill('#phone', '+242077000010');
await page.fill('#password', 'bolamu2026');

// Étape 3 — Intercepter les dialogs avant de cliquer
page.on('dialog', dialog => dialog.dismiss());

// Étape 4 — Soumettre
await page.click('#btn-login');

// Étape 5 — Attendre la redirection vers le dashboard
await page.waitForURL('**/agence/dashboard.html', { timeout: 15000 });
await page.waitForLoadState('networkidle');

// Étape 6 — Vérifier le token en localStorage
const token = await page.evaluate(() => localStorage.getItem('bolamu_agent_token'));
expect(token).toBeTruthy();

// Étape 7 — Attendre le protocole window.__bolamu_test
await page.waitForFunction(
  () => typeof window.__bolamu_test === 'object',
  { timeout: 10000 }
);
```

---

## 4. UPLOAD FICHIER STANDARD

```javascript
// Via input file HTML — Playwright lit le fichier depuis le disque local
const fileInput = page.locator('input[type="file"]').first();
await fileInput.setInputFiles('tests/fixtures/test-cni.png');

// Via window.__bolamu_test si le dashboard l'expose
await page.evaluate(async () => {
  await window.__bolamu_test.uploaderDocument('cni', 'test-cni.png');
});
```

---

## 5. PROTOCOLE window.__bolamu_test

### Règle de position dans les fichiers HTML
`window.__bolamu_test` doit être défini EN PREMIER dans le script principal,
AVANT toute vérification de token et toute redirection.

```javascript
// ✅ CORRECT — window.__bolamu_test en premier
window.__bolamu_test = { ... };

// Ensuite seulement la vérification token
const token = localStorage.getItem('bolamu_xxx_token');
if (!token) window.location.href = '/xxx/login.html';
```

```javascript
// ❌ INTERDIT — window.__bolamu_test après la vérification token
const token = localStorage.getItem('bolamu_xxx_token');
if (!token) window.location.href = '/xxx/login.html'; // redirige avant que le protocole soit défini
window.__bolamu_test = { ... }; // jamais atteint
```

### Fonctions minimales requises sur tout dashboard

```javascript
window.__bolamu_test = {
  getState: () => ({
    // état actuel de l'interface
  }),
  getErreurs: () => ([
    // liste des erreurs accumulées
  ])
};
```

### Fonctions par dashboard

| Dashboard | Fonctions spécifiques |
|-----------|----------------------|
| patient/dashboard.html | login, goAccueil, goGagner, openModal, rdvSelectDoctor, rdvSelectDate, rdvSelectSlot, confirmRdv, getState, getErreurs |
| agence/dashboard.html | login, ouvrirWizardSouscription, remplirIdentite, uploaderDocument, validerSouscription, getDernierPatientCree, getState, getErreurs |
| admin/dashboard.html | login, getDossiersEnAttente, validerDossier, refuserDossier, suspendreCompte, getLogsBHP, getStatistiques, getState, getErreurs |
| register.html | selectionnerRole, remplirInfos, allerEtape2, uploaderCNI, uploaderPhoto, allerEtape3, accepterCGU, soumettre, getEtapeActuelle, getState, getErreurs |
| medecin/dashboard.html | login, ouvrirConsultation, remplirCompteRendu, creerOrdonnance, ajouterMedicament, prescrireLabo, validerConsultation, getState, getErreurs |
| secretaire/dashboard.html | login, confirmerRdv, checkinPatient, getListeRdv, getState, getErreurs |
| pharmacie/dashboard.html | login, scannerQrOrdonnance, validerDelivrance, refuserOrdonnance, getState, getErreurs |
| laboratoire/dashboard.html | login, voirPrescription, saisirResultats, validerResultats, getState, getErreurs |

---

## 6. GESTION DIALOGS NATIFS

Toujours intercepter AVANT l'action qui déclenche le dialog :

```javascript
// Accepter automatiquement
page.on('dialog', async dialog => {
  console.log('Dialog:', dialog.message());
  await dialog.accept();
});

// Ou refuser
page.on('dialog', async dialog => {
  await dialog.dismiss();
});

// ENSUITE faire l'action
await page.click('#btn-action');
```

---

## 7. REDIRECTIONS — Règles d'attente

| Situation | Code Playwright |
|-----------|----------------|
| Après login | `await page.waitForURL('**/dashboard.html', { timeout: 15000 })` |
| Après action | `await page.waitForURL('**/target.html', { timeout: 10000 })` |
| Chargement page | `await page.waitForLoadState('networkidle')` |
| Élément visible | `await page.waitForSelector('#id', { state: 'visible', timeout: 10000 })` |
| Protocole dispo | `await page.waitForFunction(() => typeof window.__bolamu_test === 'object')` |

**INTERDIT :**
```javascript
await page.waitForTimeout(2000); // fragile, jamais utiliser
```

---

## 8. DÉLAIS CONNUS APRÈS LOGIN

| Page | Délai redirection |
|------|------------------|
| secretaire/login.html | 1200ms |
| rh/login.html | 1200ms |
| partenaire/login.html | 900ms |
| agence/login.html | auto |
| admin/login.html | auto |

Toujours utiliser `waitForURL` — jamais `waitForTimeout`.

---

## 9. TOKENS localStorage PAR RÔLE

| Rôle | Clé token | Autres clés |
|------|-----------|-------------|
| Patient | bolamu_patient_token | bolamu_patient_phone |
| Agent | bolamu_agent_token | bolamu_agent_phone, bolamu_agent_name |
| Admin | bolamu_admin_token | bolamu_admin_phone, bolamu_role |
| Secrétaire | bolamu_secretaire_token | bolamu_secretaire_phone, bolamu_secretaire_clinic_id |
| RH | bolamu_rh_token | bolamu_rh_phone, bolamu_rh_company_id |
| Pharmacie | bolamu_pharmacie_token | bolamu_pharmacie_phone |
| Partenaire | bolamu_partenaire_token | bolamu_partenaire_phone |

---

## 10. CAMÉRA ET QR SCANNER

Ne jamais simuler la caméra dans les tests.
Toujours passer par `uploaderDocument()` du protocole avec un fichier fixture PNG.

```javascript
// ✅ CORRECT
await page.evaluate(async () => {
  await window.__bolamu_test.uploaderDocument('cni', 'test-cni.png');
});

// ❌ INTERDIT
await page.evaluate(() => navigator.mediaDevices.getUserMedia({ video: true }));
```

---

## 11. STRUCTURE STANDARD D'UN SPEC PLAYWRIGHT BOLAMU

```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, uploadFixture, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('SXX — Nom du scénario', () => {

  // Variables partagées entre les tests
  let page;
  let context;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    
    // Intercepter les dialogs
    handleDialogs(page, 'accept');
    
    // Login comme un vrai utilisateur
    await loginAs(page, 'agent', '+242077000010', 'bolamu2026');
    
    // Attendre que le dashboard et le protocole soient prêts
    await waitForDashboard(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('ÉTAPE 1 — Description étape', async () => {
    // 1. Interagir via window.__bolamu_test
    await page.evaluate(() => window.__bolamu_test.ouvrirWizardSouscription());
    
    // 2. Attendre résultat
    await page.waitForSelector('#wizard-step-1', { state: 'visible' });
    
    // 3. Uploader un fichier réel
    await uploadFixture(page, 'input[type="file"]', 'test-cni.png');
    
    // 4. Vérifier état
    const state = await page.evaluate(() => window.__bolamu_test.getState());
    expect(state.wizardStep).toBe(1);
    
    // 5. Screenshot
    await page.screenshot({ path: 'screenshots-sxx/01-etape.png' });
  });

  test('ÉTAPE 2 — Description étape', async () => {
    // Suite du flux...
  });

});
```

---

## 12. GLOBAL SETUP — Sessions pré-authentifiées

Le fichier `tests/setup/global-setup.js` se connecte à tous les comptes
une seule fois avant tous les tests et sauvegarde les sessions.

Chaque spec utilise la session correspondante — pas de re-login à chaque test.

```javascript
// playwright.config.js
globalSetup: './tests/setup/global-setup.js'
```

---

## 13. ÉTAT DU PROTOCOLE PAR DASHBOARD

| Dashboard | window.__bolamu_test | Sessions | Fixtures |
|-----------|---------------------|---------|---------|
| patient/dashboard.html | ✅ Complet | ✅ | ✅ |
| agence/dashboard.html | ✅ Partiel | ✅ | ✅ |
| admin/dashboard.html | ✅ Partiel | ✅ | — |
| register.html | ✅ Partiel | — | ✅ |
| medecin/dashboard.html | ❌ À faire | ✅ | — |
| secretaire/dashboard.html | ❌ À faire | ✅ | — |
| pharmacie/dashboard.html | ❌ À faire | ✅ | — |
| laboratoire/dashboard.html | ❌ À faire | ✅ | ✅ |
| partenaire/dashboard.html | ❌ À faire | ✅ | — |
| rh/dashboard.html | ❌ À faire | ✅ | — |
| animateur/dashboard.html | ❌ À faire | — | — |

---

## 14. CHECKLIST AVANT PUSH

Avant tout push d'un scénario testé :

- [ ] Test backend API pur ✅
- [ ] Test UI Playwright via vraie page login ✅
- [ ] Upload fichiers fixtures réels ✅
- [ ] Screenshots générés ✅
- [ ] Rapport RAPPORT_SXX_NOM.md créé ✅
- [ ] Aucun bypass ou contournement ✅
- [ ] window.__bolamu_test utilisé correctement ✅
- [ ] Bugs documentés avec numéro BUG-SXX-XX ✅
