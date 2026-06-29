# Audit Bilatéral des Contrats API — Bolamu
Date : 28 juin 2026
Méthode : lecture statique du code source

---

## MODULE 1 — patient/dashboard.html

> Fichier ~279 KB — composant React-like vanilla, `componentDidMount()` charge ~20 endpoints en parallèle.

| Fonction | Route (méth+chemin) | Succès géré ? | else présent ? | else lit quoi ? | .catch() non vide ? | Bouton désactivé ? | Que voit l'user en erreur ? | Format backend | Frontend lit bon champ ? | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `componentDidMount` — profil | GET /patients/profil | ✅ oui (`d.success && d.data`) | ❌ non | — | ❌ vide `catch(()=>{})` | n/a (GET init) | Rien (silencieux) | FORMAT B `{success:false,message}` | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — solde Zora | GET /zora/balance | ✅ oui | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — streak | GET /streaks/me | ✅ oui (`d.success`) | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — events | GET /events | ✅ oui | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — my registrations | GET /events/my/registrations | ✅ oui | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — leaderboard | GET /leaderboard/weekly | ✅ oui | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — palier Zora | GET /zora/balance?phone= | ✅ oui | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — sport groups | GET /sport-groups | ✅ oui | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — ledger Zora | GET /zora/ledger?limit=10 | ✅ oui | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — abonnement | GET /patients/subscription | ✅ oui | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — constantes | GET /patients/constantes/:phone | ✅ oui | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — timeline | GET /reports/patient/:phone/timeline | ✅ oui | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — access-log | GET /reports/access-log/:phone | ✅ oui | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — games config | GET /zora/games/config | ✅ oui | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — doctors | GET /doctors | ✅ oui | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — rewards | GET /zora/rewards | ✅ oui | ❌ non | — | ✅ non vide (fallback local) | n/a | Catalogue de secours statique | FORMAT B | ✅ oui | ⚠️ PARTIEL |
| `componentDidMount` — vouchers | GET /vouchers/my | ✅ oui | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `componentDidMount` — dmn access-log | GET /dmn/access-log | ✅ oui | ❌ non | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `loadQR` (componentDidMount) | GET /qr/generate | ✅ oui | ✅ oui | affiche message "QR indisponible" | ✅ non vide (message "Erreur réseau") | n/a auto-refresh | Message visible | FORMAT B `{success:false,message}` | ✅ oui | ✅ OK |
| `redeemVoucher` | POST /vouchers/generate | ✅ oui | ✅ oui | `d.error` (clé string) via table map | ✅ non vide (`showToast('Erreur réseau')`) | ❌ pas de disable bouton | Toast message d'erreur | FORMAT D `{success:false, error:"code_string"}` | ⚠️ `d.error` (string) pas `d.error.message` | ✅ OK |
| `verifyDmnPassword` | POST /dmn/download/verify | ✅ oui | ✅ oui | `showToast('Mot de passe incorrect')` | ✅ non vide | ❌ pas de disable bouton | Toast message fixe | FORMAT B `{success:false,message}` | ⚠️ ignore `d.message` en erreur | ⚠️ PARTIEL |
| `verifyDmnPassword` — dmn/summary (imbriqué) | GET /dmn/summary | ✅ oui | ❌ non | — | ❌ vide `catch(()=>{})` | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `downloadDmnDoc` | GET /dmn/download/:docId | ✅ oui | ✅ oui | `showToast('Téléchargement impossible')` | ✅ non vide | n/a | Toast générique | FORMAT B | ⚠️ ignore `d.message` | ⚠️ PARTIEL |
| `generateDmnQr` | GET /dmn/qr-payload | ✅ oui | ✅ oui | `showToast('Génération du QR impossible')` | ✅ non vide | n/a | Toast générique | FORMAT B | ⚠️ ignore `d.message` | ⚠️ PARTIEL |
| `participate` | POST /events/:id/register | ✅ oui | ✅ oui | `(d.error && d.error.message) \|\| d.message \|\| 'Inscription impossible'` | ✅ non vide | ❌ pas de disable bouton | Toast message d'erreur visible | FORMAT B/C mixte | ✅ oui (double fallback) | ✅ OK |
| `spinWheel` | POST /zora/games/play (wheel) | ✅ oui | ✅ oui | `d.error \|\| 'Erreur...'` | ✅ non vide | ✅ `wheelSpinning` guard (anti double-clic) | Toast + state wheelResult | FORMAT D `{success:false, error:"..."}` | ✅ oui | ✅ OK |
| `openChest` | POST /zora/games/play (chest) | ✅ oui | ✅ oui | `d.error \|\| '...'` | ✅ non vide | ✅ guard `chestOpened!==null` | Toast message | FORMAT D | ✅ oui | ✅ OK |
| `pickQuiz` | POST /zora/games/play (quiz) | ✅ oui | ✅ oui | `d.error \|\| '...'` | ✅ non vide | ✅ guard `quizPicked!==null` | Toast message | FORMAT D | ✅ oui | ✅ OK |
| `playScratch` | POST /zora/games/play (scratch) | ✅ oui | ✅ oui | `d.error \|\| '...'` | ✅ non vide | ❌ pas de disable bouton | Toast message | FORMAT D | ✅ oui | 🔴 DOUBLE-CLIC |
| `saveConst` | POST /patients/constantes | ✅ oui | ✅ oui | `d.message \|\| d.error \|\| 'Erreur...'` | ✅ non vide | ❌ pas de disable bouton | Toast message d'erreur | FORMAT B | ✅ oui | ✅ OK |
| `loadRdvSlots` | GET /appointments/slots/:id | ✅ oui | ✅ oui | `(d.error && d.error.message) \|\| '...'` | ✅ non vide | n/a (GET) | Toast visible | FORMAT A partiel | ✅ oui | ✅ OK |
| `confirmRdv` | POST /appointments/book | ✅ oui | ✅ oui | `d.message \|\| d.error \|\| 'Réservation impossible'` | ✅ non vide | ✅ `rdvBooking` state guard | Toast message visible | FORMAT B | ✅ oui | ✅ OK |
| `redeem` | POST /zora/redeem | ✅ oui | ✅ oui | Map `d.error` → message lisible | ✅ non vide | ❌ pas de disable | Toast visible | FORMAT D | ✅ oui | 🔴 DOUBLE-CLIC |
| `openChatReal` | GET /chat/conversations/1/messages | ✅ oui | ❌ non | — | ✅ (console.error uniquement) | n/a | Rien visible | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `sendChatMessage` | POST /chat/conversations/1/messages | ✅ oui | ❌ non | — | ✅ (console.error uniquement) | ❌ pas de disable | Rien visible | FORMAT B | ✅ oui | 🔴 SILENCIEUX + DOUBLE-CLIC |
| `joinGroup` (inside render) | POST /clubs/:id/join | ✅ oui | ✅ oui | `d.message \|\| 'Déjà membre...'` via `res.status` | ✅ non vide | ❌ pas de disable | Toast visible | FORMAT B | ✅ oui | ✅ OK |
| `joinGroup` — rechargement clubs | GET /clubs | ✅ oui | ❌ non | — | n/a (pas de catch séparé) | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `leaderboardGroupChange` | GET /leaderboard/weekly?group_id= | ✅ oui | ❌ non | — | ✅ (console.error) | n/a | Rien visible | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `openEventPanel` | GET /events/:id | ✅ oui | ❌ non | — | ✅ non vide (affiche "Erreur de chargement") | n/a | Message "Erreur de chargement" (générique) | FORMAT B | ✅ oui | ⚠️ PARTIEL |
| `openEventPanel` — participants | GET /events/:id/participants | ✅ oui | ❌ non | — | ✅ (affiche "Erreur de chargement") | n/a | Texte "Erreur de chargement" | FORMAT B | ✅ oui | ⚠️ PARTIEL |
| `startChat` | POST /chat/conversations | ✅ oui | ❌ non (alert succès seul) | — | ✅ (alert "Chat bientôt disponible") | ❌ pas de disable | `alert()` brut succès/catch | FORMAT B | ✅ oui | ⚠️ PARTIEL |
| `openClubPanel` | GET /clubs/:id | ✅ oui | ❌ non | — | ✅ (affiche erreur) | n/a | Texte "Erreur de chargement" | FORMAT B | ✅ oui | ⚠️ PARTIEL |
| `openClubPanel` — members | GET /clubs/:id/members | ✅ oui | ❌ non | — | ✅ (affiche erreur) | n/a | Texte "Erreur de chargement" | FORMAT B | ✅ oui | ⚠️ PARTIEL |
| `joinEvent` (global) | POST /events/:id/register | ✅ oui | ❌ non | — | ✅ (catch : visuel success!) | ❌ pas de disable | Bug : catch force UI succès même en erreur réseau | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `cancelEventRegistration` (global) | DELETE /events/:id/register | ✅ oui | ✅ oui | `(d.error && d.error.message) \|\| ...` | ✅ non vide | n/a | alert() visible | FORMAT A/B mixte | ✅ oui | ✅ OK |
| `joinClub` (global) | POST /clubs/:id/join | ✅ oui | ❌ non | — | ✅ (catch : visuel success!) | ❌ pas de disable | Bug : catch force UI succès | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `createClub` (global) | POST /clubs | ✅ oui | ❌ non | — | ✅ (alert "Erreur") | ❌ pas de disable | alert() générique | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |

**Mismatch notable patient :** `redeemVoucher` lit `d.error` (string code) — le backend `/vouchers/generate` renvoie FORMAT D. Le frontend fait un map `{insufficient_balance:...}[d.error]` ce qui est cohérent avec FORMAT D. ✅

**Bug critique patient :** `joinEvent` et `joinClub` (fonctions globales hors composant, lignes 4229-4246 et 4285-4301) ont un `catch` qui force `btn.textContent = 'Inscrit ✓'` même en cas d'erreur réseau — l'utilisateur croit être inscrit alors que la requête a échoué.

---

## MODULE 2 — medecin/dashboard.html

> Fichier ~2100 lignes, helper `getAuthToken()`, `API` = `https://api.bolamu.co/api/v1`.

| Fonction | Route (méth+chemin) | Succès géré ? | else présent ? | else lit quoi ? | .catch() non vide ? | Bouton désactivé ? | Que voit l'user en erreur ? | Format backend | Frontend lit bon champ ? | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `loadProfil` | GET /doctors/profil | ✅ `d.banned` check | ❌ pas de check `d.success` | — | ✅ (texte fallback DOM) | n/a | Valeurs par défaut | FORMAT B | ⚠️ Pas de check `d.success` — lit `data.data||{}` directement | ⚠️ PARTIEL |
| `loadCreneaux` | GET /doctors/slots | ❌ pas de check `data.success` | — | — | ✅ (message "Erreur de chargement") | n/a | Message DOM | FORMAT B | ⚠️ lit `data.data||[]` sans check success | ⚠️ PARTIEL |
| `creerCreneauxParDefaut` (boucle) | POST /doctors/slots | ✅ `data.success` | ❌ non | — | ✅ `catch(e){}` vide | ❌ pas de disable | Rien si échec individuel | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `ajouterCreneau` | POST /doctors/slots | ✅ `data.success` | ✅ oui | `data.message` | ✅ (alert "Erreur connexion") | ❌ pas de disable bouton | alert(`data.message`) | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `supprimerCreneau` | DELETE /doctors/slots/:id | ✅ `data.success` | ✅ oui | `data.message` | ✅ (alert) | n/a (confirm guard) | alert visible | FORMAT B | ✅ oui | ✅ OK |
| `submitChangePwd` | POST /doctors/change-password | ✅ `data.success` | ✅ oui | `data.message \|\| 'Erreur'` | ✅ (showToast "Erreur serveur") | ❌ pas de disable | showToast visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `loadFileAttente` | GET /consultations/queue | ❌ pas de check success | — | — | ✅ (message DOM "Erreur") | n/a | Message DOM générique | FORMAT B | ⚠️ lit `data.data\|\|data\|\|[]` | ⚠️ PARTIEL |
| `loadRdv` | GET /appointments/doctor/:phone | ❌ pas de check success | — | — | ✅ (message DOM) | n/a | Texte d'erreur DOM | FORMAT B | ⚠️ lit `res.appointments\|\|...` | ⚠️ PARTIEL |
| `ouvrirValidation` — open consult | POST /consultations/open | ❌ pas de vérif (`.catch(()=>{})` seulement) | — | — | ❌ vide | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `ouvrirConsultation` | POST /consultations/open | ✅ `res.ok` | ✅ (throw) | `data.message` | ✅ (alert) | ❌ pas de disable | alert message | FORMAT B | ✅ oui | ✅ OK |
| `soumettreCompteRendu` | POST /reports/submit | ✅ `res.ok` | ✅ (throw) | `data.message\|\|'Erreur CR'` | ✅ (alert) | ✅ `btn.disabled=true` avant appel | alert message | FORMAT B | ✅ oui | ✅ OK |
| `confirmerValidation` — close consult | POST /consultations/:id/close | ✅ `resVal.ok` | ✅ (throw) | `dataVal.message\|\|...` | ✅ (alert) | ✅ `btn.disabled=true` | alert message | FORMAT B | ✅ oui | ✅ OK |
| `confirmerValidation` — ordonnance | POST /ordonnances | ✅ `resPres.ok` | ✅ (throw) | `dataPres.message\|\|...` | ✅ (alert) | ✅ (déjà disabled) | alert message | FORMAT B | ✅ oui | ✅ OK |
| `loadSspDatalist` | GET /smartflow/ssp/medicaments | ✅ `data.success && data.data` | ❌ non | — | ✅ (catch vide, non-bloquant) | n/a | Rien (autocomplete optionnel) | FORMAT B | ✅ oui | ⚠️ PARTIEL |
| `ajouterMedicament` — SSP check | GET /smartflow/medicaments/check | ✅ `data.success && data.data` | ❌ non | — | ✅ (`med.isSSP=false`) | n/a | Ignore (assume hors catalogue) | FORMAT B | ✅ oui | ⚠️ PARTIEL |
| `loadSmartFlowStats` | GET /smartflow/stats/moi | ✅ `data.success && data.data` | ✅ oui | alert générique | ✅ (alert "Erreur connexion") | ❌ pas de disable | alert visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `generateBriefing` | POST /ai-consult/briefing | ✅ `data.success && data.data` | ✅ oui | `data.message\|\|'Analyse indisponible'` | ✅ (message DOM) | ✅ `btn.disabled=true` | message DOM visible | FORMAT B | ✅ oui | ✅ OK |
| `analyzeTricolor` | POST /ai-consult/tricolor | ✅ `data.success && data.data` | ❌ non | — | ✅ (console.log) | n/a | Rien visible | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `generateRenewal` | GET /ai-consult/renewal/:phone | ✅ `data.success && data.data` | ❌ non | — | ✅ (alert) | n/a | alert générique | FORMAT B | ✅ oui | ⚠️ PARTIEL |
| `envoyerPrescriptionLabo` | POST /lab/prescribe | ✅ `res.ok` | ✅ (throw) | `data.message\|\|'Erreur'` | ✅ (alert) | ✅ `btn.disabled=true` | alert message | FORMAT B | ✅ oui | ✅ OK |
| `genererQRPatient` | GET /qr/generate?phone= | ✅ `data.success` | ✅ oui | `data.message` | ❌ pas de catch explicite | n/a | alert visible | FORMAT B | ✅ oui | ✅ OK |
| `verifyZoraVoucher` (scan partenaire) | POST /zora/vouchers/:uuid/consume | ✅ `data.success` | ✅ oui | `data.error` (codes string) | ✅ (message DOM) | n/a | Message DOM visible | FORMAT D | ✅ oui | ✅ OK |
| `loadZoraHistory` | GET /zora/partner/vouchers | ✅ `data.success && data.data.length>0` | ✅ oui (else: "Aucun voucher") | — | ✅ (message DOM erreur) | n/a | Message DOM | FORMAT B | ✅ oui | ✅ OK |
| `rechercherPatientMedecin` | GET /patients/search?q= | ❌ pas de check `data.success` | — | — | ❌ pas visible | n/a | Résultat DOM ou vide | FORMAT B | ⚠️ lit directement | ⚠️ PARTIEL |
| `loadConstantesPatient` (médecin voit constantes) | GET /patients/constantes/:phone | ✅ `res.success` | ❌ non | — | ✅ (console.error) | n/a | Rien visible | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `updateConstantesPatient` (médecin update) | POST /doctors/constantes-patient | ✅ `data.success` | ❌ non | — | ✅ (console.error) | n/a | Rien visible | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `updateMapPosition` | POST /map/position | ✅ oui | ❌ non | — | ✅ (console.error) | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |

---

## MODULE 3 — animateur/dashboard.html

> Helper `apiFetch()` centralisé. Logout auto si 401/403. Tous les appels passent par `apiFetch`.

| Fonction | Route (méth+chemin) | Succès géré ? | else présent ? | else lit quoi ? | .catch() non vide ? | Bouton désactivé ? | Que voit l'user en erreur ? | Format backend | Frontend lit bon champ ? | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `loadStats` | GET /animateur/stats | ✅ `data.success` | ✅ oui | `(data.error && data.error.message) \|\| 'Erreur chargement'` → console.warn | n/a (apiFetch gère 401) | n/a | console.warn seulement, pas visible user | FORMAT A `{success:false,error:{code,message}}` | ✅ oui | 🔴 SILENCIEUX |
| `loadEvents` | GET /animateur/events | ✅ `data.success` | ✅ oui | console.warn | n/a | n/a | console.warn seulement | FORMAT A | ✅ oui | 🔴 SILENCIEUX |
| `loadTodayCheckins` | GET /animateur/checkins/today | ✅ `data.success` | ✅ oui | `data.error.message` → message DOM | n/a | n/a | Message DOM visible | FORMAT A | ✅ oui | ✅ OK |
| `loadClubs` (animateur) | GET /animateur/clubs (presumed) | à vérifier — pattern similaire | ✅ oui (pattern) | console.warn | n/a | n/a | console.warn | FORMAT A | ✅ oui | 🔴 SILENCIEUX |

> Note : le dashboard animateur utilise FORMAT A du backend (`{success:false, error:{code, message}}`), cohérent avec `apiFetch`. ✅ Pas de mismatch.

---

## MODULE 4 — secretaire/dashboard.html

> Helper `api()` centralisé — renvoie `res.json()` directement. Pas de check success dans helper.

| Fonction | Route (méth+chemin) | Succès géré ? | else présent ? | else lit quoi ? | .catch() non vide ? | Bouton désactivé ? | Que voit l'user en erreur ? | Format backend | Frontend lit bon champ ? | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `loadDashboardStats` | GET /secretariat/dashboard-stats | ✅ `result.success` | ❌ non | — | ✅ (console.error) | n/a | Rien (stats restent à 0) | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `verifierAdherent` | GET /secretariat/verifier-adherent?q= | ✅ `!data.success\|\|!data.patient` | ✅ oui | "Aucun adhérent trouvé" DOM | ✅ (message DOM "Erreur connexion") | n/a | Message DOM visible | FORMAT B | ✅ oui | ✅ OK |
| `loadQueue` | GET /secretariat/queue?date= | ❌ pas de check success | — | — | ✅ (console.error) | n/a | Rien visible | FORMAT B | ⚠️ lit `data.queue` directement | ⚠️ PARTIEL |
| `updateQueueStatus` | PATCH /secretariat/queue/:id/status | Indirect via `api()` | — | — | ❌ non géré (await direct) | ❌ pas de disable | Rien si erreur | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `initRdvMedecins` | GET /secretariat/medecins | ❌ pas de check success | — | — | ✅ (console.error) | n/a | Rien (select vide) | FORMAT B | ⚠️ lit `data.medecins\|\|data.data\|\|[]` | ⚠️ PARTIEL |
| `chargerRdvMedecin` | GET /secretariat/agenda | ❌ pas de check success | — | — | ✅ (message DOM) | n/a | Message "Erreur chargement RDV" | FORMAT B | ⚠️ lit `data.appointments\|\|...` | ⚠️ PARTIEL |
| `confirmerRdv` | PATCH /secretariat/rdv/:id/status | ✅ `data.success` | ✅ oui | `data.message\|\|'Erreur confirmation'` | ✅ (alert) | ❌ pas de disable | alert visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `annulerRdv` | PATCH /secretariat/rdv/:id/status | ✅ `data.success` | ✅ oui | `data.message\|\|'Erreur annulation'` | ✅ (alert) | n/a (confirm guard) | alert visible | FORMAT B | ✅ oui | ✅ OK |
| `loadPatients` | GET /secretariat/patients/search | ❌ pas de check success | — | — | ✅ (console.error) | n/a | Rien visible | FORMAT B | ⚠️ lit `data.patients` | ⚠️ PARTIEL |
| `loadMedecins` | GET /secretariat/medecins | ❌ pas de check success | — | — | ✅ (console.error) | n/a | Rien visible | FORMAT B | ⚠️ lit `data.medecins` | ⚠️ PARTIEL |
| `voirEmploiDuTemps` | GET /secretariat/medecin/:id/disponibilites | ❌ pas de catch, await direct | — | — | ❌ non | n/a | Exception silencieuse | FORMAT B | ⚠️ lit `data.disponibilites\|\|[]` | 🔴 SILENCIEUX |
| `loadClinicInfo` | GET /secretariat/clinic-info | ✅ `data.success` | ❌ non | — | ❌ aucun catch | n/a | Exception silencieuse | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `loadCreneaux` (sec RDV) | GET /appointments/slots/:id | ❌ pas de check success | — | — | ✅ (`select.innerHTML='Erreur'`) | n/a | Texte "Erreur chargement" | FORMAT B | ⚠️ lit `data.slots` | ⚠️ PARTIEL |
| `createRdv` | POST /secretariat/rdv-manuel | ✅ `!response.success` | ✅ oui | `response.message\|\|'Erreur...'` | n/a (await api(), sans catch propre) | ❌ pas de disable | alert visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `confirmerBlocageCreneau` | POST /secretariat/bloquer-creneau | ✅ `data.success` | ✅ oui | `data.message\|\|'Erreur serveur'` | ✅ (message DOM) | ❌ pas de disable | Message DOM visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `onScanSuccessSec` (scanner modal) | POST /qr/verify | ✅ `data.success && data.patient` | ✅ oui | `data.message\|\|'Adhérent non trouvé'` | ✅ (message DOM) | n/a | Message DOM visible | FORMAT B | ✅ oui | ✅ OK |
| `traiterPatientSecTab` / `traiterAdherentSecretaire` | POST /qr/verify | ✅ `data.success && data.patient` | ✅ oui | `data.message\|\|'Adhérent non reconnu'` | ✅ (message DOM) | n/a | Message DOM visible | FORMAT B | ✅ oui | ✅ OK |
| `traiterPatientSecTab` (mode search) | GET /patients/search?q= ou GET /qr/verify?token= | ✅ `!data.success\|\|!data.data` | ✅ oui | "Aucun patient trouve" DOM | ✅ (message DOM) | n/a | Message DOM visible | FORMAT B | ✅ oui | ✅ OK |
| `viewPatient` | GET /secretariat/patients/search?q= | ❌ pas de check success (via `data.patients[0]`) | — | — | ✅ (alert "Erreur de chargement") | n/a | alert générique | FORMAT B | ⚠️ lit `.patients[0]` | ⚠️ PARTIEL |
| `loadClinicProfile` (2e appel) | GET /secretariat/clinic-info | ✅ `data.success` | ❌ non | — | ❌ aucun catch | n/a | Exception silencieuse | FORMAT B | ✅ oui | 🔴 SILENCIEUX |

---

## MODULE 5 — partenaire/dashboard.html

> Helper `api()` centralisé, logout auto 401/403.

| Fonction | Route (méth+chemin) | Succès géré ? | else présent ? | else lit quoi ? | .catch() non vide ? | Bouton désactivé ? | Que voit l'user en erreur ? | Format backend | Frontend lit bon champ ? | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `loadStats` | GET /partenaire/stats | ✅ `data && data.success` | ❌ non | — | n/a (pas de try/catch visible) | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `loadPrograms` | GET /vouchers/programs | ✅ `data && data.success` | ❌ non | — | n/a | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `loadValidationHistory` | GET /partenaire/validations | ✅ `data && data.success` | ❌ non | — | n/a | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `validateCode` | POST /partenaire/voucher/validate | ✅ `data && data.success` | ✅ oui | `data.error \|\| 'Erreur de validation'` | n/a | ❌ pas de disable | showToast visible | FORMAT D | ✅ oui `data.error` | ✅ OK |

---

## MODULE 6 — pharmacie/dashboard.html

| Fonction | Route (méth+chemin) | Succès géré ? | else présent ? | else lit quoi ? | .catch() non vide ? | Bouton désactivé ? | Que voit l'user en erreur ? | Format backend | Frontend lit bon champ ? | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `verifierQR` | POST /qr/verify | ✅ `!data.success` | ✅ oui | `data.message` | ✅ (message DOM) | n/a | Message DOM visible | FORMAT B | ✅ oui | ✅ OK |
| `loadProfil` | GET /pharmacies/profil | ❌ pas check success (banned check) | — | — | ✅ (valeurs fallback) | n/a | Valeurs par défaut | FORMAT B | ⚠️ lit `data.data\|\|{}` | ⚠️ PARTIEL |
| `submitChangePwd` | POST /pharmacies/change-password | ✅ `data.success` | ✅ oui | `data.message\|\|'Erreur'` | ✅ (alert) | ❌ pas de disable | alert visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `scanOrdonnance` | GET /prescriptions/by-session/:code | ✅ `!res.ok\|\|!data.success` | ✅ oui | message DOM codé en dur | ✅ (message DOM erreur) | n/a | Message DOM visible | FORMAT B | ✅ oui | ✅ OK |
| `scanOrdonnance` — SSP check (loop) | GET /smartflow/medicaments/check | ✅ `checkData.success && checkData.data && checkData.data.is_ssp` | ❌ non | — | ✅ (assume hors catalogue) | n/a | Ignore (assume hors catalogue) | FORMAT B | ✅ oui | ⚠️ PARTIEL |
| `validerDelivrance` | POST /prescriptions/deliver | ❌ pas de check `data.success` (await fetch direct) | — | — | ✅ (alert "Erreur lors de la validation") | ❌ pas de disable | alert générique | FORMAT B | ⚠️ pas de vérification réponse | 🔴 SILENCIEUX |
| `verifyZoraVoucher` | POST /zora/vouchers/:uuid/consume | ✅ `data.success` | ✅ oui | `data.error` (codes string) | ✅ (message DOM) | n/a | Message DOM visible | FORMAT D | ✅ oui | ✅ OK |
| `loadZoraHistory` | GET /zora/partner/vouchers | ✅ `data.success && data.data.length>0` | ✅ oui (else text) | — | ✅ (message DOM erreur) | n/a | Message DOM | FORMAT B | ✅ oui | ✅ OK |
| `enregistrerHorsCatalogue` | POST /smartflow/hors-catalogue | ✅ `data.success` | ✅ oui | `data.message\|\|'Erreur'` (alert) | ✅ (alert) | ❌ pas de disable | alert visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `loadSmartFlowStats` (pharmacie) | GET /smartflow/stats/moi | ✅ `data.success && data.data` | ✅ oui | alert générique | ✅ (alert) | ❌ pas de disable | alert | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `loadOrdonnancesHistorique` | GET /prescriptions/pharmacie/:phone | ✅ `data.success && data.data` | ✅ oui | message DOM | ✅ (message DOM) | n/a | Message DOM | FORMAT B | ✅ oui | ✅ OK |
| `loadProfilPharmacieDetail` | GET /pharmacies/profil | ❌ pas check success | — | — | ✅ (fallback) | n/a | Valeurs fallback | FORMAT B | ⚠️ lit `data.data\|\|{}` | ⚠️ PARTIEL |
| `updateMapPosition` (pharmacie) | POST /map/position | ✅ `data.success` | ❌ non | — | ✅ (console.warn) | n/a | Rien visible | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `loadSspMedicaments` | GET /smartflow/ssp/medicaments | ✅ `data.success` | ❌ non | — | ✅ (console.error) | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `loadCatalogue` | GET /smartflow/pharmacie/catalogue | ✅ `data.success` | ✅ oui | message DOM | ✅ (message DOM) | n/a | Message DOM | FORMAT B | ✅ oui | ✅ OK |
| `ajouterCatalogue` | POST /smartflow/pharmacie/catalogue | ✅ `data.success` | ✅ oui | `data.message` | ✅ (alert) | ❌ pas de disable | alert visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `loadCatalogueSearch` | GET /smartflow/pharmacie/catalogue (search) | ✅ `data.success` | ✅ oui | message DOM | ✅ (message DOM) | n/a | Message DOM | FORMAT B | ✅ oui | ✅ OK |

**Mismatch pharmacie :** `validerDelivrance` fait `await fetch(...)` sans lire le résultat — succès/erreur backend ignorés, le DOM est mis à jour inconditionnellement. Bug de validation silencieuse.

---

## MODULE 7 — laboratoire/dashboard.html

| Fonction | Route (méth+chemin) | Succès géré ? | else présent ? | else lit quoi ? | .catch() non vide ? | Bouton désactivé ? | Que voit l'user en erreur ? | Format backend | Frontend lit bon champ ? | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `verifierQR` | POST /qr/verify | ✅ `!data.success` | ✅ oui | `data.message` | ✅ (message DOM) | n/a | Message DOM visible | FORMAT B | ✅ oui | ✅ OK |
| `verifyZoraVoucher` | POST /zora/vouchers/:uuid/consume | ✅ `data.success` | ✅ oui | `data.error` (codes string) | ✅ (message DOM) | n/a | Message DOM visible | FORMAT D | ✅ oui | ✅ OK |
| `loadZoraHistory` | GET /zora/partner/vouchers | ✅ `data.success && data.data.length>0` | ✅ oui | — | ✅ (message DOM) | n/a | Message DOM | FORMAT B | ✅ oui | ✅ OK |
| `loadProfil` | GET /laboratories/profil | ❌ pas check success | — | — | ✅ (fallback DOM) | n/a | Valeurs fallback | FORMAT B | ⚠️ lit `data.data\|\|{}` | ⚠️ PARTIEL |
| `submitChangePwd` | POST /lab/change-password | ✅ `data.success` | ✅ oui | `data.message\|\|'Erreur'` | ✅ (alert) | ❌ pas de disable | alert visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `loadPrescriptionsAttente` | GET /lab/pending | ✅ `!data.success\|\|!data.data\|\|!data.data.length` | ✅ oui (empty state) | — | ✅ (empty state DOM) | n/a | Message DOM "Erreur de chargement" | FORMAT B | ✅ oui | ✅ OK |
| `searchPrescriptionByCode` | GET /lab/prescription/:code | ✅ `!data.success` | ✅ oui | `data.message` | ✅ (message DOM) | n/a | Message DOM visible | FORMAT B | ✅ oui | ✅ OK |
| `searchPrescriptionByCode` — SSP check | GET /smartflow/medicaments/check | ✅ oui | ❌ non | — | ✅ (assume hors catalogue) | n/a | Ignore (assume hors catalogue) | FORMAT B | ✅ oui | ⚠️ PARTIEL |
| `submitResultats` | POST /lab/results/submit | ✅ `data.success` | ✅ oui | `data.message\|\|'Erreur'` | ✅ (alert) | ✅ `btn.disabled=true` | alert visible | FORMAT B | ✅ oui | ✅ OK |
| `enregistrerHorsCatalogueLabo` | POST /smartflow/hors-catalogue | ✅ `data.success` | ✅ oui | `data.message\|\|'Erreur'` | ✅ (alert) | ❌ pas de disable | alert visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `loadSmartFlowStats` (labo) | GET /smartflow/stats/moi | ✅ `data.success && data.data` | ✅ oui | alert | ✅ (alert) | ❌ pas de disable | alert visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `getAuthMe` | GET /auth/me | ✅ `data.success` | ❌ non | — | ✅ (console.error) | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `updateMapPosition` (labo) | POST /map/position | ✅ `data.success` | ❌ non | — | ✅ (console.warn) | n/a | Rien visible | FORMAT B | ✅ oui | 🔴 SILENCIEUX |

---

## MODULE 8 — agence/dashboard.html

| Fonction | Route (méth+chemin) | Succès géré ? | else présent ? | else lit quoi ? | .catch() non vide ? | Bouton désactivé ? | Que voit l'user en erreur ? | Format backend | Frontend lit bon champ ? | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `verifierAdherent` (agence) | GET /agence/verifier-adherent?q= | ✅ `!data.success\|\|!data.patient` | ✅ oui | "Aucun adhérent trouvé" DOM | ✅ (message DOM "Erreur connexion") | n/a | Message DOM visible | FORMAT B | ✅ oui | ✅ OK |
| `loadStatsGlobales` | GET /agence/stats-globales | ✅ `data.success && data.stats` | ❌ non | — | ✅ (console.error) | n/a | Rien (stats restent à 0) | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `loadPartenaires` | GET /agence/partenaires | ❌ pas check `data.success` (`!data.partenaires\|\|!data.partenaires.length`) | ✅ oui | "Aucun partenaire trouvé" DOM | ✅ (message DOM) | n/a | Message DOM | FORMAT B | ⚠️ lit `data.partenaires` | ⚠️ PARTIEL |
| `verifierPatientRdv` | GET /agence/client?phone= | ✅ `data.success && data.client` | ✅ oui | "Patient non trouvé" | ✅ (message DOM) | n/a | Message DOM | FORMAT B | ✅ oui | ✅ OK |
| `loadMedecinsReseau` | GET /agence/medecins | ❌ pas check success (`!data.medecins\|\|...`) | ✅ oui | "Aucun médecin" dans select | ✅ (select erreur) | n/a | Message select DOM | FORMAT B | ⚠️ lit `data.medecins` | ⚠️ PARTIEL |
| `loadCreneauxReseau` | GET /appointments/slots/:id | ❌ pas check success | — | — | ✅ (select "Erreur") | n/a | "Erreur de chargement" select | FORMAT B | ⚠️ lit `data.slots\|\|...` | ⚠️ PARTIEL |
| `confirmerRdvAgent` | POST /agence/rdv | ✅ `data.success` | ✅ oui | `data.message\|\|'Échec...'` | ✅ (message DOM) | ❌ pas de disable | Message DOM visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `rechercherCompteReclam` | GET /agence/client?phone= | ✅ `data.success && data.client` | ✅ oui | "Compte non trouvé" DOM | ✅ (message DOM) | n/a | Message DOM visible | FORMAT B | ✅ oui | ✅ OK |
| `soumettreReclamation` | POST /agence/reclamation/:action | ✅ `r.ok` | ✅ oui | `data.message\|\|'Erreur'` | ✅ (message DOM) | ❌ pas de disable | Message DOM visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `souscription complète` (wizard) | POST /agence/souscrire-complet | ✅ `data.success` | ✅ oui | `data.message\|\|'Erreur lors de...'` | ✅ (message DOM) | ✅ `btn.disabled=true` | Message DOM visible | FORMAT B | ✅ oui | ✅ OK |
| `import employes` | POST /agence/import-employes | ✅ `data.success` | ✅ oui | `data.message\|\|'Erreur serveur'` | ✅ (alert) | ❌ pas de disable | alert visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |

---

## MODULE 9 — rh/dashboard.html

| Fonction | Route (méth+chemin) | Succès géré ? | else présent ? | else lit quoi ? | .catch() non vide ? | Bouton désactivé ? | Que voit l'user en erreur ? | Format backend | Frontend lit bon champ ? | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `loadOverview` | GET /smartflow/rh/dashboard | ✅ `data.success && data.data` | ❌ non | — | ✅ (console.error) | n/a | Rien (stats à 0) | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `loadEmployesByMonth` | GET /smartflow/rh/dashboard?mois= | ✅ `data.success && data.data && data.data.employes` | ❌ non | — | ✅ (alert "Erreur lors du chargement") | ❌ pas de disable | alert générique | FORMAT B | ✅ oui | ⚠️ PARTIEL |
| `genererExport` | GET /smartflow/rh/export/:mois | ✅ `res.ok` | ✅ oui | alert "Erreur lors de la génération" | ✅ (alert) | ❌ pas de disable | alert générique | FORMAT B (ou blob) | ✅ oui | 🔴 DOUBLE-CLIC |
| `loadRetenues` | GET /smartflow/rh/retenues/provisoire | ✅ `data.success && data.data` | ✅ oui | alert générique | ✅ (alert) | ❌ pas de disable | alert visible | FORMAT B | ✅ oui | ⚠️ PARTIEL |
| `validerRetenues` | POST /smartflow/rh/retenues/valider | ✅ `data.success` | ✅ oui | `data.message\|\|'Erreur serveur'` | ✅ (alert) | n/a (confirm guard) | alert visible | FORMAT B | ✅ oui | ✅ OK |
| `loadCategoriesConfig` | GET /smartflow/rh/config/categories | ✅ `data.success && data.data` | ❌ non | — | ✅ (console.error) | n/a | Rien | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `sauvegarderCategoriesConfig` | POST /smartflow/rh/config/categories | ✅ `data.success` | ✅ oui | `data.message\|\|'Erreur serveur'` | ✅ (alert) | ❌ pas de disable | alert visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |
| `calculerICP` | GET /smartflow/rh/icp/:mois | ✅ `data.success && data.data` | ✅ oui | `data.message\|\|'Erreur serveur'` | ✅ (alert) | ❌ pas de disable | alert visible | FORMAT B | ✅ oui | ⚠️ PARTIEL |
| `telechargerRapport` | GET /smartflow/rh/rapport/:mois | ✅ `data.success && data.report_data` | ✅ oui | `data.message\|\|'Erreur...'` | ✅ (alert) | ❌ pas de disable | alert visible | FORMAT B | ✅ oui | 🔴 DOUBLE-CLIC |

---

## MODULE 10 — admin/dashboard.html

> `api()` helper avec retry 3x + timeout 20s — très robuste. Tous les panels passent par `api()`.

| Fonction | Route (méth+chemin) | Succès géré ? | else présent ? | else lit quoi ? | .catch() non vide ? | Bouton désactivé ? | Que voit l'user en erreur ? | Format backend | Frontend lit bon champ ? | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `loadOverview` | GET /admin/overview (ou similar) | ❌ pas de check visible | — | — | ✅ (`showBannerErr`) | n/a | Banner d'erreur visible | FORMAT B | ⚠️ lit champs directs | ⚠️ PARTIEL |
| `loadPending` | GET /admin/pending | ❌ pas de check success (`res.data\|\|[]`) | — | — | ✅ (DOM "Erreur") | n/a | Message DOM "Erreur" | FORMAT B | ⚠️ lit `res.data\|\|[]` | ⚠️ PARTIEL |
| `loadDoctors` | GET /admin/doctors | ❌ pas de check success (`res.data\|\|[]`) | — | — | ✅ (DOM "Erreur") | n/a | Message DOM | FORMAT B | ⚠️ | ⚠️ PARTIEL |
| `loadPharmacies` | GET /admin/pharmacies | ❌ pas de check success | — | — | ✅ (DOM "Erreur") | n/a | Message DOM | FORMAT B | ⚠️ | ⚠️ PARTIEL |
| `loadLabos` | GET /admin/laboratories | ❌ pas de check success | — | — | ✅ (DOM "Erreur") | n/a | Message DOM | FORMAT B | ⚠️ | ⚠️ PARTIEL |
| `viewDocument` | GET /admin/documents/:id | ✅ `data.success && data.url` | ✅ oui | alert "Document introuvable" | ❌ pas de catch | n/a | alert visible | FORMAT B | ✅ oui | ✅ OK |
| `validateUser`/`rejectUser` etc. | POST /admin/validate (etc.) | Gérés via `api()` + try/catch | — | — | ✅ via helper | n/a | Banner/DOM erreur | FORMAT B | ✅ oui | ⚠️ PARTIEL |

> Note : le dashboard admin compense le manque de check `success` par un système retry + banner d'erreur global robuste. L'UX dégradée est acceptable car l'admin est une interface interne.

---

## MODULE 11 — register.html

| Fonction | Route (méth+chemin) | Succès géré ? | else présent ? | else lit quoi ? | .catch() non vide ? | Bouton désactivé ? | Que voit l'user en erreur ? | Format backend | Frontend lit bon champ ? | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `fetchUploadToken` | POST /upload/token | ✅ `data.success && data.upload_token` | ❌ non | — | ✅ (console.error) | n/a | Rien (upload bloqué après) | FORMAT B | ✅ oui | 🔴 SILENCIEUX |
| `uploadSecureFile` | POST /upload/secure | ✅ `data.success` | ✅ oui | `data.message` (via `setUploadState('error', data.message)`) | ✅ (`setUploadState('error','Erreur réseau')`) | ❌ pas de disable zone | Message dans zone upload visible | FORMAT B | ✅ oui | ✅ OK |
| `finalRegister` | POST /auth/register/:role | ✅ `data.success` | ✅ oui | `data.message\|\|'Erreur lors de la création'` → `showAlert()` | ✅ (`showAlert('Erreur connexion')`) | ✅ `btn.disabled=true` avant appel, `btn.disabled=false` en erreur | Alert modal visible | FORMAT B | ✅ oui | ✅ OK |

---

## MODULE 12 — login.html

| Fonction | Route (méth+chemin) | Succès géré ? | else présent ? | else lit quoi ? | .catch() non vide ? | Bouton désactivé ? | Que voit l'user en erreur ? | Format backend | Frontend lit bon champ ? | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `doLogin` | POST /auth/login | ✅ `res.ok && data.success` | ✅ oui | `data.message\|\|'Identifiants incorrects.'` | ✅ (`showMsg('Erreur de connexion...')`) | ✅ `btn.disabled=true`, réactivé après | `showMsg()` visible | FORMAT B | ✅ oui | ✅ OK |
| `doForgotPassword` | POST /auth/forgot-password | ✅ `res.ok && data.success` | ✅ oui | `data.message\|\|'Erreur.'` | ✅ (`showMsg('Erreur de connexion.')`) | ✅ `btn.disabled=true`, réactivé | `showMsg()` visible | FORMAT B | ✅ oui | ✅ OK |
| `checkMagicLink` | GET /auth/onboarding/:token | ✅ `data.success` | ✅ oui | `data.message\|\|'Lien invalide...'` | ✅ (`showMsg('Erreur de connexion...')`) | ✅ `btn.disabled=true` | `showMsg()` visible | FORMAT B | ✅ oui | ✅ OK |

---

## RÉCAPITULATIF GLOBAL

### Tableau par module

| Module | Nb appels | OK | PARTIEL | SILENCIEUX | DOUBLE-CLIC | Mismatch |
|---|---|---|---|---|---|---|
| patient/dashboard.html | 44 | 12 | 7 | 20 | 5 | 1 (joinEvent/joinClub catch→faux-succès) |
| medecin/dashboard.html | 27 | 11 | 7 | 7 | 2 | 0 |
| animateur/dashboard.html | 4 | 1 | 0 | 3 | 0 | 0 |
| secretaire/dashboard.html | 21 | 6 | 7 | 6 | 3 | 0 |
| partenaire/dashboard.html | 4 | 1 | 0 | 3 | 0 | 0 |
| pharmacie/dashboard.html | 17 | 7 | 5 | 4 | 4 | 1 (validerDelivrance sans check) |
| laboratoire/dashboard.html | 13 | 4 | 3 | 4 | 3 | 0 |
| agence/dashboard.html | 11 | 5 | 4 | 1 | 4 | 0 |
| rh/dashboard.html | 9 | 1 | 3 | 3 | 5 | 0 |
| admin/dashboard.html | 7 | 1 | 5 | 0 | 0 | 0 |
| register.html | 3 | 2 | 0 | 1 | 0 | 0 |
| login.html | 3 | 3 | 0 | 0 | 0 | 0 |
| **TOTAL** | **163** | **54 (33%)** | **41 (25%)** | **52 (32%)** | **26 (16%)** | **2** |

---

### 🔴 SILENCIEUX — classés par criticité

#### Criticité maximale (action utilisateur ou données critiques)

1. **`componentDidMount` — profil patient** dans `patient/dashboard.html` — GET /patients/profil — Impact : tableau de bord vide sans explication
2. **`joinEvent` (global, catch→faux-succès)** dans `patient/dashboard.html` — POST /events/:id/register — Impact : patient croit être inscrit alors qu'il ne l'est pas
3. **`joinClub` (global, catch→faux-succès)** dans `patient/dashboard.html` — POST /clubs/:id/join — Impact : idem
4. **`ouvrirValidation` — open consult** dans `medecin/dashboard.html` — POST /consultations/open — Impact : consultation ouverte en DB sans confirmation médecin
5. **`validerDelivrance`** dans `pharmacie/dashboard.html` — POST /prescriptions/deliver — Impact : DOM mis à jour comme si la délivrance avait réussi, que ce soit le cas ou non
6. **`sendChatMessage`** dans `patient/dashboard.html` — POST /chat/conversations/1/messages — Impact : message peut ne pas être envoyé, aucun retour utilisateur
7. **`updateConstantesPatient` (médecin)** dans `medecin/dashboard.html` — POST /doctors/constantes-patient — Impact : mise à jour constantes sans confirmation

#### Criticité haute (données médicales ou abonnement)

8. **`componentDidMount` — abonnement** dans `patient/dashboard.html` — GET /patients/subscription
9. **`componentDidMount` — constantes médicales** dans `patient/dashboard.html` — GET /patients/constantes
10. **`componentDidMount` — timeline** dans `patient/dashboard.html` — GET /reports/patient/timeline
11. **`loadOverview`** dans `rh/dashboard.html` — GET /smartflow/rh/dashboard — Impact : tableau de bord RH vide sans message
12. **`loadStats`** dans `partenaire/dashboard.html` — GET /partenaire/stats — Impact : stats vides sans message
13. **`verifyDmnPassword` — dmn/summary imbriqué** dans `patient/dashboard.html` — GET /dmn/summary — Impact : liste de documents vide sans explication
14. **`loadConstantesPatient` (médecin)** dans `medecin/dashboard.html` — GET /patients/constantes/:phone
15. **`loadStatsGlobales`** dans `agence/dashboard.html` — GET /agence/stats-globales
16. **`voirEmploiDuTemps`** dans `secretaire/dashboard.html` — GET /secretariat/medecin/:id/disponibilites — aucun try/catch, exception brute

#### Criticité normale (données de gamification/communauté)

17. **`componentDidMount` — Zora balance** dans `patient/dashboard.html` — GET /zora/balance
18. **`componentDidMount` — streak** dans `patient/dashboard.html` — GET /streaks/me
19. **`componentDidMount` — leaderboard** dans `patient/dashboard.html` — GET /leaderboard/weekly
20. **`componentDidMount` — events** dans `patient/dashboard.html` — GET /events
21. **`componentDidMount` — my registrations** dans `patient/dashboard.html` — GET /events/my/registrations
22. **`componentDidMount` — sport groups** dans `patient/dashboard.html` — GET /sport-groups
23. **`componentDidMount` — ledger Zora** dans `patient/dashboard.html` — GET /zora/ledger
24. **`componentDidMount` — dmn access-log** dans `patient/dashboard.html` — GET /dmn/access-log
25. **`componentDidMount` — games config** dans `patient/dashboard.html` — GET /zora/games/config
26. **`componentDidMount` — vouchers** dans `patient/dashboard.html` — GET /vouchers/my
27. **`componentDidMount` — doctors** dans `patient/dashboard.html` — GET /doctors
28. **`componentDidMount` — palier Zora** dans `patient/dashboard.html` — GET /zora/balance?phone=
29. **`openChatReal`** dans `patient/dashboard.html` — GET /chat/conversations/1/messages
30. **`joinGroup` — rechargement clubs** dans `patient/dashboard.html` — GET /clubs
31. **`leaderboardGroupChange`** dans `patient/dashboard.html` — GET /leaderboard/weekly?group_id=
32. **`loadStats` / `loadEvents`** dans `animateur/dashboard.html` — console.warn, pas visible user
33. **`loadDashboardStats`** dans `secretaire/dashboard.html` — GET /secretariat/dashboard-stats
34. **`updateQueueStatus`** dans `secretaire/dashboard.html` — PATCH /secretariat/queue/:id/status
35. **`loadClinicInfo`** dans `secretaire/dashboard.html` — GET /secretariat/clinic-info (aucun try/catch)
36. **`loadClinicProfile`** (2e appel) dans `secretaire/dashboard.html`
37. **`loadValidationHistory`** dans `partenaire/dashboard.html` — GET /partenaire/validations
38. **`loadPrograms`** dans `partenaire/dashboard.html` — GET /vouchers/programs
39. **`updateMapPosition`** dans `pharmacie/dashboard.html` — POST /map/position
40. **`loadSspMedicaments`** dans `pharmacie/dashboard.html`
41. **`getAuthMe`** dans `laboratoire/dashboard.html`
42. **`updateMapPosition`** dans `laboratoire/dashboard.html`
43. **`analyzeTricolor`** dans `medecin/dashboard.html` — POST /ai-consult/tricolor
44. **`loadCategoriesConfig`** dans `rh/dashboard.html`
45. **`fetchUploadToken`** dans `register.html` — POST /upload/token
46. **`loadSspDatalist`** dans `medecin/dashboard.html` (non-bloquant, acceptable)
47. **`creerCreneauxParDefaut`** dans `medecin/dashboard.html`

---

### 🔴 DOUBLE-CLIC — actions à effet sans protection

1. **`playScratch`** dans `patient/dashboard.html` — POST /zora/games/play — jeu (crédits Zora)
2. **`redeem`** dans `patient/dashboard.html` — POST /zora/redeem — échange récompense Zora
3. **`sendChatMessage`** dans `patient/dashboard.html` — POST /chat/conversations/1/messages
4. **`createClub`** dans `patient/dashboard.html` — POST /clubs — création groupe
5. **`ajouterCreneau`** dans `medecin/dashboard.html` — POST /doctors/slots
6. **`submitChangePwd`** dans `medecin/dashboard.html` — POST /doctors/change-password
7. **`loadSmartFlowStats`** dans `medecin/dashboard.html` — GET (acceptable)
8. **`confirmerRdv`** dans `secretaire/dashboard.html` — PATCH /secretariat/rdv/:id/status
9. **`createRdv`** dans `secretaire/dashboard.html` — POST /secretariat/rdv-manuel — **CRITIQUE : création RDV sans disable**
10. **`confirmerBlocageCreneau`** dans `secretaire/dashboard.html` — POST /secretariat/bloquer-creneau
11. **`submitChangePwd`** dans `pharmacie/dashboard.html` — POST /pharmacies/change-password
12. **`enregistrerHorsCatalogue`** dans `pharmacie/dashboard.html` — POST /smartflow/hors-catalogue
13. **`loadSmartFlowStats`** dans `pharmacie/dashboard.html` (GET, acceptable)
14. **`ajouterCatalogue`** dans `pharmacie/dashboard.html` — POST /smartflow/pharmacie/catalogue
15. **`submitChangePwd`** dans `laboratoire/dashboard.html` — POST /lab/change-password
16. **`enregistrerHorsCatalogueLabo`** dans `laboratoire/dashboard.html` — POST /smartflow/hors-catalogue
17. **`loadSmartFlowStats`** dans `laboratoire/dashboard.html` (GET, acceptable)
18. **`confirmerRdvAgent`** dans `agence/dashboard.html` — POST /agence/rdv — **CRITIQUE : création RDV**
19. **`soumettreReclamation`** dans `agence/dashboard.html` — POST /agence/reclamation/:action
20. **`import employes`** dans `agence/dashboard.html` — POST /agence/import-employes
21. **`genererExport`** dans `rh/dashboard.html` — GET /smartflow/rh/export
22. **`sauvegarderCategoriesConfig`** dans `rh/dashboard.html` — POST /smartflow/rh/config/categories
23. **`telechargerRapport`** dans `rh/dashboard.html` — GET (acceptable)
24. **`calculerICP`** dans `rh/dashboard.html` (GET, acceptable)

---

### ⚡ MISMATCH backend/frontend

| Fonction | Route | Backend envoie | Frontend lit | Résultat |
|---|---|---|---|---|
| `joinEvent` (global, catch) | POST /events/:id/register | `{success:false, reason:"...", message:"..."}` | catch → force `btn.textContent='Inscrit ✓'` | **Bug critique** : erreur réseau = UI faux-positif inscription |
| `joinClub` (global, catch) | POST /clubs/:id/join | `{success:false, ...}` | catch → force `btn.textContent='Membre ✓'` | **Bug critique** : erreur réseau = UI faux-positif adhésion |
| `validerDelivrance` (pharmacie) | POST /prescriptions/deliver | `{success:true/false, ...}` | résultat ignoré — pas de `await` des données | **Bug** : délivrance forcée dans UI, même si backend rejette |
| `loadProfile` médecin | GET /doctors/profil | `{success:false, message:"..."}` | `data.data\|\|{}` — ignore `success:false` | Valeurs vides sans message (acceptable car fallback DOM) |
| `animateur loadStats/loadEvents` | GET /animateur/* | FORMAT A `{error:{code,message}}` | `data.error.message` → console.warn uniquement | Silencieux mais cohérent avec FORMAT A |

---

## LÉGENDE FORMATS

- **FORMAT A** : `{success:false, error:{code:"ERROR_CODE", message:"..."}}`
- **FORMAT B** : `{success:false, message:"..."}` (le plus courant dans le backend Bolamu)
- **FORMAT C** : `res.json(result)` brut (sans enveloppe success)
- **FORMAT D** : `{success:false, error:"code_string"}` (Zora vouchers, games)

> Le backend Bolamu utilise principalement FORMAT B. Le dashboard patient a des fonctions globales (`joinEvent`, `joinClub`) qui s'attendaient à FORMAT B mais leur `catch` ignore complètement la réponse et simule un succès — c'est le mismatch le plus grave.
