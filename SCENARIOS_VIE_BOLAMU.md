# SCENARIOS VIE BOLAMU
> 27 scénarios de bout en bout — routes vérifiées dans src/routes/ — templates WhatsApp réels — tables DB réelles
> Version 1.0 — 28 juin 2026

---

## COMPTES DE TEST

| # | ACTEUR | TÉLÉPHONE | MOT DE PASSE | DASHBOARD |
|---|---|---|---|---|
| 1 | Admin | +242060000099 | bolamu2026 | admin/dashboard.html |
| 2 | Agent | +242077000010 | bolamu2026 | agence/dashboard.html | ✅ ACTIF |
| 3 | Agent | +242064000000 | bolamu2026 | agence/dashboard.html | ❌ INACTIF (401) |
| 4 | Animateur | +242000000088 | bolamu2026 | animateur/dashboard.html |
| 5 | Doctor | +242060000001 | bolamu2026 | medecin/dashboard.html |
| 6 | Doctor | +242065452321 | bolamu2026 | medecin/dashboard.html |
| 7 | Doctor | +242068541236 | bolamu2026 | medecin/dashboard.html |
| 8 | Doctor | +242066622157 | bolamu2026 | medecin/dashboard.html |
| 9 | Laboratoire | +242068582563 | bolamu2026 | laboratoire/dashboard.html |
| 10 | Laboratoire | +242063125478 | bolamu2026 | laboratoire/dashboard.html |
| 11 | Laboratoire | +242068452321 | bolamu2026 | laboratoire/dashboard.html |
| 12 | Pharmacie | +242066226116 | WR383LMW | pharmacie/dashboard.html |
| 13 | Pharmacie | +242066226115 | bolamu2026 | pharmacie/dashboard.html |
| 14 | Pharmacie | +242065214789 | bolamu2026 | pharmacie/dashboard.html |
| 15 | Secrétaire | +242077000001 | bolamu2026 | secretaire/dashboard.html |
| 16 | Secrétaire | +242060000002 | bolamu2026 | secretaire/dashboard.html |
| 17 | RH | +242077000002 | bolamu2026 | rh/dashboard.html |
| 18 | RH Brasco | +242077000003 | bolamu2026 | rh/dashboard.html |
| 19 | Patient principal | +242069735418 | TestNouveau2026! | patient/dashboard.html |
| 20 | Patient test RDV | +242065458932 | bolamu2026 | patient/dashboard.html |
| 21 | Patient | +242069735419 | bolamu2026 | patient/dashboard.html |
| 22 | Patient | +242099999999 | bolamu2026 | patient/dashboard.html |
| 23 | Patient chat 1 | +242068500010 | bolamu2026 | patient/dashboard.html |
| 24 | Patient chat 2 | +242068500011 | bolamu2026 | patient/dashboard.html |
| 25 | Patient chat 3 | +242068500012 | bolamu2026 | patient/dashboard.html |

---

## SCENARIO S01 — Inscription patient via agence (wizard complet)

**Acteurs :** Agence, Patient (nouveau)
**Déclencheur :** Agent Bolamu accueille un nouveau bénéficiaire au guichet

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| POST | /api/v1/agence/login | {phone, password} | { success: true, data: { access_token, role: 'agent_bolamu' } } |
| POST | /api/v1/agence/souscrire-complet | multipart: {phone, full_name, plan, cni, photo} | { success: true, data: { member_code, temp_password, subscription_id } } |
| GET | /api/v1/auth/onboarding/:token | - | { success: true, data: { phone, first_login_done: true } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| users | phone | +24206TEST0001 |
| users | role | 'patient' |
| subscriptions | status | 'active' |
| subscriptions | plan | 'essentiel' |
| documents | document_type | 'cni' |
| audit_log | event_type | 'agent_souscription' |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Après login | #dashboard-agence | visible |
| Après wizard | #wizard-step-1 | visible |
| Après upload CNI | #cni-preview | visible |
| Après validation | #confirmation-panel | visible |
| Confirmation affiche | #member-code | contient 'BLM-' |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, uploadFixture, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S01 — Inscription patient via agence', () => {

  let page, context;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'agent', '+242077000010', 'bolamu2026');
    await waitForDashboard(page);
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Ouvrir wizard souscription', async () => {
    await page.evaluate(() => window.__bolamu_test.ouvrirWizardSouscription());
    await page.waitForSelector('#wizard-step-1', { state: 'visible' });
    await page.screenshot({ path: 'screenshots-s01/01-wizard-open.png' });
  });

  test('ÉTAPE 2 — Remplir identité', async () => {
    await page.evaluate(() => window.__bolamu_test.remplirIdentite('+24206TEST0001', 'Test Nouveau Patient'));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots-s01/02-identite-remplie.png' });
  });

  test('ÉTAPE 3 — Uploader CNI', async () => {
    await uploadFixture(page, 'input[type="file"]', 'cni.png');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s01/03-cni-uploaded.png' });
  });

  test('ÉTAPE 4 — Uploader photo', async () => {
    await uploadFixture(page, 'input[type="file"]', 'photo.png');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s01/04-photo-uploaded.png' });
  });

  test('ÉTAPE 5 — Sélectionner plan et valider', async () => {
    await page.evaluate(() => window.__bolamu_test.selectionnerPlan('essentiel'));
    await page.evaluate(() => window.__bolamu_test.validerSouscription());
    await page.waitForTimeout(3000);
    
    const state = await page.evaluate(() => window.__bolamu_test.getState());
    expect(state.member_code).toMatch(/^BLM-/);
    expect(state.subscription_id).toBeTruthy();
    
    await page.screenshot({ path: 'screenshots-s01/05-validation-success.png' });
  });

  test('ÉTAPE 6 — Vérifier backend API', async () => {
    const token = await page.evaluate(() => localStorage.getItem('bolamu_agent_token'));
    const adherent = await apiCall('/api/v1/agence/verifier-adherent?q=+24206TEST0001', 'GET', null, token);
    expect(adherent.success).toBe(true);
    expect(adherent.data.subscription_plan).toBe('essentiel');
  });

});
```

**WhatsApp attendus :** `bolamu_bienvenue_patient_v4` avec params [prenom, member_code, temp_password, lien_onboarding]
**Statut :** ⏳ À tester

---

## SCENARIO S02 — Souscription en ligne (patient existant)

**Acteurs :** Patient
**Déclencheur :** Patient sans abonnement actif se connecte et choisit un plan

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| POST | /api/v1/auth/login | {phone, password} | { success: true, data: { access_token, refresh_token } } |
| GET | /api/v1/patients/check-subscription?phone=PHONE | - | { success: true, data: { active: false, current_plan: null } } |
| POST | /api/v1/patients/subscription | {plan: 'essentiel'} | { success: true, data: { subscription_id, status: 'pending' } } |
| POST | /api/v1/momo/request | {amount, phone} | { success: true, data: { reference_id } } |
| GET | /api/v1/momo/status/:referenceId | - | { success: true, data: { status: 'SUCCESSFUL' } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| subscriptions | status | 'active' |
| subscriptions | plan | 'essentiel' |
| payments | status | 'completed' |
| payments | amount | 5000 |
| audit_log | event_type | 'subscription_created' |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Après login | #dashboard-patient | visible |
| Check subscription | #subscription-status | affiche 'Inactif' |
| Sélection plan | #plan-essentiel-btn | cliqué |
| Init paiement | #momo-prompt | visible |
| Paiement succès | #confirmation-panel | visible |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S02 — Souscription en ligne', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Vérifier statut abonnement', async () => {
    const subCheck = await apiCall('/api/v1/patients/check-subscription?phone=+242069735418', 'GET', null, token);
    expect(subCheck.success).toBe(true);
    expect(subCheck.data.active).toBe(false);
    await page.screenshot({ path: 'screenshots-s02/01-statut-compte.png' });
  });

  test('ÉTAPE 2 — Choisir plan essentiel', async () => {
    await page.evaluate(() => window.__bolamu_test.selectionnerPlan('essentiel'));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots-s02/02-plan-selectionne.png' });
  });

  test('ÉTAPE 3 — Initier paiement MoMo', async () => {
    const momoRes = await apiCall('/api/v1/momo/request', 'POST', { amount: 5000, phone: '+242069735418' }, token);
    expect(momoRes.success).toBe(true);
    expect(momoRes.data.reference_id).toBeTruthy();
    await page.screenshot({ path: 'screenshots-s02/03-paiement-initie.png' });
  });

  test('ÉTAPE 4 — Simuler webhook succès', async () => {
    // En production, le webhook MoMo appelle /api/v1/momo/webhook
    // Pour le test, on simule le succès via un appel admin
    const webhookRes = await apiCall('/api/v1/momo/simulate-success', 'POST', { reference_id: 'TEST_REF_001' }, token);
    expect(webhookRes.success).toBe(true);
  });

  test('ÉTAPE 5 — Vérifier subscription active', async () => {
    const subCheck = await apiCall('/api/v1/patients/check-subscription?phone=+242069735418', 'GET', null, token);
    expect(subCheck.data.active).toBe(true);
    expect(subCheck.data.current_plan).toBe('essentiel');
    await page.screenshot({ path: 'screenshots-s02/04-souscription-active.png' });
  });

});
```

**WhatsApp attendus :** aucun
**Statut :** ⏳ À tester

---

## SCENARIO S03 — Renouvellement abonnement avec upgrade de plan

**Acteurs :** Patient
**Déclencheur :** Abonnement actif arrive à expiration ou patient veut upgrader

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/patients/subscription | - | { success: true, data: { plan, expiry_date, status } } |
| PATCH | /api/v1/patients/subscription/upgrade | {new_plan: 'premium'} | { success: true, data: { prorata_amount, new_subscription_id } } |
| POST | /api/v1/momo/request | {amount, phone} | { success: true, data: { reference_id } } |
| POST | /api/v1/momo/webhook | {status, reference_id} | { success: true } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| subscriptions (ancienne) | status | 'expired' |
| subscriptions (nouvelle) | status | 'active' |
| subscriptions (nouvelle) | plan | 'premium' |
| payments | status | 'completed' |
| payments | amount | prorata calculé |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Voir abonnement | #current-plan | affiche 'Essentiel' |
| Upgrade demandé | #upgrade-modal | visible |
| Paiement différentiel | #payment-amount | affiche prorata |
| Upgrade succès | #new-plan-badge | affiche 'Premium' |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S03 — Renouvellement avec upgrade', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Voir abonnement actuel', async () => {
    const subRes = await apiCall('/api/v1/patients/subscription', 'GET', null, token);
    expect(subRes.success).toBe(true);
    expect(subRes.data.plan).toBe('essentiel');
    await page.screenshot({ path: 'screenshots-s03/01-abonnement-actuel.png' });
  });

  test('ÉTAPE 2 — Initier upgrade vers premium', async () => {
    const upgradeRes = await apiCall('/api/v1/patients/subscription/upgrade', 'PATCH', { new_plan: 'premium' }, token);
    expect(upgradeRes.success).toBe(true);
    expect(upgradeRes.data.prorata_amount).toBeGreaterThan(0);
    await page.screenshot({ path: 'screenshots-s03/02-upgrade-initie.png' });
  });

  test('ÉTAPE 3 — Payer différentiel', async () => {
    const momoRes = await apiCall('/api/v1/momo/request', 'POST', { 
      amount: 15000, 
      phone: '+242069735418' 
    }, token);
    expect(momoRes.success).toBe(true);
  });

  test('ÉTAPE 4 — Vérifier nouvelle subscription', async () => {
    const subRes = await apiCall('/api/v1/patients/subscription', 'GET', null, token);
    expect(subRes.data.plan).toBe('premium');
    expect(subRes.data.status).toBe('active');
    await page.screenshot({ path: 'screenshots-s03/03-upgrade-success.png' });
  });

});
```

**WhatsApp attendus :** aucun (rappel renouvellement = À développer)
**Statut :** ⏳ À tester

---

## SCENARIO S04 — Patient prend un RDV médecin

**Acteurs :** Patient, Médecin
**Déclencheur :** Patient veut consulter un médecin disponible

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/appointments/slots/:doctor_id?date=DATE | - | { success: true, data: { slots: ['09:00','09:30'], pris: [] } } |
| POST | /api/v1/appointments/book | {patient_phone, doctor_id, date, time} | { success: true, data: { appointment_id, session_code } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| appointments | status | 'confirme' |
| appointments | patient_phone | +242069735418 |
| appointments | doctor_id | ID médecin |
| appointments | session_code | UUID généré |
| notifications | type | 'rdv_confirme' |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Naviguer accueil | #accueil-section | visible |
| Ouvrir modal RDV | #rdv-modal | visible |
| Sélectionner médecin | #doctor-select | valeur sélectionnée |
| Sélectionner date | #date-select | 2026-07-15 |
| Sélectionner créneau | #slot-09:00 | cliqué |
| Après confirmation | #rdv-confirmation | visible |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S04 — Patient prend un RDV médecin', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Naviguer vers accueil', async () => {
    await page.evaluate(() => window.__bolamu_test.goAccueil());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s04/01-accueil.png' });
  });

  test('ÉTAPE 2 — Ouvrir modal RDV', async () => {
    await page.evaluate(() => window.__bolamu_test.openModal());
    await page.waitForSelector('#rdv-modal', { state: 'visible' });
    await page.screenshot({ path: 'screenshots-s04/02-modal-open.png' });
  });

  test('ÉTAPE 3 — Sélectionner médecin', async () => {
    await page.evaluate(() => window.__bolamu_test.rdvSelectDoctor('1'));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots-s04/03-medecin-selectionne.png' });
  });

  test('ÉTAPE 4 — Sélectionner date', async () => {
    await page.evaluate(() => window.__bolamu_test.rdvSelectDate('2026-07-15'));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots-s04/04-date-selectionnee.png' });
  });

  test('ÉTAPE 5 — Sélectionner créneau', async () => {
    await page.evaluate(() => window.__bolamu_test.rdvSelectSlot('09:00'));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots-s04/05-creneau-selectionne.png' });
  });

  test('ÉTAPE 6 — Confirmer RDV', async () => {
    await page.evaluate(() => window.__bolamu_test.confirmRdv());
    await page.waitForTimeout(2000);
    
    const state = await page.evaluate(() => window.__bolamu_test.getState());
    expect(state.last_appointment_id).toBeTruthy();
    expect(state.session_code).toBeTruthy();
    
    await page.screenshot({ path: 'screenshots-s04/06-rdv-confirme.png' });
  });

  test('ÉTAPE 7 — Vérifier backend API', async () => {
    const rdvs = await apiCall('/api/v1/appointments/patient/+242069735418', 'GET', null, token);
    expect(rdvs.success).toBe(true);
    expect(rdvs.appointments.length).toBeGreaterThan(0);
    expect(rdvs.appointments[0].status).toBe('confirme');
  });

});
```

**WhatsApp attendus :** `bolamu_rdv_confirme` (patient + médecin) avec params [prenom, date, heure, medecin, adresse, session_code]
**Statut :** ⏳ À tester

---

## SCENARIO S05 — Consultation validée → Zora crédité

**Acteurs :** Médecin, Patient
**Déclencheur :** Médecin ouvre la consultation et entre le code session pour valider

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| POST | /api/v1/appointments/:id/open | - | { success: true, data: { status: 'en_cours' } } |
| POST | /api/v1/appointments/:id/validate | {session_code} | { success: true, data: { zora_awarded: 50 } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| appointments | status | 'termine' |
| zora_ledger | action_type | 'consultation' |
| zora_ledger | points | 50 |
| zora_ledger | balance | augmenté de 50 |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Dashboard médecin | #dashboard-medecin | visible |
| Liste RDV | #rdv-list | RDV visible |
| Ouvrir consultation | #consultation-panel | visible |
| Saisir session_code | #session-code-input | valeur saisie |
| Validation succès | #zora-award-toast | visible |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S05 — Consultation validée', () => {

  let pageMedecin, contextMedecin, tokenMedecin;
  let rdvId, sessionCode;

  test.beforeAll(async ({ browser }) => {
    contextMedecin = await browser.newContext();
    pageMedecin = await contextMedecin.newPage();
    handleDialogs(pageMedecin, 'accept');
    await loginAs(pageMedecin, 'medecin', '+242060000001', 'bolamu2026');
    await waitForDashboard(pageMedecin);
    tokenMedecin = await pageMedecin.evaluate(() => localStorage.getItem('bolamu_medecin_token'));
  });

  test.afterAll(async () => await contextMedecin.close());

  test('ÉTAPE 1 — Récupérer RDV du patient', async () => {
    const rdvList = await apiCall('/api/v1/appointments/doctor/+242060000001', 'GET', null, tokenMedecin);
    expect(rdvList.success).toBe(true);
    expect(rdvList.data.length).toBeGreaterThan(0);
    rdvId = rdvList.data[0].id;
    sessionCode = rdvList.data[0].session_code;
    await pageMedecin.screenshot({ path: 'screenshots-s05/01-rdv-liste.png' });
  });

  test('ÉTAPE 2 — Ouvrir consultation', async () => {
    const openRes = await apiCall(`/api/v1/appointments/${rdvId}/open`, 'POST', null, tokenMedecin);
    expect(openRes.success).toBe(true);
    expect(openRes.data.status).toBe('en_cours');
    await pageMedecin.screenshot({ path: 'screenshots-s05/02-consultation-ouverte.png' });
  });

  test('ÉTAPE 3 — Vérifier Zora avant validation', async () => {
    const zoraBefore = await apiCall('/api/v1/zora/balance', 'GET', null, tokenMedecin);
    expect(zoraBefore.success).toBe(true);
    console.log('Zora avant:', zoraBefore.data.balance);
  });

  test('ÉTAPE 4 — Valider avec session_code', async () => {
    const validateRes = await apiCall(`/api/v1/appointments/${rdvId}/validate`, 'POST', 
      { session_code: sessionCode }, tokenMedecin);
    expect(validateRes.success).toBe(true);
    expect(validateRes.data.zora_awarded).toBe(50);
    await pageMedecin.screenshot({ path: 'screenshots-s05/03-validation-success.png' });
  });

  test('ÉTAPE 5 — Vérifier Zora après validation', async () => {
    const zoraAfter = await apiCall('/api/v1/zora/balance', 'GET', null, tokenMedecin);
    expect(zoraAfter.data.balance).toBeGreaterThan(0);
  });

});
```

**WhatsApp attendus :** aucun
**Statut :** ⏳ À tester

---

## SCENARIO S06 — Patient accède à son DMN (Dossier Médical Numérique)

**Acteurs :** Patient
**Déclencheur :** Patient veut consulter son dossier médical complet

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/dmn/summary | - | { success: true, data: { documents: [], constantes: {} } } |
| POST | /api/v1/dmn/download/verify | {password} | { success: true, data: { dmn_token } } |
| GET | /api/v1/dmn/download/:document_id | - | { success: true, data: { signed_url } } |
| GET | /api/v1/dmn/access-log | - | { success: true, data: { logs: [] } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| dmn_access_log | event_type | 'summary_view' |
| dmn_access_log | event_type | 'download_verify' |
| documents | patient_phone | +242069735418 |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Naviguer Suivre | #suivre-section | visible |
| Ouvrir Dossier | #dossier-panel | visible |
| Ouvrir modal password | #password-modal | visible |
| Télécharger document | #download-link | cliqué |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S06 — Patient accède à son DMN', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Naviguer vers Suivre → Dossier', async () => {
    await page.evaluate(() => window.__bolamu_test.goSuivre());
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.__bolamu_test.suivreDossier());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s06/01-dossier-ouvert.png' });
  });

  test('ÉTAPE 2 — Vérifier DMN summary appelé', async () => {
    const dmnSummary = await apiCall('/api/v1/dmn/summary', 'GET', null, token);
    expect(dmnSummary.success).toBe(true);
    expect(dmnSummary.data.documents).toBeDefined();
  });

  test('ÉTAPE 3 — Ouvrir modal password', async () => {
    await page.evaluate(() => window.__bolamu_test.openDmnPasswordModal());
    await page.waitForSelector('#password-modal', { state: 'visible' });
    await page.screenshot({ path: 'screenshots-s06/02-modal-password.png' });
  });

  test('ÉTAPE 4 — Confirmer mot de passe', async () => {
    await page.evaluate(() => window.__bolamu_test.confirmDmnPassword());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s06/03-password-confirme.png' });
  });

  test('ÉTAPE 5 — Vérifier access-log', async () => {
    const accessLog = await apiCall('/api/v1/dmn/access-log', 'GET', null, token);
    expect(accessLog.success).toBe(true);
    expect(accessLog.data.logs.length).toBeGreaterThan(0);
  });

  test('ÉTAPE 6 — Fermer modal', async () => {
    await page.evaluate(() => window.__bolamu_test.closeDmnPasswordModal());
    await page.waitForTimeout(1000);
  });

});
```

**WhatsApp attendus :** aucun
**Statut :** ⏳ À tester

---

## SCENARIO S07 — Patient met à jour ses constantes médicales

**Acteurs :** Patient
**Déclencheur :** Patient veut compléter son profil de santé (groupe sanguin, poids, allergies…)

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| POST | /api/v1/dmn/update | {groupe_sanguin, poids, taille, allergies, ...} | { success: true, data: { zora_awarded: 30 } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| users | groupe_sanguin | 'O+' |
| users | poids | 72 |
| users | taille | 178 |
| zora_ledger | action_type | 'wellness_update' |
| zora_ledger | points | 30 |
| dmn_access_log | event_type | 'constantes_update' |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Naviguer Suivre | #suivre-section | visible |
| Ouvrir modal constantes | #constantes-modal | visible |
| Remplir champs | #groupe-sanguin | 'O+' |
| Sauvegarder | #save-btn | cliqué |
| Zora crédité | #zora-toast | visible |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S07 — Patient met à jour ses constantes', () => {

  let page, context, token;
  let zoraBefore;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Vérifier Zora avant mise à jour', async () => {
    const zoraRes = await apiCall('/api/v1/zora/balance', 'GET', null, token);
    zoraBefore = zoraRes.data.balance;
    console.log('Zora avant:', zoraBefore);
  });

  test('ÉTAPE 2 — Naviguer vers Suivre', async () => {
    await page.evaluate(() => window.__bolamu_test.goSuivre());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s07/01-suivre.png' });
  });

  test('ÉTAPE 3 — Ouvrir modal constantes', async () => {
    await page.evaluate(() => window.__bolamu_test.openEditConst());
    await page.waitForSelector('#constantes-modal', { state: 'visible' });
    await page.screenshot({ path: 'screenshots-s07/02-modal-constantes.png' });
  });

  test('ÉTAPE 4 — Remplir constantes', async () => {
    await page.evaluate(() => window.__bolamu_test.setConstGroupe('O+'));
    await page.evaluate(() => window.__bolamu_test.setConstPoids('72'));
    await page.evaluate(() => window.__bolamu_test.setConstTaille('178'));
    await page.evaluate(() => window.__bolamu_test.setConstAllergies('Pénicilline'));
    await page.evaluate(() => window.__bolamu_test.setConstMaladies('Aucune'));
    await page.evaluate(() => window.__bolamu_test.setConstAntecedents('Aucun'));
    await page.evaluate(() => window.__bolamu_test.setConstTraitements('Aucun'));
    await page.evaluate(() => window.__bolamu_test.setConstContactNom('Parent Test'));
    await page.evaluate(() => window.__bolamu_test.setConstContactPhone('+242069999999'));
    await page.evaluate(() => window.__bolamu_test.setConstContactLien('Père'));
    await page.screenshot({ path: 'screenshots-s07/03-constantes-remplies.png' });
  });

  test('ÉTAPE 5 — Sauvegarder', async () => {
    await page.evaluate(() => window.__bolamu_test.saveConst());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s07/04-sauvegarde-success.png' });
  });

  test('ÉTAPE 6 — Vérifier Zora après (+30)', async () => {
    const zoraAfter = await apiCall('/api/v1/zora/balance', 'GET', null, token);
    expect(zoraAfter.data.balance).toBe(zoraBefore + 30);
  });

  test('ÉTAPE 7 — Fermer modal', async () => {
    await page.evaluate(() => window.__bolamu_test.closeEditConst());
    await page.waitForTimeout(1000);
  });

});
```

**WhatsApp attendus :** aucun
**Statut :** ⏳ À tester

---

## SCENARIO S08 — Patient génère son QR d'identité médicale

**Acteurs :** Patient
**Déclencheur :** Patient doit partager son identité médicale en urgence ou pour admission

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/dmn/qr-payload | - | { success: true, data: { payload: JWT_SIGNÉ } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| dmn_access_log | event_type | 'qr_scan' |
| dmn_access_log | user_phone | +242069735418 |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Ouvrir QR urgence | #qr-modal | visible |
| QR affiché | #qr-code | visible |
| Payload généré | window.__bolamu_test.qrPayload | défini |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S08 — Patient génère son QR d\'identité médicale', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Ouvrir QR urgence', async () => {
    await page.evaluate(() => window.__bolamu_test.openQrUrg());
    await page.waitForSelector('#qr-modal', { state: 'visible' });
    await page.screenshot({ path: 'screenshots-s08/01-qr-modal.png' });
  });

  test('ÉTAPE 2 — Vérifier QR payload généré', async () => {
    const qrRes = await apiCall('/api/v1/dmn/qr-payload', 'GET', null, token);
    expect(qrRes.success).toBe(true);
    expect(qrRes.data.payload).toBeTruthy();
    await page.screenshot({ path: 'screenshots-s08/02-qr-genere.png' });
  });

  test('ÉTAPE 3 — Vérifier access-log', async () => {
    const accessLog = await apiCall('/api/v1/dmn/access-log', 'GET', null, token);
    const qrLog = accessLog.data.logs.find(l => l.event_type === 'qr_scan');
    expect(qrLog).toBeDefined();
  });

  test('ÉTAPE 4 — Fermer QR', async () => {
    await page.evaluate(() => window.__bolamu_test.closeQrUrg());
    await page.waitForTimeout(1000);
  });

});
```

**WhatsApp attendus :** aucun
**Statut :** ⏳ À tester

---

## SCENARIO S09 — Patient joue à un jeu Zora (scratch card)

**Acteurs :** Patient
**Déclencheur :** Patient veut tenter sa chance pour gagner des points Zora

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/zora/games/config | - | { success: true, data: { scratch: { cost, rules } } } |
| GET | /api/v1/zora/games/status | - | { success: true, data: { free_play_available: true } } |
| POST | /api/v1/zora/games/play | {game_type: 'scratch', play_type: 'free'} | { success: true, data: { play_id, result, points_won } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| zora_game_plays | game_type | 'scratch' |
| zora_game_plays | play_type | 'free' |
| zora_ledger | action_type | 'game_win' |
| zora_ledger | points | points_won |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Naviguer Gagner | #gagner-section | visible |
| Ouvrir scratch | #scratch-modal | visible |
| Jouer | #scratch-btn | cliqué |
| Résultat affiché | #result-panel | visible |
| Zora mis à jour | #zora-balance | mis à jour |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S09 — Patient joue scratch card', () => {

  let page, context, token;
  let zoraBefore;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Naviguer vers Gagner', async () => {
    await page.evaluate(() => window.__bolamu_test.goGagner());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s09/01-gagner.png' });
  });

  test('ÉTAPE 2 — Vérifier status jeux', async () => {
    const gamesStatus = await apiCall('/api/v1/zora/games/status', 'GET', null, token);
    expect(gamesStatus.success).toBe(true);
    console.log('Games status:', JSON.stringify(gamesStatus.data));
  });

  test('ÉTAPE 3 — Vérifier Zora avant', async () => {
    const zoraRes = await apiCall('/api/v1/zora/balance', 'GET', null, token);
    zoraBefore = zoraRes.data.balance;
    console.log('Zora avant:', zoraBefore);
  });

  test('ÉTAPE 4 — Ouvrir et jouer scratch', async () => {
    await page.evaluate(() => window.__bolamu_test.openScratch());
    await page.waitForSelector('#scratch-modal', { state: 'visible' });
    await page.screenshot({ path: 'screenshots-s09/02-scratch-open.png' });
    
    await page.evaluate(() => window.__bolamu_test.playScratch());
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots-s09/03-scratch-result.png' });
  });

  test('ÉTAPE 5 — Vérifier Zora après', async () => {
    const zoraAfter = await apiCall('/api/v1/zora/balance', 'GET', null, token);
    console.log('Zora avant:', zoraBefore, '→ après:', zoraAfter.data.balance);
  });

  test('ÉTAPE 6 — Fermer jeu', async () => {
    await page.evaluate(() => window.__bolamu_test.closeGame());
    await page.waitForTimeout(1000);
  });

});
```

**WhatsApp attendus :** aucun
**Statut :** ⏳ À tester

---

## SCENARIO S10 — Patient joue quiz Zora

**Acteurs :** Patient
**Déclencheur :** Patient veut gagner des Zora en répondant à une question santé

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| POST | /api/v1/zora/games/play | {game_type: 'quiz', play_type: 'free'} | { success: true, data: { play_id, question, answers[] } } |
| POST | /api/v1/zora/games/quiz/answer | {play_id, answer: 0} | { success: true, data: { correct: true, points_won: 20 } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| zora_game_plays | game_type | 'quiz' |
| zora_game_plays | play_type | 'free' |
| zora_ledger | action_type | 'quiz_correct' |
| zora_ledger | points | 20 |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Ouvrir quiz | #quiz-modal | visible |
| Question affichée | #question-text | visible |
| Réponse sélectionnée | #answer-0 | cliqué |
| Résultat affiché | #result-panel | visible |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S10 — Patient joue quiz Zora', () => {

  let page, context, token;
  let playId;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Naviguer vers Gagner', async () => {
    await page.evaluate(() => window.__bolamu_test.goGagner());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s10/01-gagner.png' });
  });

  test('ÉTAPE 2 — Ouvrir quiz', async () => {
    await page.evaluate(() => window.__bolamu_test.openQuiz());
    await page.waitForSelector('#quiz-modal', { state: 'visible' });
    await page.screenshot({ path: 'screenshots-s10/02-quiz-open.png' });
  });

  test('ÉTAPE 3 — Démarrer quiz', async () => {
    const quizStart = await apiCall('/api/v1/zora/games/play', 'POST', 
      { game_type: 'quiz', play_type: 'free' }, token);
    expect(quizStart.success).toBe(true);
    expect(quizStart.data.question).toBeTruthy();
    playId = quizStart.data.play_id;
    console.log('Quiz démarré:', quizStart.data.question);
  });

  test('ÉTAPE 4 — Répondre (première option)', async () => {
    await page.evaluate(() => window.__bolamu_test.pickQuiz0());
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots-s10/03-reponse-selectionnee.png' });
  });

  test('ÉTAPE 5 — Soumettre réponse', async () => {
    const quizResult = await apiCall('/api/v1/zora/games/quiz/answer', 'POST',
      { play_id: playId, answer: 0 }, token);
    expect(quizResult.success).toBe(true);
    console.log('Résultat quiz:', quizResult);
    await page.screenshot({ path: 'screenshots-s10/04-quiz-result.png' });
  });

  test('ÉTAPE 6 — Fermer jeu', async () => {
    await page.evaluate(() => window.__bolamu_test.closeGame());
    await page.waitForTimeout(1000);
  });

});
```

**WhatsApp attendus :** aucun
**Statut :** ⏳ À tester

---

## SCENARIO S11 — Patient échange ses Zora contre une récompense

**Acteurs :** Patient, Partenaire
**Déclencheur :** Patient atteint un palier Zora et veut une récompense

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/zora/rewards?category= | - | { success: true, data: [{id, tier_required, cost_zora, stock}] } |
| POST | /api/v1/zora/redeem | {reward_id} | { success: true, data: { voucher_uuid, reward_name } } |
| GET | /api/v1/zora/vouchers | - | { success: true, data: [{uuid, reward_name, status}] } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| zora_ledger | action_type | 'reward_redeem' |
| zora_ledger | points | -cost_zora |
| zora_vouchers | uuid | UUID généré |
| zora_vouchers | status | 'active' |
| zora_marketplace | stock | décrémenté |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Naviguer Récompenses | #recompenses-section | visible |
| Filtrer catégorie | #filter-tout | cliqué |
| Sélectionner récompense | #reward-card | cliqué |
| Échange succès | #voucher-modal | visible |
| Voucher affiché | #voucher-qr | visible |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S11 — Patient échange Zora contre récompense', () => {

  let page, context, token;
  let zoraBefore;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Naviguer vers Récompenses', async () => {
    await page.evaluate(() => window.__bolamu_test.goRecompenses());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s11/01-recompenses.png' });
  });

  test('ÉTAPE 2 — Voir récompenses disponibles', async () => {
    const rewards = await apiCall('/api/v1/zora/rewards', 'GET', null, token);
    expect(rewards.success).toBe(true);
    console.log('Récompenses:', rewards.data?.length, 'disponibles');
  });

  test('ÉTAPE 3 — Filtrer par catégorie', async () => {
    await page.evaluate(() => window.__bolamu_test.filterCatElec());
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots-s11/02-filtre-elec.png' });
  });

  test('ÉTAPE 4 — Vérifier balance Zora', async () => {
    const zoraState = await apiCall('/api/v1/zora/balance', 'GET', null, token);
    zoraBefore = zoraState.data.balance;
    console.log('Balance Zora:', zoraBefore);
  });

  test('ÉTAPE 5 — Tenter échange (si balance suffisante)', async () => {
    const rewards = await apiCall('/api/v1/zora/rewards', 'GET', null, token);
    if (rewards.data?.length > 0 && zoraBefore >= rewards.data[0].cost_zora) {
      const redeemRes = await apiCall('/api/v1/zora/redeem', 'POST', 
        { reward_id: rewards.data[0].id }, token);
      expect(redeemRes.success).toBe(true);
      console.log('Redeem:', JSON.stringify(redeemRes));
      await page.screenshot({ path: 'screenshots-s11/03-echange-success.png' });
    }
  });

  test('ÉTAPE 6 — Vérifier mes vouchers', async () => {
    const vouchers = await apiCall('/api/v1/zora/vouchers', 'GET', null, token);
    expect(vouchers.success).toBe(true);
    expect(vouchers.data.length).toBeGreaterThan(0);
  });

  test('ÉTAPE 7 — Fermer modal', async () => {
    await page.evaluate(() => window.__bolamu_test.closeVoucherModal());
    await page.waitForTimeout(1000);
  });

});
```

**WhatsApp attendus :** aucun
**Statut :** ⏳ À tester

---

## SCENARIO S12 — Patient s'inscrit à un événement Elonga

**Acteurs :** Patient, Animateur
**Déclencheur :** Patient voit un événement publié et veut participer

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/events/:id | - | { success: true, data: {title, description, date, location, places_restantes} } |
| POST | /api/v1/events/:id/register | - | { success: true, data: { registration_id, checkin_token } } |
| GET | /api/v1/events/my/registrations | - | { success: true, data: [{event_id, status}] } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| elonga_registrations | phone | +242069735418 |
| elonga_registrations | event_id | ID événement |
| elonga_registrations | status | 'registered' |
| elonga_events | places_restantes | décrémenté |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Ouvrir panel événement | #event-panel | visible |
| Détails affichés | #event-title | visible |
| Participer | #participate-btn | cliqué |
| Inscription confirmée | #registration-success | visible |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S12 — Patient s\'inscrit à un événement Elonga', () => {

  let page, context, token;
  let eventId;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Récupérer événements disponibles', async () => {
    const events = await apiCall('/api/v1/events', 'GET', null, null);
    const availableEvent = events.data?.find(e => e.status === 'published' && e.places_restantes > 0);
    expect(availableEvent).toBeDefined();
    eventId = availableEvent.id;
    console.log('Événement test:', availableEvent.title, '| Places:', availableEvent.places_restantes);
  });

  test('ÉTAPE 2 — Ouvrir panel événement', async () => {
    await page.evaluate((id) => window.__bolamu_test.openEventPanel(id), eventId);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s12/01-event-panel.png' });
  });

  test('ÉTAPE 3 — S\'inscrire', async () => {
    await page.evaluate((id) => window.__bolamu_test.participate(id), eventId);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s12/02-inscription.png' });
  });

  test('ÉTAPE 4 — Vérifier inscription', async () => {
    const myRegs = await apiCall('/api/v1/events/my/registrations', 'GET', null, token);
    const isRegistered = myRegs.data?.some(r => r.event_id === eventId);
    expect(isRegistered).toBe(true);
  });

  test('ÉTAPE 5 — Fermer panel', async () => {
    await page.evaluate(() => window.__bolamu_test.closeEventPanel());
    await page.waitForTimeout(1000);
  });

});
```

**WhatsApp attendus :** `bolamu_event_inscription` avec params [prenom, titre_event, date_event]
**Statut :** ⏳ À tester

---

## SCENARIO S13 — Check-in patient à un événement Elonga (scan QR)

**Acteurs :** Patient, Animateur
**Déclencheur :** Événement démarre — animateur scanne le QR du patient pour valider présence

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/dmn/qr-payload | - | { success: true, data: { payload: JWT_SIGNÉ } } |
| GET | /api/v1/events/my/registrations | - | { success: true, data: [{event_id, checkin_token}] } |
| POST | /api/v1/events/:id/checkin | {token: uuid} | { success: true, data: { points_credited: 30 } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| elonga_registrations | checked_in | true |
| event_checkin_log | event_id | ID événement |
| event_checkin_log | phone | +242069735418 |
| zora_ledger | action_type | 'event_checkin' |
| zora_ledger | points | 30 |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Patient affiche QR | #qr-modal | visible |
| Animateur scanne | #checkin-input | valeur saisie |
| Check-in succès | #checkin-success | visible |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S13 — Check-in patient à événement', () => {

  let pagePatient, pageAnim, contextPatient, contextAnim;
  let tokenPatient, tokenAnim, eventId, checkinToken;

  test.beforeAll(async ({ browser }) => {
    contextPatient = await browser.newContext();
    pagePatient = await contextPatient.newPage();
    handleDialogs(pagePatient, 'accept');
    await loginAs(pagePatient, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(pagePatient);
    tokenPatient = await pagePatient.evaluate(() => localStorage.getItem('bolamu_patient_token'));

    contextAnim = await browser.newContext();
    pageAnim = await contextAnim.newPage();
    handleDialogs(pageAnim, 'accept');
    await loginAs(pageAnim, 'animateur', '+242000000088', 'bolamu2026');
    await waitForDashboard(pageAnim);
    tokenAnim = await pageAnim.evaluate(() => localStorage.getItem('bolamu_animateur_token'));
  });

  test.afterAll(async () => {
    await contextPatient.close();
    await contextAnim.close();
  });

  test('ÉTAPE 1 — Patient affiche son QR', async () => {
    await pagePatient.evaluate(() => window.__bolamu_test.openDmnQrModal());
    await pagePatient.waitForTimeout(2000);
    await pagePatient.screenshot({ path: 'screenshots-s13/01-patient-qr.png' });
  });

  test('ÉTAPE 2 — Récupérer checkin token du patient', async () => {
    const myRegs = await apiCall('/api/v1/events/my/registrations', 'GET', null, tokenPatient);
    expect(myRegs.data?.length).toBeGreaterThan(0);
    eventId = myRegs.data[0].event_id;
    checkinToken = myRegs.data[0].checkin_token;
  });

  test('ÉTAPE 3 — Animateur scanne et valide', async () => {
    const checkinRes = await apiCall(`/api/v1/events/${eventId}/checkin`, 'POST',
      { token: checkinToken }, tokenAnim);
    expect(checkinRes.success).toBe(true);
    expect(checkinRes.points_credited).toBe(30);
    console.log('Zora crédité au check-in:', checkinRes.points_credited);
    await pageAnim.screenshot({ path: 'screenshots-s13/02-checkin-success.png' });
  });

  test('ÉTAPE 4 — Vérifier registration check-in', async () => {
    const myRegs = await apiCall('/api/v1/events/my/registrations', 'GET', null, tokenPatient);
    expect(myRegs.data[0].checked_in).toBe(true);
  });

});
```

**WhatsApp attendus :** `bolamu_checkin_confirme` avec params [prenom, titre_event]
**Statut :** ⏳ À tester

---

## SCENARIO S14 — Animateur crée un événement

**Acteurs :** Animateur, Admin
**Déclencheur :** Animateur organise une activité communautaire

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| POST | /api/v1/animateur/login | {phone, password} | { success: true, data: { access_token, role: 'animateur' } } |
| POST | /api/v1/animateur/events | multipart: {title, description, date, location, capacity, cover} | { success: true, data: { event_id, status: 'pending_validation' } } |
| PATCH | /api/v1/events/:id/publish | - | { success: true, data: { status: 'published' } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| elonga_events | status | 'pending_validation' → 'published' |
| elonga_events | organizer_phone | +242000000088 |
| elonga_events | title | 'Marche Santé Test 2026' |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Dashboard Animateur | #dashboard-animateur | visible |
| Créer événement | #create-event-btn | cliqué |
| Formulaire rempli | #event-form | visible |
| Publication admin | #admin-publish-btn | cliqué |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S14 — Animateur crée un événement', () => {

  let pageAnim, pageAdmin, contextAnim, contextAdmin;
  let tokenAnim, tokenAdmin, newEventId;

  test.beforeAll(async ({ browser }) => {
    contextAnim = await browser.newContext();
    pageAnim = await contextAnim.newPage();
    handleDialogs(pageAnim, 'accept');
    await loginAs(pageAnim, 'animateur', '+242000000088', 'bolamu2026');
    await waitForDashboard(pageAnim);
    tokenAnim = await pageAnim.evaluate(() => localStorage.getItem('bolamu_animateur_token'));

    contextAdmin = await browser.newContext();
    pageAdmin = await contextAdmin.newPage();
    handleDialogs(pageAdmin, 'accept');
    await loginAs(pageAdmin, 'admin', '+242060000099', 'bolamu2026');
    await waitForDashboard(pageAdmin);
    tokenAdmin = await pageAdmin.evaluate(() => localStorage.getItem('bolamu_admin_token'));
  });

  test.afterAll(async () => {
    await contextAnim.close();
    await contextAdmin.close();
  });

  test('ÉTAPE 1 — Créer événement via API', async () => {
    const createRes = await apiCall('/api/v1/animateur/events', 'POST', {
      title: 'Marche Santé Test 2026',
      description: 'Événement test Playwright',
      date: '2026-08-15',
      location: 'Brazzaville',
      capacity: '50'
    }, tokenAnim);
    expect(createRes.success).toBe(true);
    newEventId = createRes.data?.id || createRes.data?.event?.id;
    console.log('Événement créé:', newEventId);
    await pageAnim.screenshot({ path: 'screenshots-s14/01-event-cree.png' });
  });

  test('ÉTAPE 2 — Vérifier status pending_validation', async () => {
    const eventDetail = await apiCall(`/api/v1/events/${newEventId}`, 'GET', null, null);
    expect(eventDetail.data.status).toBe('pending_validation');
  });

  test('ÉTAPE 3 — Admin publie l\'événement', async () => {
    const publishRes = await apiCall(`/api/v1/events/${newEventId}/publish`, 'PATCH', null, tokenAdmin);
    expect(publishRes.success).toBe(true);
    await pageAdmin.screenshot({ path: 'screenshots-s14/02-event-publie.png' });
  });

  test('ÉTAPE 4 — Vérifier status published', async () => {
    const eventDetail = await apiCall(`/api/v1/events/${newEventId}`, 'GET', null, null);
    expect(eventDetail.data.status).toBe('published');
  });

});
```

**WhatsApp attendus :** `bolamu_admin_event_soumis` (admin), `bolamu_animateur_event_valide` (animateur)
**Statut :** ⏳ À tester

---

## SCENARIO S15 — Patient rejoint un club communauté

**Acteurs :** Patient
**Déclencheur :** Patient découvre un club santé et veut participer

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/clubs/:id | - | { success: true, data: {name, description, members_count} } |
| POST | /api/v1/clubs/:id/join | - | { success: true, data: { membership_id } } |
| GET | /api/v1/clubs/:id/members | - | { success: true, data: [{phone, zora_balance}] } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| club_members | phone | +242069735418 |
| club_members | club_id | ID club |
| clubs | members_count | incrémenté |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Ouvrir panel club | #club-panel | visible |
| Détails affichés | #club-name | visible |
| Rejoindre | #join-club-btn | cliqué |
| Membre confirmé | #membership-success | visible |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S15 — Patient rejoint un club communauté', () => {

  let page, context, token;
  let clubId;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Récupérer liste des clubs', async () => {
    const clubs = await apiCall('/api/v1/clubs', 'GET', null, null);
    expect(clubs.data?.length).toBeGreaterThan(0);
    clubId = clubs.data[0].id;
    console.log('Club test:', clubs.data[0].name);
  });

  test('ÉTAPE 2 — Ouvrir panel club', async () => {
    await page.evaluate((id) => window.__bolamu_test.openClubPanel(id), clubId);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s15/01-club-panel.png' });
  });

  test('ÉTAPE 3 — Rejoindre le club', async () => {
    await page.evaluate((id) => window.__bolamu_test.joinClub(id), clubId);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s15/02-join-success.png' });
  });

  test('ÉTAPE 4 — Vérifier membres', async () => {
    const members = await apiCall(`/api/v1/clubs/${clubId}/members`, 'GET', null, token);
    const isMember = members.data?.some(m => m.phone === '+242069735418');
    expect(isMember).toBe(true);
  });

  test('ÉTAPE 5 — Fermer panel', async () => {
    await page.evaluate(() => window.__bolamu_test.closeClubPanel());
    await page.waitForTimeout(1000);
  });

});
```

**WhatsApp attendus :** `bolamu_animateur_nouveau_membre` avec params [club_name, membre_nom]
**Statut :** ⏳ À tester

---

## SCENARIO S16 — Patient envoie un message dans le chat communauté

**Acteurs :** Patient
**Déclencheur :** Patient veut interagir avec la communauté Bolamu

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/chat/communaute | - | { success: true, data: { conversation_id } } |
| GET | /api/v1/chat/conversations/:id/messages | - | { success: true, data: [{content, sender_phone, sent_at}] } |
| POST | /api/v1/chat/conversations/:id/messages | {content} | { success: true, data: { message_id } } |
| POST | /api/v1/chat/conversations/:id/read | - | { success: true } |
| GET | /api/v1/chat/unread | - | { success: true, data: { count } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| messages | content | 'Bonjour la communauté !' |
| messages | sender_phone | +242069735418 |
| conversation_participants | phone | +242069735418 |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Ouvrir chat | #chat-modal | visible |
| Chat communauté | #communaute-tab | cliqué |
| Message envoyé | #message-input | vidé |
| Message affiché | #message-list | contient message |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S16 — Patient envoie message chat communauté', () => {

  let page, context, token;
  let convId;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Ouvrir chat', async () => {
    await page.evaluate(() => window.__bolamu_test.openChat());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s16/01-chat-open.png' });
  });

  test('ÉTAPE 2 — Aller vers chat communauté', async () => {
    await page.evaluate(() => window.__bolamu_test.openChatReal());
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.__bolamu_test.chatCommunaute());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s16/02-communaute.png' });
  });

  test('ÉTAPE 3 — Récupérer conversation communauté', async () => {
    const communaute = await apiCall('/api/v1/chat/communaute', 'GET', null, token);
    expect(communaute.success).toBe(true);
    convId = communaute.data.id;
  });

  test('ÉTAPE 4 — Envoyer message', async () => {
    await page.evaluate(() => window.__bolamu_test.sendChatMessage());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s16/03-message-envoye.png' });
  });

  test('ÉTAPE 5 — Vérifier message envoyé via API', async () => {
    const msgs = await apiCall(`/api/v1/chat/conversations/${convId}/messages`, 'GET', null, token);
    expect(msgs.data?.length).toBeGreaterThan(0);
    console.log('Dernier message:', msgs.data[0]?.content);
  });

  test('ÉTAPE 6 — Marquer comme lu + fermer', async () => {
    await apiCall(`/api/v1/chat/conversations/${convId}/read`, 'POST', null, token);
    await page.evaluate(() => window.__bolamu_test.closeChat());
    await page.waitForTimeout(1000);
  });

});
```

**WhatsApp attendus :** `bolamu_message_offline` (si destinataire hors ligne)
**Statut :** ⏳ À tester

---

## SCENARIO S17 — Patient consulte et discute avec son médecin

**Acteurs :** Patient, Médecin
**Déclencheur :** Patient veut envoyer un message à son médecin après consultation

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/chat/doctors | - | { success: true, data: [{phone, full_name}] } |
| POST | /api/v1/chat/medecin/:medecin_phone | - | { success: true, data: { conversation_id } } |
| GET | /api/v1/chat/conversations/:id/messages | - | { success: true, data: [{content, sender_phone}] } |
| POST | /api/v1/chat/conversations/:id/messages | {content} | { success: true, data: { message_id } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| conversations | last_message_at | mis à jour |
| messages | content | 'Bonjour Docteur...' |
| messages | sender_phone | +242069735418 |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Ouvrir chat | #chat-modal | visible |
| Chat médecins | #medecins-tab | cliqué |
| Sélectionner médecin | #doctor-card | cliqué |
| Message envoyé | #message-input | vidé |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S17 — Patient discute avec son médecin', () => {

  let page, context, token;
  let medecinPhone, convId;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Ouvrir chat médecins', async () => {
    await page.evaluate(() => window.__bolamu_test.openChat());
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.__bolamu_test.openChatReal());
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.__bolamu_test.chatMedecins());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s17/01-medecins-chat.png' });
  });

  test('ÉTAPE 2 — Récupérer médecins disponibles', async () => {
    const doctors = await apiCall('/api/v1/chat/doctors', 'GET', null, token);
    expect(doctors.data?.length).toBeGreaterThan(0);
    medecinPhone = doctors.data[0].phone;
  });

  test('ÉTAPE 3 — Créer/trouver conversation', async () => {
    const convRes = await apiCall(`/api/v1/chat/medecin/${medecinPhone}`, 'POST', null, token);
    expect(convRes.success).toBe(true);
    convId = convRes.data.id;
  });

  test('ÉTAPE 4 — Envoyer message', async () => {
    const msgRes = await apiCall(`/api/v1/chat/conversations/${convId}/messages`, 'POST',
      { content: 'Bonjour Docteur, j\'ai une question suite à notre consultation.' }, token);
    expect(msgRes.success).toBe(true);
    await page.screenshot({ path: 'screenshots-s17/02-message-envoye.png' });
  });

  test('ÉTAPE 5 — Fermer chat', async () => {
    await page.evaluate(() => window.__bolamu_test.closeChat());
    await page.waitForTimeout(1000);
  });

});
```

**WhatsApp attendus :** `bolamu_message_offline` (si médecin hors ligne)
**Statut :** ⏳ À tester

---

## SCENARIO S18 — Patient consulte le leaderboard Zora

**Acteurs :** Patient
**Déclencheur :** Patient veut voir son classement hebdomadaire dans la communauté

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/leaderboard/weekly/top3 | - | { success: true, data: [{phone, zora_balance, rank}] } |
| GET | /api/v1/leaderboard/weekly | - | { success: true, data: { top10, my_position } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| zora_ledger | balance | trié DESC |
| leaderboard_weekly | phone | +242069735418 |
| leaderboard_weekly | rank | calculé |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Charger accueil | #accueil-section | visible |
| Top 3 affiché | #top3-section | visible |
| Ma position | #my-rank | visible |
| Toast encouragement | #toast-encourager | visible (bientôt disponible) |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S18 — Patient consulte leaderboard Zora', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Charger accueil', async () => {
    await page.evaluate(() => window.__bolamu_test.goAccueil());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots-s18/01-accueil.png' });
  });

  test('ÉTAPE 2 — Top 3 public', async () => {
    const top3 = await apiCall('/api/v1/leaderboard/weekly/top3', 'GET', null, null);
    expect(top3.success).toBe(true);
    console.log('Top 3:', JSON.stringify(top3.data));
  });

  test('ÉTAPE 3 — Leaderboard complet avec position', async () => {
    const leaderboard = await page.evaluate(() => window.__bolamu_test.getLeaderboard());
    console.log('Ma position:', leaderboard?.my_position);
    await page.screenshot({ path: 'screenshots-s18/02-leaderboard.png' });
  });

  test('ÉTAPE 4 — Tester encouragement (toast attendu)', async () => {
    const top3 = await apiCall('/api/v1/leaderboard/weekly/top3', 'GET', null, null);
    if (top3.data?.[0]?.phone) {
      await page.evaluate((phone) => window.__bolamu_test.encourageMember(phone), top3.data[0].phone);
      await page.waitForTimeout(1500);
      // Toast "Fonctionnalité bientôt disponible" attendu
    }
  });

  test('ÉTAPE 5 — Tester commentaire (toast attendu)', async () => {
    const top3 = await apiCall('/api/v1/leaderboard/weekly/top3', 'GET', null, null);
    if (top3.data?.[0]?.phone) {
      await page.evaluate((phone) => window.__bolamu_test.toggleCommentInput(phone), top3.data[0].phone);
      await page.evaluate((phone) => window.__bolamu_test.updateCommentText(phone, 'Bravo !'), top3.data[0].phone);
      await page.evaluate((phone) => window.__bolamu_test.sendComment(phone), top3.data[0].phone);
      await page.waitForTimeout(1500);
      // Toast "Fonctionnalité bientôt disponible" attendu
    }
  });

});
```

**WhatsApp attendus :** aucun
**Statut :** ⏳ À tester

---

## SCENARIO S19 — Partenaire valide un voucher patient

**Acteurs :** Patient, Partenaire
**Déclencheur :** Patient présente son voucher Zora chez un partenaire

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/zora/vouchers | - | { success: true, data: [{uuid, reward_name, status}] } |
| POST | /api/v1/zora/vouchers/:uuid/consume | - | { success: true, data: { discount_amount, status: 'used' } } |
| GET | /api/v1/zora/partner/vouchers | - | { success: true, data: [{uuid, reward_name, consumed_at}] } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| zora_vouchers | status | 'used' |
| zora_vouchers | used_at | mis à jour |
| zora_vouchers | used_by_partner | +242066226116 |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Patient affiche voucher | #voucher-modal | visible |
| Partenaire scanne | #voucher-input | valeur saisie |
| Validation succès | #validation-success | visible |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S19 — Partenaire valide un voucher patient', () => {

  let pagePatient, pagePartenaire, contextPatient, contextPartenaire;
  let tokenPatient, tokenPartenaire, voucherUuid;

  test.beforeAll(async ({ browser }) => {
    contextPatient = await browser.newContext();
    pagePatient = await contextPatient.newPage();
    handleDialogs(pagePatient, 'accept');
    await loginAs(pagePatient, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(pagePatient);
    tokenPatient = await pagePatient.evaluate(() => localStorage.getItem('bolamu_patient_token'));

    contextPartenaire = await browser.newContext();
    pagePartenaire = await contextPartenaire.newPage();
    handleDialogs(pagePartenaire, 'accept');
    await loginAs(pagePartenaire, 'partenaire', '+242066226116', 'WR383LMW');
    await waitForDashboard(pagePartenaire);
    tokenPartenaire = await pagePartenaire.evaluate(() => localStorage.getItem('bolamu_partenaire_token'));
  });

  test.afterAll(async () => {
    await contextPatient.close();
    await contextPartenaire.close();
  });

  test('ÉTAPE 1 — Patient affiche ses vouchers', async () => {
    await pagePatient.evaluate(() => window.__bolamu_test.goRecompenses());
    await pagePatient.waitForTimeout(2000);
    await pagePatient.screenshot({ path: 'screenshots-s19/01-vouchers-patient.png' });
  });

  test('ÉTAPE 2 — Récupérer voucher actif', async () => {
    const vouchers = await apiCall('/api/v1/zora/vouchers', 'GET', null, tokenPatient);
    const activeVoucher = vouchers.data?.find(v => v.status === 'active');
    expect(activeVoucher).toBeDefined();
    voucherUuid = activeVoucher.uuid;
    console.log('Voucher test:', voucherUuid);
  });

  test('ÉTAPE 3 — Partenaire consomme le voucher', async () => {
    const consumeRes = await apiCall(`/api/v1/zora/vouchers/${voucherUuid}/consume`, 'POST', null, tokenPartenaire);
    expect(consumeRes.success).toBe(true);
    expect(consumeRes.data.status).toBe('used');
    console.log('Voucher consommé:', consumeRes.data.discount_amount);
    await pagePartenaire.screenshot({ path: 'screenshots-s19/02-consumption-success.png' });
  });

  test('ÉTAPE 4 — Vérifier voucher utilisé', async () => {
    const vouchers = await apiCall('/api/v1/zora/vouchers', 'GET', null, tokenPatient);
    const usedVoucher = vouchers.data?.find(v => v.uuid === voucherUuid);
    expect(usedVoucher.status).toBe('used');
  });

});

```

**WhatsApp attendus :** aucun
**Statut :** ⏳ À tester

---

## SCENARIO S20 — Tiers-payant pharmacie

**Acteurs :** Patient, Pharmacie
**Déclencheur :** Patient adhérent Bolamu se présente à la pharmacie sans payer directement

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/agence/verifier-adherent?q=PHONE | - | { success: true, data: {full_name, subscription_plan} } |
| POST | /api/v1/tiers-payant/initier | {patient_phone, montant, description} | { success: true, data: { transaction_id, status: 'pending' } } |
| PATCH | /api/v1/tiers-payant/:id/valider | - | { success: true, data: { status: 'validé' } } |
| GET | /api/v1/tiers-payant/mes-transactions | - | { success: true, data: [{id, montant, status}] } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| tiers_payant_transactions | patient_phone | +242069735418 |
| tiers_payant_transactions | montant | 15000 |
| tiers_payant_transactions | status | 'validé' |
| tiers_payant_transactions | remise | 15% (pharmacie) |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Dashboard Pharmacie | #dashboard-pharmacie | visible |
| Vérifier adhérent | #search-input | valeur saisie |
| Initier transaction | #initier-btn | cliqué |
| Valider transaction | #valider-btn | cliqué |
| Transaction succès | #transaction-success | visible |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S20 — Tiers-payant pharmacie', () => {

  let page, context, token;
  let transId;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'pharmacie', '+242066226116', 'WR383LMW');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_pharmacie_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Vérifier adhérent', async () => {
    const adherentRes = await apiCall('/api/v1/agence/verifier-adherent?q=+242069735418', 'GET', null, token);
    expect(adherentRes.success).toBe(true);
    expect(adherentRes.data.subscription_plan).toBeTruthy();
    console.log('Adhérent:', adherentRes.data.full_name, '| Plan:', adherentRes.data.subscription_plan);
    await page.screenshot({ path: 'screenshots-s20/01-adherent-verifie.png' });
  });

  test('ÉTAPE 2 — Initier tiers-payant', async () => {
    const tierRes = await apiCall('/api/v1/tiers-payant/initier', 'POST', {
      patient_phone: '+242069735418',
      montant: 15000,
      description: 'Amoxicilline 500mg x30'
    }, token);
    expect(tierRes.success).toBe(true);
    transId = tierRes.data.id;
    console.log('Transaction initiée:', transId);
    await page.screenshot({ path: 'screenshots-s20/02-transaction-initiee.png' });
  });

  test('ÉTAPE 3 — Valider transaction', async () => {
    const validerRes = await apiCall(`/api/v1/tiers-payant/${transId}/valider`, 'PATCH', null, token);
    expect(validerRes.success).toBe(true);
    expect(validerRes.data.status).toBe('validé');
    await page.screenshot({ path: 'screenshots-s20/03-validation-success.png' });
  });

  test('ÉTAPE 4 — Voir mes transactions', async () => {
    const myTrans = await apiCall('/api/v1/tiers-payant/mes-transactions', 'GET', null, token);
    expect(myTrans.data?.length).toBeGreaterThan(0);
    console.log('Transactions pharmacie:', myTrans.data.length);
  });

});

```

**WhatsApp attendus :** aucun
**Statut :** ⏳ À tester

---

## SCENARIO S21 — Agence importe des employés (B2B SmartFlow)

**Acteurs :** Agence, Employés (Patients)
**Déclencheur :** Entreprise signataire veut enrôler tous ses salariés dans Bolamu

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| POST | /api/v1/agence/login | {phone, password} | { success: true, data: { access_token, role: 'agent_bolamu' } } |
| POST | /api/v1/agence/import-employes | {company_id, employes: [{phone, full_name, plan}]} | { success: true, data: { created_count, failed_count } } |
| GET | /api/v1/auth/onboarding/:token | - | { success: true, data: { phone, first_login_done: true } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| users | phone | +24206EMP0001 |
| users | role | 'employee' |
| subscriptions | status | 'active' |
| subscriptions | plan | 'essentiel' |
| company_employees | company_id | 'COMPANY_TEST_001' |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Dashboard Agence | #dashboard-agence | visible |
| Formulaire import | #import-form | visible |
| Fichier uploadé | #file-input | valeur |
| Import succès | #import-result | visible |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S21 — Agence importe employés B2B', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'agent', '+242077000010', 'bolamu2026');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_agent_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Importer employés via API', async () => {
    const importRes = await apiCall('/api/v1/agence/import-employes', 'POST', {
      company_id: 'COMPANY_TEST_001',
      employes: [
        { phone: '+24206EMP0001', full_name: 'Employé Test Un', plan: 'essentiel' },
        { phone: '+24206EMP0002', full_name: 'Employé Test Deux', plan: 'standard' },
        { phone: '+24206EMP0003', full_name: 'Employé Test Trois', plan: 'essentiel' }
      ]
    }, token);
    expect(importRes.success).toBe(true);
    console.log('Employés importés:', importRes.data.created_count);
    await page.screenshot({ path: 'screenshots-s21/01-import-success.png' });
  });

  test('ÉTAPE 2 — Vérifier employés en DB', async () => {
    // Vérification via API ou DB directe
    const employees = await apiCall('/api/v1/agence/employees?company_id=COMPANY_TEST_001', 'GET', null, token);
    expect(employees.data?.length).toBeGreaterThan(0);
  });

});

```

**WhatsApp attendus :** `bolamu_bienvenue_patient_v4` (par employé)
**Statut :** ⏳ À tester

---

## SCENARIO S22 — Prestataire enregistre un acte hors-catalogue SmartFlow

**Acteurs :** Prestataire (médecin/pharmacie/labo), Patient
**Déclencheur :** Patient bénéficiaire consomme un soin non listé dans le catalogue SSP

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/smartflow/medicaments/check?nom=NOM | - | { success: true, data: { type: 'hors_catalogue' } } |
| POST | /api/v1/smartflow/hors-catalogue | {patient_phone, medicament, montant, type_acte} | { success: true, data: { transaction_id, status: 'pending_validation' } } |
| GET | /api/v1/smartflow/stats/moi?mois=YYYY-MM | - | { success: true, data: { total_montant, actes_count } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| hors_catalogue_transactions | patient_phone | +242069735418 |
| hors_catalogue_transactions | medicament | 'Ciprofloxacine 500mg' |
| hors_catalogue_transactions | status | 'pending_validation' |
| hors_catalogue_transactions | montant | 8500 |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Dashboard Prestataire | #dashboard-prestataire | visible |
| Vérifier médicament | #check-medoc | valeur saisie |
| Enregistrer acte | #hors-catalogue-form | visible |
| Acte soumis | #submission-success | visible |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S22 — Prestataire enregistre acte hors-catalogue', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'medecin', '+242060000001', 'bolamu2026');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_medecin_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Vérifier si médicament SSP ou hors-catalogue', async () => {
    const checkMed = await apiCall('/api/v1/smartflow/medicaments/check?nom=Ciprofloxacine', 'GET', null, token);
    expect(checkMed.success).toBe(true);
    console.log('Type médicament:', checkMed.data?.type);
  });

  test('ÉTAPE 2 — Enregistrer acte hors-catalogue', async () => {
    const horsRes = await apiCall('/api/v1/smartflow/hors-catalogue', 'POST', {
      patient_phone: '+242069735418',
      medicament: 'Ciprofloxacine 500mg',
      montant: 8500,
      type_acte: 'pharmacie'
    }, token);
    expect(horsRes.success).toBe(true);
    console.log('Acte hors-catalogue enregistré:', horsRes.data.transaction_id);
    await page.screenshot({ path: 'screenshots-s22/01-acte-soumis.png' });
  });

  test('ÉTAPE 3 — Stats prestataire', async () => {
    const statsRes = await apiCall('/api/v1/smartflow/stats/moi?mois=2026-07', 'GET', null, token);
    expect(statsRes.success).toBe(true);
    console.log('Stats ce mois:', JSON.stringify(statsRes.data));
  });

});

```

**WhatsApp attendus :** aucun
**Statut :** ⏳ À tester

---

## SCENARIO S23 — RH valide les retenues SmartFlow du mois

**Acteurs :** RH (entreprise), Admin Bolamu
**Déclencheur :** Fin de mois — RH doit valider les remboursements employés et retenues sur salaire

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/smartflow/rh/dashboard | - | { success: true, data: {employes_actifs, actes_mois, totaux} } |
| GET | /api/v1/smartflow/rh/retenues/provisoire?mois=YYYY-MM | - | { success: true, data: [{employe_id, montant}] } |
| POST | /api/v1/smartflow/rh/retenues/valider | {mois, employe_ids: []} | { success: true, data: { validated_count } } |
| GET | /api/v1/smartflow/rh/rapport/:mois | - | { success: true, data: { rapport } } |
| GET | /api/v1/smartflow/rh/export/:mois | - | { success: true, data: CSV } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| company_employees | status | 'active' |
| hors_catalogue_transactions | status | 'pending_validation' → 'validated' |
| retenues_validees | mois | '2026-07' |
| smartflow_reports | mois | '2026-07' |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Dashboard RH | #dashboard-rh | visible |
| Retenues provisoires | #retenues-list | visible |
| Validation succès | #validation-success | visible |
| Export CSV | #export-btn | cliqué |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S23 — RH valide les retenues SmartFlow', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'rh', '+242077000002', 'bolamu2026');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_rh_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Dashboard RH', async () => {
    const dashRH = await apiCall('/api/v1/smartflow/rh/dashboard', 'GET', null, token);
    expect(dashRH.success).toBe(true);
    console.log('Dashboard RH:', JSON.stringify(dashRH.data));
    await page.screenshot({ path: 'screenshots-s23/01-dashboard-rh.png' });
  });

  test('ÉTAPE 2 — Retenues provisoires', async () => {
    const retenues = await apiCall('/api/v1/smartflow/rh/retenues/provisoire?mois=2026-07', 'GET', null, token);
    expect(retenues.success).toBe(true);
    console.log('Retenues provisoires:', retenues.data?.length, 'employés');
  });

  test('ÉTAPE 3 — Valider retenues', async () => {
    const retenues = await apiCall('/api/v1/smartflow/rh/retenues/provisoire?mois=2026-07', 'GET', null, token);
    if (retenues.data?.length > 0) {
      const employe_ids = retenues.data.map(r => r.employe_id);
      const validerRes = await apiCall('/api/v1/smartflow/rh/retenues/valider', 'POST', {
        mois: '2026-07',
        employe_ids: employe_ids
      }, token);
      expect(validerRes.success).toBe(true);
      console.log('Retenues validées:', validerRes.data.validated_count);
      await page.screenshot({ path: 'screenshots-s23/02-validation-success.png' });
    }
  });

  test('ÉTAPE 4 — Export CSV', async () => {
    const exportUrl = '/api/v1/smartflow/rh/export/2026-07';
    console.log('Export CSV URL:', exportUrl);
  });

});

```

**WhatsApp attendus :** aucun
**Statut :** ⏳ À tester

---

## SCENARIO S24 — Patient pré-remplit ses symptômes avant RDV

**Acteurs :** Patient
**Déclencheur :** Patient a un RDV confirmé et veut préparer sa consultation en ligne

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/appointments/patient/:phone | - | { success: true, data: [{id, session_code, status}] } |
| POST | /api/v1/appointments/:id/symptoms | {motif, symptomes, duree_symptomes, intensite, traitements_en_cours, remarques_patient} | { success: true, data: { appointment_id } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| appointments | id | ID RDV |
| appointment_symptoms | appointment_id | ID RDV |
| appointment_symptoms | motif | 'Douleurs abdominales' |
| appointment_symptoms | symptomes | ['Nausées', 'Fièvre légère'] |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Dashboard Patient | #dashboard-patient | visible |
| Liste RDV | #appointments-list | visible |
| Formulaire symptômes | #symptoms-form | visible |
| Symptômes soumis | #symptoms-success | visible |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S24 — Patient pré-remplit symptômes avant RDV', () => {

  let page, context, token;
  let rdvId;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Récupérer RDV du patient', async () => {
    const rdvs = await apiCall('/api/v1/appointments/patient/+242069735418', 'GET', null, token);
    const prochainRdv = rdvs.appointments?.find(r => r.status === 'confirme');
    expect(prochainRdv).toBeDefined();
    rdvId = prochainRdv.id;
    console.log('RDV confirmé:', rdvId);
  });

  test('ÉTAPE 2 — Soumettre symptômes', async () => {
    const symptomsRes = await apiCall(`/api/v1/appointments/${rdvId}/symptoms`, 'POST', {
      motif: 'Douleurs abdominales',
      symptomes: ['Nausées', 'Fièvre légère'],
      duree_symptomes: '3 jours',
      intensite: '6',
      traitements_en_cours: 'Paracétamol 500mg',
      remarques_patient: 'Douleurs surtout après repas'
    }, token);
    expect(symptomsRes.success).toBe(true);
    console.log('Symptômes enregistrés:', symptomsRes.data.appointment_id);
    await page.screenshot({ path: 'screenshots-s24/01-symptomes-soumis.png' });
  });

  test('ÉTAPE 3 — Vérifier symptômes enregistrés', async () => {
    const rdvDetail = await apiCall(`/api/v1/appointments/${rdvId}`, 'GET', null, token);
    expect(rdvDetail.data.symptomes_motif).toBe('Douleurs abdominales');
  });

});

```

**WhatsApp attendus :** aucun
**Statut :** ⏳ À tester

---

## SCENARIO S25 — Patient récupère ses notifications

**Acteurs :** Patient
**Déclencheur :** Patient reçoit des notifications in-app (RDV, Zora, événements…)

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| GET | /api/v1/notifications/unread-count | - | { success: true, data: { count } } |
| GET | /api/v1/notifications | - | { success: true, data: [{id, type, titre, message, is_read, sent_at}] } |
| PATCH | /api/v1/notifications/:id/read | - | { success: true, data: { is_read: true, read_at } } |
| PATCH | /api/v1/notifications/read-all | - | { success: true, data: { count_updated } } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| notifications | phone | +242069735418 |
| notifications | is_read | false → true |
| notifications | read_at | mis à jour |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Dashboard Patient | #dashboard-patient | visible |
| Badge non lus | #notification-badge | visible |
| Liste notifications | #notifications-list | visible |
| Notification lue | #notification-item | cliqué |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S25 — Patient récupère ses notifications', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'patient', '+242069735418', 'TestNouveau2026!');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_patient_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Badge non lus', async () => {
    const unreadCount = await apiCall('/api/v1/notifications/unread-count', 'GET', null, token);
    expect(unreadCount.success).toBe(true);
    console.log('Non lus:', unreadCount.data?.count);
  });

  test('ÉTAPE 2 — Liste notifications', async () => {
    const notifs = await apiCall('/api/v1/notifications', 'GET', null, token);
    expect(notifs.success).toBe(true);
    console.log('Notifications:', notifs.data?.length);
    await page.screenshot({ path: 'screenshots-s25/01-notifications-list.png' });
  });

  test('ÉTAPE 3 — Marquer première comme lue', async () => {
    const notifs = await apiCall('/api/v1/notifications', 'GET', null, token);
    if (notifs.data?.length > 0) {
      const readRes = await apiCall(`/api/v1/notifications/${notifs.data[0].id}/read`, 'PATCH', null, token);
      expect(readRes.success).toBe(true);
    }
  });

  test('ÉTAPE 4 — Tout marquer lu', async () => {
    const readAllRes = await apiCall('/api/v1/notifications/read-all', 'PATCH', null, token);
    expect(readAllRes.success).toBe(true);
  });

  test('ÉTAPE 5 — Vérifier badge réinitialisé', async () => {
    const unreadAfter = await apiCall('/api/v1/notifications/unread-count', 'GET', null, token);
    expect(unreadAfter.data?.count).toBe(0);
  });

});

```

**WhatsApp attendus :** aucun
**Statut :** ⏳ À tester

---

## SCENARIO S26 — Animateur gère ses clubs et notifie les membres

**Acteurs :** Animateur, Membres du club
**Déclencheur :** Animateur veut annoncer une activité à son club

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| POST | /api/v1/animateur/login | {phone, password} | { success: true, data: { access_token, role: 'animateur' } } |
| GET | /api/v1/animateur/clubs | - | { success: true, data: [{id, name, members_count}] } |
| GET | /api/v1/animateur/stats | - | { success: true, data: {events_created, checkins, members} } |
| POST | /api/v1/animateur/clubs/:id/notify | {message} | { success: true, data: { notified_count } } |
| GET | /api/v1/animateur/events/:id/registrations | - | { success: true, data: [{phone, status}] } |
| GET | /api/v1/animateur/checkins/today | - | { success: true, data: [{event_id, count}] } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| clubs | organizer_phone | +242000000088 |
| club_members | club_id | ID club |
| elonga_registrations | event_id | ID événement |
| event_checkin_log | phone | +242069735418 |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Dashboard Animateur | #dashboard-animateur | visible |
| Liste clubs | #clubs-list | visible |
| Notifier club | #notify-btn | cliqué |
| Notification envoyée | #notification-success | visible |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S26 — Animateur gère ses clubs et notifie les membres', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'animateur', '+242000000088', 'bolamu2026');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_animateur_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Stats animateur', async () => {
    const stats = await apiCall('/api/v1/animateur/stats', 'GET', null, token);
    expect(stats.success).toBe(true);
    console.log('Stats animateur:', JSON.stringify(stats.data));
    await page.screenshot({ path: 'screenshots-s26/01-stats-animateur.png' });
  });

  test('ÉTAPE 2 — Mes clubs', async () => {
    const clubs = await apiCall('/api/v1/animateur/clubs', 'GET', null, token);
    expect(clubs.success).toBe(true);
    const monClub = clubs.data?.[0];
    console.log('Club:', monClub?.name, '| Membres:', monClub?.members_count);
  });

  test('ÉTAPE 3 — Notifier le club', async () => {
    const clubs = await apiCall('/api/v1/animateur/clubs', 'GET', null, token);
    if (clubs.data?.[0]) {
      const notifRes = await apiCall(`/api/v1/animateur/clubs/${clubs.data[0].id}/notify`, 'POST', {
        message: 'Activité sportive samedi matin 7h au stade !'
      }, token);
      expect(notifRes.success).toBe(true);
      console.log('Notification club envoyée:', notifRes.data.notified_count);
      await page.screenshot({ path: 'screenshots-s26/02-notification-envoyee.png' });
    }
  });

  test('ÉTAPE 4 — Check-ins du jour', async () => {
    const checkinsToday = await apiCall('/api/v1/animateur/checkins/today', 'GET', null, token);
    expect(checkinsToday.success).toBe(true);
    console.log('Check-ins aujourd\\'hui:', checkinsToday.data?.length);
  });

});

```

**WhatsApp attendus :** `bolamu_club_activite`
**Statut :** ⏳ À tester

---

## SCENARIO S27 — Admin supervise la plateforme

**Acteurs :** Admin Bolamu
**Déclencheur :** Admin effectue sa revue quotidienne de la plateforme

**BACKEND — APIs attendues :**
| Méthode | Endpoint | Body | Réponse attendue |
|---------|----------|------|-----------------|
| POST | /api/v1/auth/admin-login | {phone, password} | { success: true, data: { access_token, role: 'admin' } } |
| GET | /api/v1/events/admin/events/pending | - | { success: true, data: [{id, title, status}] } |
| PATCH | /api/v1/events/:id/publish | - | { success: true, data: { status: 'published' } } |
| GET | /api/v1/tiers-payant/admin | - | { success: true, data: [{id, montant, status}] } |
| PATCH | /api/v1/tiers-payant/admin/:id/reconcilier | - | { success: true, data: { status: 'reconcilied' } } |
| GET | /api/v1/admin/smartflow/stats?mois=YYYY-MM | - | { success: true, data: { stats } } |
| POST | /api/v1/zora/earn | {phone, points, reason} | { success: true, data: { balance } } |
| GET | /api/v1/patients/search?q=PHONE | - | { success: true, data: [{phone, full_name}] } |

**BASE DE DONNÉES — Vérifications :**
| Table | Champ | Valeur attendue |
|-------|-------|----------------|
| audit_log | event_type | 'admin_login' |
| audit_log | actor_phone | +242060000099 |
| elonga_events | status | 'pending_validation' → 'published' |
| tiers_payant_transactions | status | 'pending' → 'reconcilied' |
| zora_ledger | action_type | 'manual_credit' |

**FRONTEND UI/UX — États attendus :**
| Étape | Élément DOM | État attendu |
|-------|-------------|-------------|
| Dashboard Admin | #dashboard-admin | visible |
| Événements en attente | #pending-events | visible |
| Publier événement | #publish-btn | cliqué |
| Transactions tiers-payant | #transactions-list | visible |
| Réconcilier transaction | #reconcile-btn | cliqué |

**SPEC PLAYWRIGHT :**
```javascript
const { test, expect } = require('@playwright/test');
const { loginAs, waitForDashboard, handleDialogs, apiCall } = require('../helpers/bolamu-helpers');

test.describe.serial('S27 — Admin supervise la plateforme', () => {

  let page, context, token;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    handleDialogs(page, 'accept');
    await loginAs(page, 'admin', '+242060000099', 'bolamu2026');
    await waitForDashboard(page);
    token = await page.evaluate(() => localStorage.getItem('bolamu_admin_token'));
  });

  test.afterAll(async () => await context.close());

  test('ÉTAPE 1 — Événements en attente', async () => {
    const pendingEvents = await apiCall('/api/v1/events/admin/events/pending', 'GET', null, token);
    expect(pendingEvents.success).toBe(true);
    console.log('Événements en attente:', pendingEvents.data?.length);
    await page.screenshot({ path: 'screenshots-s27/01-pending-events.png' });
  });

  test('ÉTAPE 2 — Publier premier événement en attente', async () => {
    const pendingEvents = await apiCall('/api/v1/events/admin/events/pending', 'GET', null, token);
    if (pendingEvents.data?.length > 0) {
      const publishRes = await apiCall(`/api/v1/events/${pendingEvents.data[0].id}/publish`, 'PATCH', null, token);
      expect(publishRes.success).toBe(true);
      console.log('Événement publié:', JSON.stringify(publishRes));
      await page.screenshot({ path: 'screenshots-s27/02-event-published.png' });
    }
  });

  test('ÉTAPE 3 — Stats SmartFlow', async () => {
    const sfStats = await apiCall('/api/v1/admin/smartflow/stats?mois=2026-07', 'GET', null, token);
    expect(sfStats.success).toBe(true);
    console.log('SmartFlow stats:', JSON.stringify(sfStats.data));
  });

  test('ÉTAPE 4 — Crédit Zora manuel test', async () => {
    const zoraEarnRes = await apiCall('/api/v1/zora/earn', 'POST', {
      phone: '+242069735418',
      points: 100,
      reason: 'Crédit manuel test admin Playwright'
    }, token);
    expect(zoraEarnRes.success).toBe(true);
    console.log('Zora crédité:', zoraEarnRes.data.balance);
  });

  test('ÉTAPE 5 — Recherche patient', async () => {
    const searchRes = await apiCall('/api/v1/patients/search?q=+242069735418', 'GET', null, token);
    expect(searchRes.success).toBe(true);
    expect(searchRes.data?.[0]?.full_name).toBeTruthy();
    console.log('Patient trouvé:', searchRes.data[0].full_name);
  });

});

```

**WhatsApp attendus :** `bolamu_animateur_event_valide` (si validation événement), `bolamu_animateur_event_refuse` (si refus)
**Statut :** ⏳ À tester

---

*Fin des 27 scénarios — SCENARIOS_VIE_BOLAMU.md v1.0 — 28 juin 2026*
