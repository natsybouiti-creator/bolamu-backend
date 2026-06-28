# SCENARIOS VIE BOLAMU
> 27 scénarios de bout en bout — routes vérifiées dans src/routes/ — templates WhatsApp réels — tables DB réelles
> Version 1.0 — 28 juin 2026

---

## COMPTES DE TEST

| # | ACTEUR | TÉLÉPHONE | MOT DE PASSE | DASHBOARD |
|---|---|---|---|---|
| 1 | Admin | +242060000099 | bolamu2026 | admin/dashboard.html |
| 2 | Agent | +242064000000 | bolamu2026 | agence/dashboard.html |
| 3 | Agent | +242077000010 | bolamu2026 | agence/dashboard.html |
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
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Agent → Se connecte → Dashboard Agence (`/agence/login`)
2. `POST /api/v1/agence/login` — body: `{phone, password}` → retourne JWT 12h + role=agent_bolamu
3. Agent → Lance wizard souscription complète → Dashboard Agence
4. `POST /api/v1/agence/souscrire-complet` — multipart: identité + photo + docs + plan (essentiel/standard/premium) → crée user, subscription, photo Cloudinary, génère temp_password + member_code (BLM-XXXXX)
5. Backend → `sendWhatsAppTemplate(patient_phone, 'bolamu_bienvenue_patient_v4', [...])` + `sendOnboardingLink()`
6. Patient reçoit WhatsApp avec lien magic link → clique → `GET /api/v1/auth/onboarding/:token` → `first_login_done=TRUE`
7. Agent → Voit confirmation avec `{temp_password, member_code, subscription_id}`

**APIs touchées :**
- `POST /api/v1/agence/login`
- `POST /api/v1/agence/souscrire-complet`
- `GET /api/v1/auth/onboarding/:token`

**WhatsApp attendus :** `bolamu_bienvenue_patient_v4`
**Tables DB à vérifier :** `users`, `subscriptions`, `documents`, `audit_log`

**Script Playwright :**
```javascript
// Page 1 : Dashboard Agence
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/agence/login');
await page.fill('[name=phone]', '+242069735418');
await page.fill('[name=password]', 'TestNouveau2026!');
await page.click('[type=submit]');
await page.waitForTimeout(2000);

// Wizard souscription (upload multipart via API directe)
const res = await page.evaluate(async () => {
  const form = new FormData();
  form.append('phone', '+24206TEST0001');
  form.append('full_name', 'Test Nouveau Patient');
  form.append('plan', 'essentiel');
  const r = await fetch('/api/v1/agence/souscrire-complet', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
    body: form
  });
  return r.json();
});
console.assert(res.success, 'Wizard failed: ' + JSON.stringify(res));
console.assert(res.data.member_code.startsWith('BLM-'), 'member_code invalide');

// Vérif DB : user créé + subscription active
const dbCheck = await pool.query(
  'SELECT u.phone, s.status FROM users u JOIN subscriptions s ON s.patient_phone = u.phone WHERE u.phone = $1',
  ['+24206TEST0001']
);
console.assert(dbCheck.rows[0].status === 'active', 'Subscription non active');
```

**Statut :** ⏳ À tester

---

## SCENARIO S02 — Souscription en ligne (patient existant)

**Acteurs :** Patient
**Déclencheur :** Patient sans abonnement actif se connecte et choisit un plan
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Patient → Se connecte → `POST /api/v1/auth/login` → JWT 15min + refresh 7j
2. Patient → Vérifie son statut → `GET /api/v1/patients/check-subscription?phone=` → `{active: false}`
3. Patient → Choisit plan → `POST /api/v1/patients/subscription` — body: `{plan: 'essentiel'}` → crée subscription pending
4. Patient → Initie paiement MoMo → `POST /api/v1/momo/request` — body: `{amount, phone}` → `{reference_id}`
5. Patient → Poll statut → `GET /api/v1/momo/status/:referenceId` → SUCCESSFUL → `handlePaymentSuccess()` → subscription active
6. DB: `payments.status = 'completed'`, `subscriptions.status = 'active'`, `audit_log` INSERT

**APIs touchées :**
- `POST /api/v1/auth/login`
- `GET /api/v1/patients/check-subscription`
- `POST /api/v1/patients/subscription`
- `POST /api/v1/momo/request`
- `GET /api/v1/momo/status/:referenceId`

**WhatsApp attendus :** aucun
**Tables DB à vérifier :** `users`, `subscriptions`, `payments`, `audit_log`

**Script Playwright :**
```javascript
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/patient/dashboard.html');

// Vérif protocole
const ok = await page.evaluate(() => !!window.__bolamu_test);
if (!ok) throw new Error('Protocole absent — vérifier le dashboard');

// Login via API
const loginRes = await page.evaluate(async () => {
  const r = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ phone: '+242069735418', password: 'TestNouveau2026!' })
  });
  return r.json();
});
console.assert(loginRes.success, 'Login failed');

// Check subscription
const subCheck = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/patients/check-subscription?phone=+242069735418', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginRes.data.access_token);

// Init MoMo
const momoRes = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/momo/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ amount: 5000, phone: '+242069735418' })
  });
  return r.json();
}, loginRes.data.access_token);
console.assert(momoRes.data?.reference_id, 'MoMo reference_id absent');
```

**Statut :** ⏳ À tester

---

## SCENARIO S03 — Renouvellement abonnement avec upgrade de plan

**Acteurs :** Patient
**Déclencheur :** Abonnement actif arrive à expiration ou patient veut upgrader
**À développer :** Cron renouvellement automatique (relance 7j avant expiration) + WhatsApp rappel renouvellement

**Étapes :**
1. Patient → `GET /api/v1/patients/subscription` → voit `expiry_date`, `plan`
2. Patient → Initie upgrade → `PATCH /api/v1/patients/subscription/upgrade` — body: `{new_plan: 'premium'}` → `upgradeAbonnement()` calcule prorata
3. Patient → Paye différentiel → `POST /api/v1/momo/request` → webhook `POST /api/v1/momo/webhook` (HMAC-SHA256) → `handlePaymentSuccess()` désactive ancienne subscription, crée nouvelle
4. DB: ancienne subscription `status='expired'`, nouvelle `status='active'` avec 30j fenêtre

**APIs touchées :**
- `GET /api/v1/patients/subscription`
- `PATCH /api/v1/patients/subscription/upgrade`
- `POST /api/v1/momo/request`
- `POST /api/v1/momo/webhook`

**WhatsApp attendus :** aucun (rappel renouvellement = À développer)
**Tables DB à vérifier :** `subscriptions`, `payments`, `audit_log`

**Script Playwright :**
```javascript
const page = await browser.newPage();

// Auth
const loginRes = await page.evaluate(async () => {
  const r = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ phone: '+242069735418', password: 'TestNouveau2026!' })
  });
  return r.json();
});

// Voir abonnement actuel
const subRes = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/patients/subscription', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginRes.data.access_token);
console.log('Plan actuel:', subRes.data?.plan, '| Expiry:', subRes.data?.expiry_date);

// Upgrade vers premium
const upgradeRes = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/patients/subscription/upgrade', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ new_plan: 'premium' })
  });
  return r.json();
}, loginRes.data.access_token);
console.assert(upgradeRes.success, 'Upgrade failed: ' + JSON.stringify(upgradeRes));
```

**Statut :** ⏳ À tester

---

## SCENARIO S04 — Patient prend un RDV médecin

**Acteurs :** Patient, Médecin
**Déclencheur :** Patient veut consulter un médecin disponible
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Patient → Dashboard → ouvre modal RDV → `window.__bolamu_test.openModal()`
2. Patient → Choisit médecin → `window.__bolamu_test.rdvSelectDoctor('DOCTOR_ID')`
3. `GET /api/v1/appointments/slots/:doctor_id?date=2026-07-01` → `{slots: ['09:00','09:30',...], pris: [...]}`
4. Patient → Choisit créneau → `window.__bolamu_test.rdvSelectDate('2026-07-01')` → `window.__bolamu_test.rdvSelectSlot('09:00')`
5. Patient → Confirme → `window.__bolamu_test.confirmRdv()`
6. `POST /api/v1/appointments/book` — body: `{patient_phone, doctor_id, date, time}` → INSERT appointments, génère session_code
7. Backend → `sendWhatsAppTemplate(patient_phone, 'bolamu_rdv_confirme', [prenom, date, heure, medecin, adresse, session_code])`
8. Backend → `sendWhatsAppTemplate(doctor_phone, 'bolamu_rdv_confirme', [...])` + `notify(patient_phone, 'rdv_confirme', {...})`
9. Modal fermée → Dashboard affiche prochain RDV

**APIs touchées :**
- `GET /api/v1/appointments/slots/:doctor_id`
- `POST /api/v1/appointments/book`

**WhatsApp attendus :** `bolamu_rdv_confirme` (patient + médecin)
**Tables DB à vérifier :** `appointments`, `notifications`

**Script Playwright :**
```javascript
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/patient/dashboard.html');
await page.waitForTimeout(3000);

const ok = await page.evaluate(() => !!window.__bolamu_test);
if (!ok) throw new Error('Protocole absent — vérifier le dashboard');

// Naviguer vers accueil
await page.evaluate(() => window.__bolamu_test.goAccueil());
await page.waitForTimeout(3000);

// Ouvrir modal RDV
await page.evaluate(() => window.__bolamu_test.openModal());
await page.waitForTimeout(2000);

// Sélectionner médecin, date, créneau
await page.evaluate(() => window.__bolamu_test.rdvSelectDoctor('1'));
await page.waitForTimeout(1500);
await page.evaluate(() => window.__bolamu_test.rdvSelectDate('2026-07-15'));
await page.waitForTimeout(2000);
await page.evaluate(() => window.__bolamu_test.rdvSelectSlot('09:00'));
await page.waitForTimeout(1000);

// Confirmer
const rdvResult = await page.evaluate(async () => {
  window.__bolamu_test.confirmRdv();
  return new Promise(resolve => setTimeout(() => resolve(window.__bolamu_test.getState()), 3000));
});
console.log('State après RDV:', JSON.stringify(rdvResult));

// Fermer modal
await page.evaluate(() => window.__bolamu_test.closeModal());

// Vérif DB
// SELECT id, session_code, status FROM appointments WHERE patient_phone = '+242069735418' ORDER BY created_at DESC LIMIT 1
```

**Statut :** ⏳ À tester

---

## SCENARIO S05 — Consultation validée → Zora crédité

**Acteurs :** Médecin, Patient
**Déclencheur :** Médecin ouvre la consultation et entre le code session pour valider
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Médecin → Dashboard → voit RDV en cours → `POST /api/v1/appointments/:id/open` → status='en_cours'
2. Patient → Donne session_code au médecin verbalement
3. Médecin → Saisit session_code → `POST /api/v1/appointments/:id/validate` — body: `{session_code}` → vérifie code → status='termine'
4. Backend → `awardZora({phone: patient_phone, action_type: 'consultation', proof_class: 'system_event', proof_source: 'appointment_system', proof_reference: id})`
5. DB: `appointments.status='termine'`, `zora_ledger` INSERT (points consultation), `zora_ledger.balance` mis à jour

**APIs touchées :**
- `POST /api/v1/appointments/:id/open`
- `POST /api/v1/appointments/:id/validate`

**WhatsApp attendus :** aucun
**Tables DB à vérifier :** `appointments`, `zora_ledger`

**Script Playwright :**
```javascript
// Page 1 : Dashboard Médecin
const pageMedecin = await browser.newPage();
await pageMedecin.goto('https://www.bolamu.co/medecin/dashboard.html');

// Auth médecin (via token)
const loginMed = await pageMedecin.evaluate(async () => {
  const r = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ phone: '+24200MEDECIN1', password: 'MedPass2026!' })
  });
  return r.json();
});

// Récupérer RDV du patient test
const rdvList = await pageMedecin.evaluate(async (token) => {
  const r = await fetch('/api/v1/appointments/doctor/+24200MEDECIN1', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginMed.data.access_token);
const rdv = rdvList.data[0];

// Ouvrir consultation
await pageMedecin.evaluate(async (rdvId, token) => {
  await fetch(`/api/v1/appointments/${rdvId}/open`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token }
  });
}, rdv.id, loginMed.data.access_token);

// Vérif Zora avant validation
const zoraBefore = await pageMedecin.evaluate(async (token) => {
  const r = await fetch('/api/v1/zora/balance', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginMed.data.access_token);

// Valider avec session_code
const validateRes = await pageMedecin.evaluate(async (rdvId, code, token) => {
  const r = await fetch(`/api/v1/appointments/${rdvId}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ session_code: code })
  });
  return r.json();
}, rdv.id, rdv.session_code, loginMed.data.access_token);
console.assert(validateRes.success, 'Validation échouée');

// Vérif Zora après (balance augmentée)
// SELECT balance FROM zora_ledger WHERE phone = patient_phone ORDER BY created_at DESC LIMIT 1
```

**Statut :** ⏳ À tester

---

## SCENARIO S06 — Patient accède à son DMN (Dossier Médical Numérique)

**Acteurs :** Patient
**Déclencheur :** Patient veut consulter son dossier médical complet
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Patient → Dashboard → onglet Suivre → `window.__bolamu_test.goSuivre()` → `window.__bolamu_test.suivreDossier()`
2. `GET /api/v1/dmn/summary` (auth JWT) → retourne dossier complet → INSERT `dmn_access_log` (event_type='summary_view')
3. Patient → Veut télécharger document → `window.__bolamu_test.openDmnPasswordModal()`
4. Patient → Saisit mot de passe → `window.__bolamu_test.confirmDmnPassword()`
5. `POST /api/v1/dmn/download/verify` (strictLimiter 5/15min) — body: `{password}` → vérifie bcrypt → retourne DMN token 15min → INSERT `dmn_access_log`
6. Patient → `window.__bolamu_test.downloadDmnDoc(DOC_ID)`
7. `GET /api/v1/dmn/download/:document_id` (Bearer DMN token) → Cloudinary signed URL 60s → redirect
8. Patient → Consulte log → `GET /api/v1/dmn/access-log` → dernières 20 entrées

**APIs touchées :**
- `GET /api/v1/dmn/summary`
- `POST /api/v1/dmn/download/verify`
- `GET /api/v1/dmn/download/:document_id`
- `GET /api/v1/dmn/access-log`

**WhatsApp attendus :** aucun
**Tables DB à vérifier :** `documents`, `dmn_access_log`, `users`

**Script Playwright :**
```javascript
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/patient/dashboard.html');
await page.waitForTimeout(3000);

const ok = await page.evaluate(() => !!window.__bolamu_test);
if (!ok) throw new Error('Protocole absent');

// Naviguer vers Suivre → Dossier
await page.evaluate(() => window.__bolamu_test.goSuivre());
await page.waitForTimeout(3000);
await page.evaluate(() => window.__bolamu_test.suivreDossier());
await page.waitForTimeout(3000);

// Vérifier que DMN summary a été appelé
const dmnDocs = await page.evaluate(() => window.__bolamu_test.getDmnDocs());
console.log('Docs DMN:', JSON.stringify(dmnDocs));

// Ouvrir modal password
await page.evaluate(() => window.__bolamu_test.openDmnPasswordModal());
await page.waitForTimeout(1000);
await page.evaluate(() => window.__bolamu_test.confirmDmnPassword());
await page.waitForTimeout(2000);

// Télécharger premier document (si disponible)
if (dmnDocs && dmnDocs.length > 0) {
  await page.evaluate((docId) => window.__bolamu_test.downloadDmnDoc(docId), dmnDocs[0].id);
  await page.waitForTimeout(2000);
}

// Fermer modal
await page.evaluate(() => window.__bolamu_test.closeDmnPasswordModal());

// Vérif DB : dmn_access_log contient les entrées
// SELECT event_type, created_at FROM dmn_access_log WHERE user_phone = '+242069735418' ORDER BY created_at DESC LIMIT 5
```

**Statut :** ⏳ À tester

---

## SCENARIO S07 — Patient met à jour ses constantes médicales

**Acteurs :** Patient
**Déclencheur :** Patient veut compléter son profil de santé (groupe sanguin, poids, allergies…)
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Patient → Dashboard Suivre → `window.__bolamu_test.openEditConst()`
2. Patient → Remplit constantes → `window.__bolamu_test.setConstGroupe('O+')`, `setConstPoids('70')`, `setConstTaille('175')`, etc.
3. Patient → Sauvegarde → `window.__bolamu_test.saveConst()`
4. `POST /api/v1/dmn/update` (auth, patient only) — body avec champs autorisés → UPDATE `users` → `creditWellnessAction()` → 30 Zora crédités
5. DB: `users` mis à jour + `zora_ledger` INSERT + `dmn_access_log` INSERT

**APIs touchées :**
- `POST /api/v1/dmn/update`

**WhatsApp attendus :** aucun
**Tables DB à vérifier :** `users`, `zora_ledger`, `dmn_access_log`

**Script Playwright :**
```javascript
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/patient/dashboard.html');
await page.waitForTimeout(3000);

const ok = await page.evaluate(() => !!window.__bolamu_test);
if (!ok) throw new Error('Protocole absent');

// Vérif Zora avant mise à jour
const zoraBefore = await page.evaluate(() => window.__bolamu_test.getZora());
console.log('Zora avant:', zoraBefore);

// Naviguer vers Suivre
await page.evaluate(() => window.__bolamu_test.goSuivre());
await page.waitForTimeout(3000);

// Ouvrir modal constantes
await page.evaluate(() => window.__bolamu_test.openEditConst());
await page.waitForTimeout(1000);

// Remplir et sauvegarder
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
await page.evaluate(() => window.__bolamu_test.saveConst());
await page.waitForTimeout(2000);

// Vérif Zora après (doit avoir +30)
const zoraAfter = await page.evaluate(() => window.__bolamu_test.getZora());
console.assert(zoraAfter.balance >= zoraBefore.balance + 30, 'Zora non crédité pour mise à jour DMN');

await page.evaluate(() => window.__bolamu_test.closeEditConst());
```

**Statut :** ⏳ À tester

---

## SCENARIO S08 — Patient génère son QR d'identité médicale

**Acteurs :** Patient
**Déclencheur :** Patient doit partager son identité médicale en urgence ou pour admission
**À développer :** Intégration Google Health API pour export standard (optionnel futur)

**Étapes :**
1. Patient → Dashboard → `window.__bolamu_test.openQrUrg()`
2. `GET /api/v1/dmn/qr-payload` (auth, patient only) → génère JWT signé avec données médicales → INSERT `dmn_access_log` (event_type='qr_scan')
3. Dashboard affiche QR code encodant le JWT payload
4. Médecin urgentiste scanne le QR → lit payload sans auth (JWT auto-contenu)
5. Patient → `window.__bolamu_test.closeQrUrg()`

**APIs touchées :**
- `GET /api/v1/dmn/qr-payload`

**WhatsApp attendus :** aucun
**Tables DB à vérifier :** `dmn_access_log`, `users`

**Script Playwright :**
```javascript
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/patient/dashboard.html');
await page.waitForTimeout(3000);

const ok = await page.evaluate(() => !!window.__bolamu_test);
if (!ok) throw new Error('Protocole absent');

// Ouvrir QR urgence
await page.evaluate(() => window.__bolamu_test.openQrUrg());
await page.waitForTimeout(2000);

// Vérifier que QR payload a été généré
const qrRes = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/dmn/qr-payload', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, localStorage.getItem('bolamu_token'));
console.assert(qrRes.success && qrRes.data?.payload, 'QR payload absent');

// Vérif DB : dmn_access_log event_type='qr_scan'
// SELECT * FROM dmn_access_log WHERE user_phone = '+242069735418' AND event_type = 'qr_scan' ORDER BY created_at DESC LIMIT 1

await page.evaluate(() => window.__bolamu_test.closeQrUrg());
```

**Statut :** ⏳ À tester

---

## SCENARIO S09 — Patient joue à un jeu Zora (scratch card)

**Acteurs :** Patient
**Déclencheur :** Patient veut tenter sa chance pour gagner des points Zora
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Patient → Dashboard → `window.__bolamu_test.goGagner()` → `window.__bolamu_test.gagnerSport()` ou `gagnerSante()`
2. Patient → Voit jeux disponibles → `GET /api/v1/zora/games/config` → retourne config (coût, règles)
3. `GET /api/v1/zora/games/status` (auth) → vérifie si partie gratuite disponible aujourd'hui
4. Patient → `window.__bolamu_test.openScratch()`
5. Patient → `window.__bolamu_test.playScratch()`
6. `POST /api/v1/zora/games/play` — body: `{game_type: 'scratch', play_type: 'free'}` → INSERT `zora_game_plays`, crédite Zora si gagné
7. Dashboard → Affiche résultat + mise à jour solde Zora
8. Patient → `window.__bolamu_test.closeGame()`

**APIs touchées :**
- `GET /api/v1/zora/games/config`
- `GET /api/v1/zora/games/status`
- `POST /api/v1/zora/games/play`

**WhatsApp attendus :** aucun
**Tables DB à vérifier :** `zora_game_plays`, `zora_ledger`

**Script Playwright :**
```javascript
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/patient/dashboard.html');
await page.waitForTimeout(3000);

const ok = await page.evaluate(() => !!window.__bolamu_test);
if (!ok) throw new Error('Protocole absent');

await page.evaluate(() => window.__bolamu_test.goGagner());
await page.waitForTimeout(3000);

// Vérifier status jeux
const gamesStatus = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/zora/games/status', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, localStorage.getItem('bolamu_token'));
console.log('Games status:', JSON.stringify(gamesStatus));

const zoraBefore = await page.evaluate(() => window.__bolamu_test.getZora());

// Ouvrir et jouer scratch
await page.evaluate(() => window.__bolamu_test.openScratch());
await page.waitForTimeout(1000);
await page.evaluate(() => window.__bolamu_test.playScratch());
await page.waitForTimeout(3000);

const zoraAfter = await page.evaluate(() => window.__bolamu_test.getZora());
console.log('Zora avant:', zoraBefore.balance, '→ après:', zoraAfter.balance);

await page.evaluate(() => window.__bolamu_test.closeGame());

// Vérif DB
// SELECT * FROM zora_game_plays WHERE phone = '+242069735418' ORDER BY played_at DESC LIMIT 1
```

**Statut :** ⏳ À tester

---

## SCENARIO S10 — Patient joue quiz Zora

**Acteurs :** Patient
**Déclencheur :** Patient veut gagner des Zora en répondant à une question santé
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Patient → `window.__bolamu_test.openQuiz()`
2. `POST /api/v1/zora/games/play` — body: `{game_type: 'quiz', play_type: 'free'}` → retourne `{play_id, question, answers[]}`
3. Patient → `window.__bolamu_test.pickQuiz0()` (choix réponse A)
4. `POST /api/v1/zora/games/quiz/answer` — body: `{play_id, answer: 0}` → valide réponse → crédite Zora si correct
5. Dashboard affiche résultat
6. Patient → `window.__bolamu_test.closeGame()`

**APIs touchées :**
- `POST /api/v1/zora/games/play`
- `POST /api/v1/zora/games/quiz/answer`

**WhatsApp attendus :** aucun
**Tables DB à vérifier :** `zora_game_plays`, `zora_ledger`

**Script Playwright :**
```javascript
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/patient/dashboard.html');
await page.waitForTimeout(3000);

const ok = await page.evaluate(() => !!window.__bolamu_test);
if (!ok) throw new Error('Protocole absent');

await page.evaluate(() => window.__bolamu_test.goGagner());
await page.waitForTimeout(3000);

await page.evaluate(() => window.__bolamu_test.openQuiz());
await page.waitForTimeout(2000);

// Démarrer quiz
const quizStart = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/zora/games/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ game_type: 'quiz', play_type: 'free' })
  });
  return r.json();
}, localStorage.getItem('bolamu_token'));
console.log('Quiz démarré:', quizStart.data?.question);

// Répondre (première option)
await page.evaluate(() => window.__bolamu_test.pickQuiz0());
await page.waitForTimeout(1000);

// Soumettre réponse
const quizResult = await page.evaluate(async (playId, token) => {
  const r = await fetch('/api/v1/zora/games/quiz/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ play_id: playId, answer: 0 })
  });
  return r.json();
}, quizStart.data?.play_id, localStorage.getItem('bolamu_token'));
console.log('Résultat quiz:', quizResult);

await page.evaluate(() => window.__bolamu_test.closeGame());
```

**Statut :** ⏳ À tester

---

## SCENARIO S11 — Patient échange ses Zora contre une récompense

**Acteurs :** Patient, Partenaire
**Déclencheur :** Patient atteint un palier Zora et veut une récompense
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Patient → Dashboard → `window.__bolamu_test.goRecompenses()` → `window.__bolamu_test.filterCatTout()`
2. `GET /api/v1/zora/rewards?category=` → liste récompenses avec `tier_required`, `cost_zora`, `stock`
3. Patient → Sélectionne récompense disponible → `POST /api/v1/zora/redeem` — body: `{reward_id}` → `redeemReward()`
   - Erreurs possibles: `reward_not_found`, `tier_insufficient`, `insufficient_balance`, `reward_exhausted`, `user_not_found`
4. DB: `zora_ledger` débit, `zora_vouchers` INSERT (UUID), `zora_marketplace` stock décrémenté
5. Dashboard → `GET /api/v1/zora/vouchers` → affiche le nouveau voucher
6. Patient → `window.__bolamu_test.closeVoucherModal()`

**APIs touchées :**
- `GET /api/v1/zora/rewards`
- `POST /api/v1/zora/redeem`
- `GET /api/v1/zora/vouchers`

**WhatsApp attendus :** aucun
**Tables DB à vérifier :** `zora_marketplace`, `zora_vouchers`, `zora_ledger`

**Script Playwright :**
```javascript
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/patient/dashboard.html');
await page.waitForTimeout(3000);

const ok = await page.evaluate(() => !!window.__bolamu_test);
if (!ok) throw new Error('Protocole absent');

await page.evaluate(() => window.__bolamu_test.goRecompenses());
await page.waitForTimeout(3000);

// Voir récompenses disponibles
const rewards = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/zora/rewards', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, localStorage.getItem('bolamu_token'));
console.log('Récompenses:', rewards.data?.length, 'disponibles');

// Filtrer par catégorie
await page.evaluate(() => window.__bolamu_test.filterCatElec());
await page.waitForTimeout(1000);

// Balance Zora actuelle
const zoraState = await page.evaluate(() => window.__bolamu_test.getZora());
console.log('Balance Zora:', zoraState.balance);

// Tenter échange (si balance suffisante)
if (rewards.data?.length > 0 && zoraState.balance >= rewards.data[0].cost_zora) {
  const redeemRes = await page.evaluate(async (rewardId, token) => {
    const r = await fetch('/api/v1/zora/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ reward_id: rewardId })
    });
    return r.json();
  }, rewards.data[0].id, localStorage.getItem('bolamu_token'));
  console.log('Redeem:', JSON.stringify(redeemRes));

  // Vérifier mes vouchers
  const vouchers = await page.evaluate(() => window.__bolamu_test.getVouchers());
  console.assert(vouchers.length > 0, 'Voucher non créé');
  await page.evaluate(() => window.__bolamu_test.closeVoucherModal());
}
```

**Statut :** ⏳ À tester

---

## SCENARIO S12 — Patient s'inscrit à un événement Elonga

**Acteurs :** Patient, Animateur
**Déclencheur :** Patient voit un événement publié et veut participer
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Patient → Dashboard Accueil → `window.__bolamu_test.openEventPanel(EVENT_ID)`
2. `GET /api/v1/events/:id` (public) → détails: `{title, description, date, location, places_restantes, cover_image_path}`
3. Patient → `window.__bolamu_test.participate(EVENT_ID)`
4. `POST /api/v1/events/:id/register` (auth) → `registerForEvent({phone, event_id})` → INSERT `elonga_registrations` → décrémente `places_restantes`
   - Erreurs: `EVENT_NOT_AVAILABLE`, `EVENT_FULL`
5. Backend → `sendWhatsAppTemplate(phone, 'bolamu_event_inscription', [...])` (via registerForEvent)
6. Dashboard → Affiche "Inscrit" + places restantes mises à jour

**APIs touchées :**
- `GET /api/v1/events/:id`
- `POST /api/v1/events/:id/register`

**WhatsApp attendus :** `bolamu_event_inscription`
**Tables DB à vérifier :** `elonga_events`, `elonga_registrations`

**Script Playwright :**
```javascript
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/patient/dashboard.html');
await page.waitForTimeout(3000);

const ok = await page.evaluate(() => !!window.__bolamu_test);
if (!ok) throw new Error('Protocole absent');

// Récupérer événements disponibles
const events = await page.evaluate(async () => {
  const r = await fetch('/api/v1/events');
  return r.json();
});
const availableEvent = events.data?.find(e => e.status === 'published' && e.places_restantes > 0);
if (!availableEvent) throw new Error('Aucun événement disponible pour test');

const eventId = availableEvent.id;
console.log('Événement test:', availableEvent.title, '| Places:', availableEvent.places_restantes);

// Ouvrir panel événement
await page.evaluate((id) => window.__bolamu_test.openEventPanel(id), eventId);
await page.waitForTimeout(2000);

// S'inscrire
await page.evaluate((id) => window.__bolamu_test.participate(id), eventId);
await page.waitForTimeout(2000);

// Vérifier inscription
const myRegs = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/events/my/registrations', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, localStorage.getItem('bolamu_token'));
const isRegistered = myRegs.data?.some(r => r.event_id === eventId);
console.assert(isRegistered, 'Inscription non trouvée dans my/registrations');

await page.evaluate(() => window.__bolamu_test.closeEventPanel());

// Vérif DB
// SELECT * FROM elonga_registrations WHERE phone = '+242069735418' AND event_id = eventId
```

**Statut :** ⏳ À tester

---

## SCENARIO S13 — Check-in patient à un événement Elonga (scan QR)

**Acteurs :** Patient, Animateur
**Déclencheur :** Événement démarre — animateur scanne le QR du patient pour valider présence
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Patient → `window.__bolamu_test.openDmnQrModal()` → `GET /api/v1/dmn/qr-payload` → QR affiché (JWT signé)
2. Animateur → Dashboard Animateur → scan QR patient → extrait token UUID de `elonga_registrations`
3. `POST /api/v1/events/:id/checkin` (auth animateur) — body: `{token: uuid}` → `processCheckin({token, organizer_phone})`
4. `processCheckin` → vérifie token dans `elonga_registrations` → INSERT `event_checkin_log` → `awardZora({action_type: 'event_checkin'})`
5. Backend → `sendWhatsAppTemplate(patient_phone, 'bolamu_checkin_confirme', [...])`
6. DB: `elonga_registrations.checked_in=true`, `event_checkin_log` INSERT, `zora_ledger` crédit

**APIs touchées :**
- `GET /api/v1/dmn/qr-payload`
- `POST /api/v1/events/:id/checkin`
- (via animateur: `POST /api/v1/animateur/events/:id/checkin`)

**WhatsApp attendus :** `bolamu_checkin_confirme`
**Tables DB à vérifier :** `elonga_registrations`, `event_checkin_log`, `zora_ledger`

**Script Playwright :**
```javascript
// Page 1 : Patient affiche son QR
const pagePatient = await browser.newPage();
await pagePatient.goto('https://www.bolamu.co/patient/dashboard.html');
await pagePatient.waitForTimeout(3000);

const okPatient = await pagePatient.evaluate(() => !!window.__bolamu_test);
if (!okPatient) throw new Error('Protocole absent — patient');

await pagePatient.evaluate(() => window.__bolamu_test.openDmnQrModal());
await pagePatient.waitForTimeout(2000);

// Récupérer checkin token du patient
const checkinToken = await pagePatient.evaluate(async (token) => {
  const r = await fetch('/api/v1/events/my/registrations', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const data = await r.json();
  return data.data?.[0]?.checkin_token;
}, localStorage.getItem('bolamu_token'));

// Page 2 : Animateur scanne et valide
const pageAnim = await browser.newPage();
const loginAnim = await pageAnim.evaluate(async () => {
  const r = await fetch('/api/v1/animateur/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ phone: '+24200ANIMAT01', password: 'AnimPass2026!' })
  });
  return r.json();
});

const checkinRes = await pageAnim.evaluate(async (eventId, token, animToken) => {
  const r = await fetch(`/api/v1/events/${eventId}/checkin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + animToken },
    body: JSON.stringify({ token: token })
  });
  return r.json();
}, EVENT_ID, checkinToken, loginAnim.data.access_token);
console.assert(checkinRes.success, 'Check-in échoué: ' + JSON.stringify(checkinRes));
console.log('Zora crédité au check-in:', checkinRes.points_credited);
```

**Statut :** ⏳ À tester

---

## SCENARIO S14 — Animateur crée un événement

**Acteurs :** Animateur, Admin
**Déclencheur :** Animateur organise une activité communautaire
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Animateur → Dashboard Animateur → `POST /api/v1/animateur/login` → JWT
2. Animateur → Crée événement avec image → `POST /api/v1/animateur/events` (multipart: cover image → Cloudinary + métadonnées)
3. Backend → `createElongaEvent()` → INSERT `elonga_events` avec `status='pending_validation'`
4. Backend → `sendWhatsAppTemplate(admin_phone, 'bolamu_admin_event_soumis', [animateur_nom, titre])` (via ARCHITECTURE)
5. Admin → Valide l'événement → `PATCH /api/v1/events/:id/publish` (requireAdmin) → `publishEvent()` → `status='published'`
6. Backend → `sendWhatsAppTemplate(animateur_phone, 'bolamu_animateur_event_valide', [titre])` OU `bolamu_animateur_event_refuse`
7. DB: `elonga_events.status` transition `pending_validation → published`

**APIs touchées :**
- `POST /api/v1/animateur/login`
- `POST /api/v1/animateur/events`
- `PATCH /api/v1/events/:id/publish`

**WhatsApp attendus :** `bolamu_admin_event_soumis`, `bolamu_animateur_event_valide`
**Tables DB à vérifier :** `elonga_events`

**Script Playwright :**
```javascript
// Page 1 : Dashboard Animateur
const pageAnim = await browser.newPage();
await pageAnim.goto('https://www.bolamu.co/animateur/dashboard.html');

const loginAnim = await pageAnim.evaluate(async () => {
  const r = await fetch('/api/v1/animateur/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ phone: '+24200ANIMAT01', password: 'AnimPass2026!' })
  });
  return r.json();
});
console.assert(loginAnim.success, 'Login animateur failed');

// Créer événement via API (multipart simulé sans vraie image)
const createRes = await pageAnim.evaluate(async (token) => {
  const form = new FormData();
  form.append('title', 'Marche Santé Test 2026');
  form.append('description', 'Événement test Playwright');
  form.append('date', '2026-08-15');
  form.append('location', 'Brazzaville');
  form.append('capacity', '50');
  const r = await fetch('/api/v1/animateur/events', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: form
  });
  return r.json();
}, loginAnim.data.access_token);
console.assert(createRes.success, 'Création événement failed: ' + JSON.stringify(createRes));
const newEventId = createRes.data?.id || createRes.data?.event?.id;

// Vérif DB : status = pending_validation
// SELECT id, status FROM elonga_events WHERE id = newEventId

// Page 2 : Admin publie l'événement
const pageAdmin = await browser.newPage();
const loginAdmin = await pageAdmin.evaluate(async () => {
  const r = await fetch('/api/v1/auth/admin-login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ phone: '+242ADMIN001', password: 'AdminPass2026!' })
  });
  return r.json();
});

const publishRes = await pageAdmin.evaluate(async (eventId, token) => {
  const r = await fetch(`/api/v1/events/${eventId}/publish`, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, newEventId, loginAdmin.data.access_token);
console.assert(publishRes.success, 'Publish failed');
// DB: status = published
```

**Statut :** ⏳ À tester

---

## SCENARIO S15 — Patient rejoint un club communauté

**Acteurs :** Patient
**Déclencheur :** Patient découvre un club santé et veut participer
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Patient → Dashboard Accueil → `window.__bolamu_test.openClubPanel(CLUB_ID)`
2. `GET /api/v1/clubs/:id` (public) → détails club: `{name, description, members_count}`
3. Patient → `window.__bolamu_test.joinClub(CLUB_ID)`
4. `POST /api/v1/clubs/:id/join` (auth) → INSERT `club_members`
5. Backend → `sendWhatsAppTemplate(animateur_phone, 'bolamu_animateur_nouveau_membre', [club_name, membre_nom])`
6. Dashboard → Affiche membres → `GET /api/v1/clubs/:id/members` (auth) → JOIN `club_members → users → zora_ledger` ORDER BY Zora DESC

**APIs touchées :**
- `GET /api/v1/clubs/:id`
- `POST /api/v1/clubs/:id/join`
- `GET /api/v1/clubs/:id/members`

**WhatsApp attendus :** `bolamu_animateur_nouveau_membre`
**Tables DB à vérifier :** `clubs`, `club_members`

**Script Playwright :**
```javascript
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/patient/dashboard.html');
await page.waitForTimeout(3000);

const ok = await page.evaluate(() => !!window.__bolamu_test);
if (!ok) throw new Error('Protocole absent');

// Récupérer liste des clubs
const clubs = await page.evaluate(async () => {
  const r = await fetch('/api/v1/clubs');
  return r.json();
});
const firstClub = clubs.data?.[0];
if (!firstClub) throw new Error('Aucun club disponible pour test');

// Ouvrir panel club
await page.evaluate((id) => window.__bolamu_test.openClubPanel(id), firstClub.id);
await page.waitForTimeout(2000);

// Rejoindre le club
await page.evaluate((id) => window.__bolamu_test.joinClub(id), firstClub.id);
await page.waitForTimeout(2000);

// Vérifier membres
const members = await page.evaluate(async (clubId, token) => {
  const r = await fetch(`/api/v1/clubs/${clubId}/members`, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, firstClub.id, localStorage.getItem('bolamu_token'));
const isMember = members.data?.some(m => m.phone === '+242069735418');
console.assert(isMember, 'Patient non trouvé dans les membres du club');

await page.evaluate(() => window.__bolamu_test.closeClubPanel());

// Vérif DB
// SELECT * FROM club_members WHERE club_id = firstClub.id AND phone = '+242069735418'
```

**Statut :** ⏳ À tester

---

## SCENARIO S16 — Patient envoie un message dans le chat communauté

**Acteurs :** Patient
**Déclencheur :** Patient veut interagir avec la communauté Bolamu
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Patient → `window.__bolamu_test.openChat()`
2. Patient → `window.__bolamu_test.chatCommunaute()`
3. `GET /api/v1/chat/communaute` (auth) → conversation globale (id fixe communauté)
4. `GET /api/v1/chat/conversations/:id/messages` → messages paginés
5. Patient → `window.__bolamu_test.sendChatMessage()`
6. `POST /api/v1/chat/conversations/:id/messages` — body: `{content: 'Bonjour la communauté !'}` → INSERT `messages`
7. Socket.io diffuse en temps réel → badge unread mis à jour
8. Patient → `window.__bolamu_test.closeChat()` → `GET /api/v1/chat/unread` → badge rafraîchi

**APIs touchées :**
- `GET /api/v1/chat/communaute`
- `GET /api/v1/chat/conversations/:id/messages`
- `POST /api/v1/chat/conversations/:id/messages`
- `POST /api/v1/chat/conversations/:id/read`
- `GET /api/v1/chat/unread`

**WhatsApp attendus :** `bolamu_message_offline` (si destinataire hors ligne)
**Tables DB à vérifier :** `conversations`, `conversation_participants`, `messages`

**Script Playwright :**
```javascript
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/patient/dashboard.html');
await page.waitForTimeout(3000);

const ok = await page.evaluate(() => !!window.__bolamu_test);
if (!ok) throw new Error('Protocole absent');

// Ouvrir chat
await page.evaluate(() => window.__bolamu_test.openChat());
await page.waitForTimeout(2000);

// Aller vers chat communauté
await page.evaluate(() => window.__bolamu_test.openChatReal());
await page.waitForTimeout(1000);
await page.evaluate(() => window.__bolamu_test.chatCommunaute());
await page.waitForTimeout(2000);

// Envoyer message
await page.evaluate(() => window.__bolamu_test.sendChatMessage());
await page.waitForTimeout(2000);

// Vérifier message envoyé via API
const communaute = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/chat/communaute', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, localStorage.getItem('bolamu_token'));

const msgs = await page.evaluate(async (convId, token) => {
  const r = await fetch(`/api/v1/chat/conversations/${convId}/messages`, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, communaute.data?.id, localStorage.getItem('bolamu_token'));
console.log('Dernier message:', msgs.data?.[0]?.content);

// Marquer comme lu + fermer
await page.evaluate(async (convId, token) => {
  await fetch(`/api/v1/chat/conversations/${convId}/read`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token }
  });
}, communaute.data?.id, localStorage.getItem('bolamu_token'));

await page.evaluate(() => window.__bolamu_test.closeChat());
```

**Statut :** ⏳ À tester

---

## SCENARIO S17 — Patient consulte et discute avec son médecin

**Acteurs :** Patient, Médecin
**Déclencheur :** Patient veut envoyer un message à son médecin après consultation
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Patient → `window.__bolamu_test.openChat()` → `window.__bolamu_test.chatMedecins()`
2. `GET /api/v1/chat/doctors` (auth) → médecins avec RDV passés
3. Patient → Sélectionne médecin → `POST /api/v1/chat/medecin/:medecin_phone` → trouve ou crée conversation
4. `GET /api/v1/chat/conversations/:id/messages` → historique
5. Patient → Envoie message → `POST /api/v1/chat/conversations/:id/messages`
6. DB: INSERT `messages` + UPDATE `conversations.last_message_at`

**APIs touchées :**
- `GET /api/v1/chat/doctors`
- `POST /api/v1/chat/medecin/:medecin_phone`
- `GET /api/v1/chat/conversations/:id/messages`
- `POST /api/v1/chat/conversations/:id/messages`

**WhatsApp attendus :** `bolamu_message_offline` (si médecin hors ligne)
**Tables DB à vérifier :** `conversations`, `conversation_participants`, `messages`

**Script Playwright :**
```javascript
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/patient/dashboard.html');
await page.waitForTimeout(3000);

const ok = await page.evaluate(() => !!window.__bolamu_test);
if (!ok) throw new Error('Protocole absent');

await page.evaluate(() => window.__bolamu_test.openChat());
await page.waitForTimeout(2000);
await page.evaluate(() => window.__bolamu_test.openChatReal());
await page.waitForTimeout(1000);
await page.evaluate(() => window.__bolamu_test.chatMedecins());
await page.waitForTimeout(2000);

// Récupérer médecins disponibles
const doctors = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/chat/doctors', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, localStorage.getItem('bolamu_token'));
if (!doctors.data?.length) throw new Error('Aucun médecin avec RDV passé');

const medecinPhone = doctors.data[0].phone;

// Créer/trouver conversation
const convRes = await page.evaluate(async (mPhone, token) => {
  const r = await fetch(`/api/v1/chat/medecin/${mPhone}`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, medecinPhone, localStorage.getItem('bolamu_token'));
const convId = convRes.data?.id;

// Envoyer message
const msgRes = await page.evaluate(async (convId, token) => {
  const r = await fetch(`/api/v1/chat/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ content: 'Bonjour Docteur, j\'ai une question suite à notre consultation.' })
  });
  return r.json();
}, convId, localStorage.getItem('bolamu_token'));
console.assert(msgRes.success, 'Message non envoyé: ' + JSON.stringify(msgRes));

await page.evaluate(() => window.__bolamu_test.closeChat());
```

**Statut :** ⏳ À tester

---

## SCENARIO S18 — Patient consulte le leaderboard Zora

**Acteurs :** Patient
**Déclencheur :** Patient veut voir son classement hebdomadaire dans la communauté
**À développer :** Routes `encourage` et `comment` sur le leaderboard (frontend affiche toast "Fonctionnalité bientôt disponible")

**Étapes :**
1. Patient → Dashboard Accueil → Section leaderboard visible → `GET /api/v1/leaderboard/weekly/top3` (public) → top 3
2. Patient → `GET /api/v1/leaderboard/weekly` (auth) → top 10 + ma position
3. Patient → Tente d'encourager → `window.__bolamu_test.encourageMember(PHONE)` → `window.__bolamu_test.toastEncourager()` affiche "Fonctionnalité bientôt disponible"
4. Patient → Tente commentaire → `window.__bolamu_test.toggleCommentInput(PHONE)` → `window.__bolamu_test.sendComment(PHONE)` → même toast

**APIs touchées :**
- `GET /api/v1/leaderboard/weekly/top3`
- `GET /api/v1/leaderboard/weekly`

**WhatsApp attendus :** aucun
**Tables DB à vérifier :** `zora_ledger`

**Script Playwright :**
```javascript
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/patient/dashboard.html');
await page.waitForTimeout(3000);

const ok = await page.evaluate(() => !!window.__bolamu_test);
if (!ok) throw new Error('Protocole absent');

// Charger accueil
await page.evaluate(() => window.__bolamu_test.goAccueil());
await page.waitForTimeout(3000);

// Top 3 public
const top3 = await page.evaluate(async () => {
  const r = await fetch('/api/v1/leaderboard/weekly/top3');
  return r.json();
});
console.log('Top 3:', JSON.stringify(top3.data));

// Leaderboard complet avec position
const leaderboard = await page.evaluate(() => window.__bolamu_test.getLeaderboard());
console.log('Ma position:', leaderboard?.my_position);

// Tester encouragement (toast attendu — route n'existe pas)
if (top3.data?.[0]?.phone) {
  await page.evaluate((phone) => window.__bolamu_test.encourageMember(phone), top3.data[0].phone);
  await page.waitForTimeout(1500);
  // Toast "Fonctionnalité bientôt disponible" attendu
}

// Tester commentaire (toast attendu)
if (top3.data?.[0]?.phone) {
  await page.evaluate((phone) => window.__bolamu_test.toggleCommentInput(phone), top3.data[0].phone);
  await page.evaluate((phone) => window.__bolamu_test.updateCommentText(phone, 'Bravo !'), top3.data[0].phone);
  await page.evaluate((phone) => window.__bolamu_test.sendComment(phone), top3.data[0].phone);
  await page.waitForTimeout(1500);
  // Toast "Fonctionnalité bientôt disponible" attendu
}
```

**Statut :** ⏳ À tester

---

## SCENARIO S19 — Partenaire valide un voucher patient

**Acteurs :** Patient, Partenaire
**Déclencheur :** Patient présente son voucher Zora chez un partenaire
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Patient → `GET /api/v1/zora/vouchers/:uuid` (auth) → détails voucher + QR UUID
2. Patient → Affiche QR du voucher → `window.__bolamu_test.closeVoucherQrModal()`
3. Partenaire → Dashboard Partenaire → `POST /api/v1/partenaire/login` → JWT
4. Partenaire → Scanne QR → `POST /api/v1/zora/vouchers/:uuid/consume` (auth, rôle partenaire) → valide et marque consommé
5. Partenaire → Voit ses validations → `GET /api/v1/zora/partner/vouchers` → liste consommations
6. DB: `zora_vouchers.status='used'`, `zora_vouchers.used_at=NOW()`, `zora_vouchers.used_by_partner=partenaire_phone`

**APIs touchées :**
- `GET /api/v1/zora/vouchers/:uuid`
- `POST /api/v1/zora/vouchers/:uuid/consume`
- `GET /api/v1/zora/partner/vouchers`
- `POST /api/v1/partenaire/login`

**WhatsApp attendus :** aucun
**Tables DB à vérifier :** `zora_vouchers`, `partner_vouchers`

**Script Playwright :**
```javascript
// Page 1 : Patient récupère son voucher
const pagePatient = await browser.newPage();
const patientToken = localStorage.getItem('bolamu_token');

const vouchers = await pagePatient.evaluate(async (token) => {
  const r = await fetch('/api/v1/zora/vouchers', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, patientToken);
const voucher = vouchers.data?.find(v => v.status === 'active');
if (!voucher) throw new Error('Aucun voucher actif pour test');

console.log('Voucher UUID:', voucher.uuid, '| Récompense:', voucher.reward_name);

// Page 2 : Partenaire consomme le voucher
const pagePartenaire = await browser.newPage();
await pagePartenaire.goto('https://www.bolamu.co/partenaire/dashboard.html');

const loginPart = await pagePartenaire.evaluate(async () => {
  const r = await fetch('/api/v1/partenaire/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ phone: '+24200PARTNER1', password: 'PartnerPass2026!' })
  });
  return r.json();
});
console.assert(loginPart.success, 'Login partenaire failed');

const consumeRes = await pagePartenaire.evaluate(async (uuid, token) => {
  const r = await fetch(`/api/v1/zora/vouchers/${uuid}/consume`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, voucher.uuid, loginPart.data.access_token);
console.assert(consumeRes.success, 'Consommation voucher failed: ' + JSON.stringify(consumeRes));

// Vérif DB
// SELECT status, used_at FROM zora_vouchers WHERE uuid = voucher.uuid
// Attendu: status='used', used_at IS NOT NULL
```

**Statut :** ⏳ À tester

---

## SCENARIO S20 — Tiers-payant pharmacie

**Acteurs :** Patient, Pharmacie
**Déclencheur :** Patient adhérent Bolamu se présente à la pharmacie sans payer directement
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Pharmacie → Dashboard → `POST /api/v1/auth/login` (role=pharmacie)
2. Pharmacie → Vérifie adhérent → `GET /api/v1/agence/verifier-adherent?q=PHONE`
3. Pharmacie → Initie transaction tiers-payant → `POST /api/v1/tiers-payant/initier` (auth) — body: `{patient_phone, montant, description}` → INSERT `tiers_payant_transactions`
4. Pharmacie → Validation → `PATCH /api/v1/tiers-payant/:id/valider` (auth) → status='validé'
5. Admin → Réconciliation → `PATCH /api/v1/tiers-payant/admin/:id/reconcilier` (auth, admin)
6. DB: `tiers_payant_transactions` cycle complet

**APIs touchées :**
- `GET /api/v1/agence/verifier-adherent`
- `POST /api/v1/tiers-payant/initier`
- `PATCH /api/v1/tiers-payant/:id/valider`
- `GET /api/v1/tiers-payant/mes-transactions`

**WhatsApp attendus :** aucun
**Tables DB à vérifier :** `tiers_payant_transactions`, `users`, `subscriptions`

**Script Playwright :**
```javascript
// Page 1 : Dashboard Pharmacie
const pagePharm = await browser.newPage();
await pagePharm.goto('https://www.bolamu.co/pharmacie/dashboard.html');

const loginPharm = await pagePharm.evaluate(async () => {
  const r = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ phone: '+24200PHARMA1', password: 'PharmaPass2026!' })
  });
  return r.json();
});

// Vérifier adhérent
const adherentRes = await pagePharm.evaluate(async (token) => {
  const r = await fetch('/api/v1/agence/verifier-adherent?q=+242069735418', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginPharm.data.access_token);
console.log('Adhérent:', adherentRes.data?.full_name, '| Plan:', adherentRes.data?.subscription_plan);

// Initier tiers-payant
const tierRes = await pagePharm.evaluate(async (token) => {
  const r = await fetch('/api/v1/tiers-payant/initier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      patient_phone: '+242069735418',
      montant: 15000,
      description: 'Amoxicilline 500mg x30'
    })
  });
  return r.json();
}, loginPharm.data.access_token);
console.assert(tierRes.success, 'Tiers-payant init failed: ' + JSON.stringify(tierRes));

// Valider
const validerRes = await pagePharm.evaluate(async (transId, token) => {
  const r = await fetch(`/api/v1/tiers-payant/${transId}/valider`, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, tierRes.data.id, loginPharm.data.access_token);
console.assert(validerRes.success, 'Validation failed');

// Voir mes transactions
const myTrans = await pagePharm.evaluate(async (token) => {
  const r = await fetch('/api/v1/tiers-payant/mes-transactions', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginPharm.data.access_token);
console.log('Transactions pharmacie:', myTrans.data?.length);
```

**Statut :** ⏳ À tester

---

## SCENARIO S21 — Agence importe des employés (B2B SmartFlow)

**Acteurs :** Agence, Employés (Patients)
**Déclencheur :** Entreprise signataire veut enrôler tous ses salariés dans Bolamu
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Agent → `POST /api/v1/agence/login` → JWT agent_bolamu
2. Agent → Upload CSV/JSON employés → `POST /api/v1/agence/import-employes` — body: `{company_id, employes: [{phone, full_name, plan}]}` → création bulk users + subscriptions + liaison `company_employees`
3. Pour chaque employé → génère mot de passe temp → `sendOnboardingLink()`
4. Employés reçoivent lien magic link → `GET /api/v1/auth/onboarding/:token`
5. DB: `users`, `subscriptions`, `company_employees` tous créés

**APIs touchées :**
- `POST /api/v1/agence/login`
- `POST /api/v1/agence/import-employes`
- `GET /api/v1/auth/onboarding/:token` (pour chaque employé)

**WhatsApp attendus :** `bolamu_bienvenue_patient_v4` (par employé)
**Tables DB à vérifier :** `users`, `subscriptions`, `company_employees`

**Script Playwright :**
```javascript
// Page : Dashboard Agence
const pageAgence = await browser.newPage();
await pageAgence.goto('https://www.bolamu.co/agence/dashboard.html');

const loginAgent = await pageAgence.evaluate(async () => {
  const r = await fetch('/api/v1/agence/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ phone: '+242069735418', password: 'TestNouveau2026!' })
  });
  return r.json();
});
console.assert(loginAgent.success, 'Login agent failed');

// Import 3 employés test
const importRes = await pageAgence.evaluate(async (token) => {
  const r = await fetch('/api/v1/agence/import-employes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      company_id: 'COMPANY_TEST_001',
      employes: [
        { phone: '+24206EMP0001', full_name: 'Employé Test Un', plan: 'essentiel' },
        { phone: '+24206EMP0002', full_name: 'Employé Test Deux', plan: 'standard' },
        { phone: '+24206EMP0003', full_name: 'Employé Test Trois', plan: 'essentiel' }
      ]
    })
  });
  return r.json();
}, loginAgent.data.access_token);
console.assert(importRes.success, 'Import failed: ' + JSON.stringify(importRes));
console.log('Employés importés:', importRes.data?.created_count);

// Vérif DB
// SELECT COUNT(*) FROM company_employees WHERE company_id = 'COMPANY_TEST_001'
// SELECT u.phone, s.status, s.plan FROM users u JOIN subscriptions s ON s.patient_phone = u.phone WHERE u.phone IN ('+24206EMP0001',...)
```

**Statut :** ⏳ À tester

---

## SCENARIO S22 — Prestataire enregistre un acte hors-catalogue SmartFlow

**Acteurs :** Prestataire (médecin/pharmacie/labo), Patient
**Déclencheur :** Patient bénéficiaire consomme un soin non listé dans le catalogue SSP
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Prestataire → Vérifie médicament dans SSP → `GET /api/v1/smartflow/medicaments/check?nom=Ciprofloxacine` → `{type: 'hors_catalogue'}`
2. Prestataire → `POST /api/v1/smartflow/hors-catalogue` — body: `{patient_phone, medicament, montant, type_acte}` → INSERT `hors_catalogue_transactions`
3. Prestataire → Vérifie ses stats → `GET /api/v1/smartflow/stats/moi?mois=2026-07` → récapitulatif mensuel
4. DB: `hors_catalogue_transactions` INSERT avec `status='pending_validation'`

**APIs touchées :**
- `GET /api/v1/smartflow/medicaments/check`
- `POST /api/v1/smartflow/hors-catalogue`
- `GET /api/v1/smartflow/stats/moi`

**WhatsApp attendus :** aucun
**Tables DB à vérifier :** `hors_catalogue_transactions`, `ssp_catalog`

**Script Playwright :**
```javascript
// Dashboard prestataire
const pagePrest = await browser.newPage();

const loginPrest = await pagePrest.evaluate(async () => {
  const r = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ phone: '+24200MEDECIN1', password: 'MedPass2026!' })
  });
  return r.json();
});

// Vérifier si médicament SSP ou hors-catalogue
const checkMed = await pagePrest.evaluate(async (token) => {
  const r = await fetch('/api/v1/smartflow/medicaments/check?nom=Ciprofloxacine', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginPrest.data.access_token);
console.log('Type médicament:', checkMed.data?.type);

// Enregistrer acte hors-catalogue
const horsRes = await pagePrest.evaluate(async (token) => {
  const r = await fetch('/api/v1/smartflow/hors-catalogue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      patient_phone: '+242069735418',
      medicament: 'Ciprofloxacine 500mg',
      montant: 8500,
      type_acte: 'pharmacie'
    })
  });
  return r.json();
}, loginPrest.data.access_token);
console.assert(horsRes.success, 'Hors-catalogue failed: ' + JSON.stringify(horsRes));

// Stats prestataire
const statsRes = await pagePrest.evaluate(async (token) => {
  const r = await fetch('/api/v1/smartflow/stats/moi?mois=2026-07', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginPrest.data.access_token);
console.log('Stats ce mois:', JSON.stringify(statsRes.data));
```

**Statut :** ⏳ À tester

---

## SCENARIO S23 — RH valide les retenues SmartFlow du mois

**Acteurs :** RH (entreprise), Admin Bolamu
**Déclencheur :** Fin de mois — RH doit valider les remboursements employés et retenues sur salaire
**À développer :** MoMo B2B (virement sortant vers entreprise) — actuellement validation manuelle uniquement

**Étapes :**
1. RH → `GET /api/v1/smartflow/rh/dashboard` → synthèse: employés actifs, actes du mois, totaux
2. RH → `GET /api/v1/smartflow/rh/retenues/provisoire?mois=2026-07` → liste retenues à approuver
3. RH → `POST /api/v1/smartflow/rh/retenues/valider` — body: `{mois: '2026-07', employe_ids: [...]}` → INSERT `retenues_validees`
4. RH → `GET /api/v1/smartflow/rh/rapport/:mois` → rapport depuis `smartflow_reports`
5. RH → `GET /api/v1/smartflow/rh/export/:mois` → téléchargement CSV
6. Admin → `GET /api/v1/admin/smartflow/stats?mois=2026-07` → vue macro

**APIs touchées :**
- `GET /api/v1/smartflow/rh/dashboard`
- `GET /api/v1/smartflow/rh/retenues/provisoire`
- `POST /api/v1/smartflow/rh/retenues/valider`
- `GET /api/v1/smartflow/rh/rapport/:mois`
- `GET /api/v1/smartflow/rh/export/:mois`

**WhatsApp attendus :** aucun
**Tables DB à vérifier :** `company_employees`, `hors_catalogue_transactions`, `retenues_validees`, `smartflow_reports`

**Script Playwright :**
```javascript
// Dashboard RH
const pageRH = await browser.newPage();
await pageRH.goto('https://www.bolamu.co/rh/dashboard.html');

const loginRH = await pageRH.evaluate(async () => {
  const r = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ phone: '+24200RHUSER1', password: 'RHPass2026!' })
  });
  return r.json();
});

// Dashboard RH
const dashRH = await pageRH.evaluate(async (token) => {
  const r = await fetch('/api/v1/smartflow/rh/dashboard', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginRH.data.access_token);
console.log('Dashboard RH:', JSON.stringify(dashRH.data));

// Retenues provisoires
const retenues = await pageRH.evaluate(async (token) => {
  const r = await fetch('/api/v1/smartflow/rh/retenues/provisoire?mois=2026-07', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginRH.data.access_token);
console.log('Retenues provisoires:', retenues.data?.length, 'employés');

// Valider retenues
if (retenues.data?.length > 0) {
  const employe_ids = retenues.data.map(r => r.employe_id);
  const validerRes = await pageRH.evaluate(async (ids, token) => {
    const r = await fetch('/api/v1/smartflow/rh/retenues/valider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ mois: '2026-07', employe_ids: ids })
    });
    return r.json();
  }, employe_ids, loginRH.data.access_token);
  console.assert(validerRes.success, 'Validation retenues failed');
}

// Export CSV
const exportUrl = `/api/v1/smartflow/rh/export/2026-07`;
console.log('Export CSV URL:', exportUrl);
```

**Statut :** ⏳ À tester

---

## SCENARIO S24 — Patient pré-remplit ses symptômes avant RDV

**Acteurs :** Patient
**Déclencheur :** Patient a un RDV confirmé et veut préparer sa consultation en ligne
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Patient → `GET /api/v1/appointments/patient/:phone` (auth) → liste ses RDV avec `session_code`
2. Patient → Sélectionne RDV → `POST /api/v1/appointments/:id/symptoms` — body: `{motif, symptomes:[], duree_symptomes, intensite, traitements_en_cours, remarques_patient}` → UPSERT `appointment_symptoms`
3. Médecin → Voit symptômes dans sa liste → `GET /api/v1/appointments/doctor/:phone` → retourne `symptomes_motif`, `symptomes_liste`, etc.
4. DB: `appointment_symptoms` INSERT ou UPDATE ON CONFLICT appointment_id

**APIs touchées :**
- `GET /api/v1/appointments/patient/:phone`
- `POST /api/v1/appointments/:id/symptoms`

**WhatsApp attendus :** aucun
**Tables DB à vérifier :** `appointments`, `appointment_symptoms`

**Script Playwright :**
```javascript
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/patient/dashboard.html');
await page.waitForTimeout(3000);

const ok = await page.evaluate(() => !!window.__bolamu_test);
if (!ok) throw new Error('Protocole absent');

// Récupérer RDV du patient
const rdvs = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/appointments/patient/+242069735418', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, localStorage.getItem('bolamu_token'));
const prochainRdv = rdvs.appointments?.find(r => r.status === 'confirme');
if (!prochainRdv) throw new Error('Aucun RDV confirmé pour test symptômes');

// Soumettre symptômes
const symptomsRes = await page.evaluate(async (rdvId, token) => {
  const r = await fetch(`/api/v1/appointments/${rdvId}/symptoms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      motif: 'Douleurs abdominales',
      symptomes: ['Nausées', 'Fièvre légère'],
      duree_symptomes: '3 jours',
      intensite: '6',
      traitements_en_cours: 'Paracétamol 500mg',
      remarques_patient: 'Douleurs surtout après repas'
    })
  });
  return r.json();
}, prochainRdv.id, localStorage.getItem('bolamu_token'));
console.assert(symptomsRes.success, 'Symptômes non enregistrés: ' + JSON.stringify(symptomsRes));

// Vérif DB
// SELECT motif, symptomes FROM appointment_symptoms WHERE appointment_id = prochainRdv.id
```

**Statut :** ⏳ À tester

---

## SCENARIO S25 — Patient récupère ses notifications

**Acteurs :** Patient
**Déclencheur :** Patient reçoit des notifications in-app (RDV, Zora, événements…)
**À développer :** Rien — déjà implémenté

**Étapes :**
1. Patient → `GET /api/v1/notifications/unread-count` (auth) → badge rouge nombre non lus
2. Patient → `GET /api/v1/notifications` (auth) → page 1, 20 entrées, colonnes `{id, type, titre, message, data, canal, is_read, sent_at, read_at, created_at}`
3. Patient → Clique notification → `PATCH /api/v1/notifications/:id/read` (auth) → `is_read=true`, `read_at=NOW()`
4. Patient → Marque tout lu → `PATCH /api/v1/notifications/read-all` (auth)
5. DB: `notifications.is_read=true` pour toutes les notifications du patient

**APIs touchées :**
- `GET /api/v1/notifications/unread-count`
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read-all`

**WhatsApp attendus :** aucun
**Tables DB à vérifier :** `notifications`

**Script Playwright :**
```javascript
const page = await browser.newPage();
await page.goto('https://www.bolamu.co/patient/dashboard.html');
await page.waitForTimeout(3000);

const ok = await page.evaluate(() => !!window.__bolamu_test);
if (!ok) throw new Error('Protocole absent');

// Badge non lus
const unreadCount = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/notifications/unread-count', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, localStorage.getItem('bolamu_token'));
console.log('Non lus:', unreadCount.data?.count);

// Liste notifications
const notifs = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/notifications', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, localStorage.getItem('bolamu_token'));
console.log('Notifications:', notifs.data?.length);

// Marquer première comme lue
if (notifs.data?.length > 0) {
  const readRes = await page.evaluate(async (notifId, token) => {
    const r = await fetch(`/api/v1/notifications/${notifId}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    return r.json();
  }, notifs.data[0].id, localStorage.getItem('bolamu_token'));
  console.assert(readRes.success, 'Marque lu failed');
}

// Tout marquer lu
const readAllRes = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/notifications/read-all', {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, localStorage.getItem('bolamu_token'));
console.assert(readAllRes.success, 'Read-all failed');

// Vérif: badge = 0
const unreadAfter = await page.evaluate(async (token) => {
  const r = await fetch('/api/v1/notifications/unread-count', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, localStorage.getItem('bolamu_token'));
console.assert(unreadAfter.data?.count === 0, 'Badge non réinitialisé');
```

**Statut :** ⏳ À tester

---

## SCENARIO S26 — Animateur gère ses clubs et notifie les membres

**Acteurs :** Animateur, Membres du club
**Déclencheur :** Animateur veut annoncer une activité à son club
**À développer :** Table `animateur_remuneration` (calcul rémunération animateur non implémenté)

**Étapes :**
1. Animateur → `POST /api/v1/animateur/login` → JWT
2. Animateur → `GET /api/v1/animateur/clubs` → ses clubs + stats membres
3. Animateur → `GET /api/v1/animateur/stats` → `getStats()` → événements créés, check-ins, membres
4. Animateur → Notifie son club → `POST /api/v1/animateur/clubs/:id/notify` — body: `{message}` → notify membres
5. Backend → `sendWhatsAppTemplate(membre_phone, 'bolamu_club_activite', [...])` pour chaque membre
6. Animateur → Voit inscriptions événement → `GET /api/v1/animateur/events/:id/registrations`
7. Animateur → Voit check-ins du jour → `GET /api/v1/animateur/checkins/today`

**APIs touchées :**
- `POST /api/v1/animateur/login`
- `GET /api/v1/animateur/clubs`
- `GET /api/v1/animateur/stats`
- `POST /api/v1/animateur/clubs/:id/notify`
- `GET /api/v1/animateur/events/:id/registrations`
- `GET /api/v1/animateur/checkins/today`

**WhatsApp attendus :** `bolamu_club_activite`
**Tables DB à vérifier :** `clubs`, `club_members`, `elonga_registrations`, `event_checkin_log`

**Script Playwright :**
```javascript
// Dashboard Animateur
const pageAnim = await browser.newPage();
await pageAnim.goto('https://www.bolamu.co/animateur/dashboard.html');

const loginAnim = await pageAnim.evaluate(async () => {
  const r = await fetch('/api/v1/animateur/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ phone: '+24200ANIMAT01', password: 'AnimPass2026!' })
  });
  return r.json();
});
console.assert(loginAnim.success, 'Login animateur failed');

// Stats
const stats = await pageAnim.evaluate(async (token) => {
  const r = await fetch('/api/v1/animateur/stats', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginAnim.data.access_token);
console.log('Stats animateur:', JSON.stringify(stats.data));

// Mes clubs
const clubs = await pageAnim.evaluate(async (token) => {
  const r = await fetch('/api/v1/animateur/clubs', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginAnim.data.access_token);
const monClub = clubs.data?.[0];
if (monClub) {
  // Notifier le club
  const notifRes = await pageAnim.evaluate(async (clubId, token) => {
    const r = await fetch(`/api/v1/animateur/clubs/${clubId}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ message: 'Activité sportive samedi matin 7h au stade !' })
    });
    return r.json();
  }, monClub.id, loginAnim.data.access_token);
  console.log('Notification club envoyée:', JSON.stringify(notifRes));
}

// Check-ins du jour
const checkinsToday = await pageAnim.evaluate(async (token) => {
  const r = await fetch('/api/v1/animateur/checkins/today', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginAnim.data.access_token);
console.log('Check-ins aujourd\'hui:', checkinsToday.data?.length);
```

**Statut :** ⏳ À tester

---

## SCENARIO S27 — Admin supervise la plateforme

**Acteurs :** Admin Bolamu
**Déclencheur :** Admin effectue sa revue quotidienne de la plateforme
**À développer :** ROI global automatique (calcul automatisé cross-entités non implémenté)

**Étapes :**
1. Admin → `POST /api/v1/auth/admin-login` — body: `{phone, password}` → bcrypt → INSERT `audit_log` → JWT 12h
2. Admin → Vérifie événements en attente → `GET /api/v1/events/admin/events/pending` (requireAdmin) → liste `status='pending_validation'`
3. Admin → Publie ou refuse un événement → `PATCH /api/v1/events/:id/publish` (requireAdmin)
4. Admin → Consulte transactions tiers-payant → `GET /api/v1/tiers-payant/admin` (auth, admin)
5. Admin → Réconcilie une transaction → `PATCH /api/v1/tiers-payant/admin/:id/reconcilier` (auth, admin)
6. Admin → Voit stats SmartFlow → `GET /api/v1/admin/smartflow/stats?mois=2026-07`
7. Admin → Crédit Zora manuel → `POST /api/v1/zora/earn` (admin only) — body: `{phone, points, reason}`
8. Admin → Cherche un patient → `GET /api/v1/patients/search?q=PHONE`

**APIs touchées :**
- `POST /api/v1/auth/admin-login`
- `GET /api/v1/events/admin/events/pending`
- `PATCH /api/v1/events/:id/publish`
- `GET /api/v1/tiers-payant/admin`
- `PATCH /api/v1/tiers-payant/admin/:id/reconcilier`
- `GET /api/v1/admin/smartflow/stats`
- `POST /api/v1/zora/earn`
- `GET /api/v1/patients/search`

**WhatsApp attendus :** `bolamu_animateur_event_valide` (si validation événement), `bolamu_animateur_event_refuse` (si refus)
**Tables DB à vérifier :** `audit_log`, `elonga_events`, `tiers_payant_transactions`, `zora_ledger`

**Script Playwright :**
```javascript
// Dashboard Admin
const pageAdmin = await browser.newPage();
await pageAdmin.goto('https://www.bolamu.co/admin/dashboard.html');

const loginAdmin = await pageAdmin.evaluate(async () => {
  const r = await fetch('/api/v1/auth/admin-login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ phone: '+242ADMIN001', password: 'AdminPass2026!' })
  });
  return r.json();
});
console.assert(loginAdmin.success, 'Admin login failed');

// Événements en attente
const pendingEvents = await pageAdmin.evaluate(async (token) => {
  const r = await fetch('/api/v1/events/admin/events/pending', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginAdmin.data.access_token);
console.log('Événements en attente:', pendingEvents.data?.length);

// Publier premier événement en attente (si existe)
if (pendingEvents.data?.length > 0) {
  const publishRes = await pageAdmin.evaluate(async (eventId, token) => {
    const r = await fetch(`/api/v1/events/${eventId}/publish`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    return r.json();
  }, pendingEvents.data[0].id, loginAdmin.data.access_token);
  console.log('Événement publié:', JSON.stringify(publishRes));
}

// Stats SmartFlow
const sfStats = await pageAdmin.evaluate(async (token) => {
  const r = await fetch('/api/v1/admin/smartflow/stats?mois=2026-07', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginAdmin.data.access_token);
console.log('SmartFlow stats:', JSON.stringify(sfStats.data));

// Crédit Zora manuel test
const zoraEarnRes = await pageAdmin.evaluate(async (token) => {
  const r = await fetch('/api/v1/zora/earn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      phone: '+242069735418',
      points: 100,
      reason: 'Crédit manuel test admin Playwright'
    })
  });
  return r.json();
}, loginAdmin.data.access_token);
console.assert(zoraEarnRes.success, 'Zora earn manual failed');

// Recherche patient
const searchRes = await pageAdmin.evaluate(async (token) => {
  const r = await fetch('/api/v1/patients/search?q=+242069735418', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return r.json();
}, loginAdmin.data.access_token);
console.log('Patient trouvé:', searchRes.data?.[0]?.full_name);

// Vérif DB : audit_log contient login admin
// SELECT event_type, actor_phone, created_at FROM audit_log WHERE actor_phone = '+242ADMIN001' ORDER BY created_at DESC LIMIT 5
```

**Statut :** ⏳ À tester

---

*Fin des 27 scénarios — SCENARIOS_VIE_BOLAMU.md v1.0 — 28 juin 2026*
