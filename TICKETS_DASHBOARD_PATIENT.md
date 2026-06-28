# TICKETS TEST — DASHBOARD PATIENT BOLAMU
> Source de vérité pour les tests Playwright du dashboard patient.
> Toute Route API listée ici est vérifiée dans `src/routes/`.
> Toute fonction Playwright est vérifiée dans `window.__bolamu_test` (`public/patient/dashboard.html`).
> Version 1.0 — 28 juin 2026

---

## TICKET T01 — Navigation top nav
**Statut :** ⏳ À tester
**Route API :** (pas d'appel API — navigation client uniquement)
**Parcours utilisateur :**
1. Charger `/patient/dashboard.html`
2. Cliquer onglet **Gagner** dans la top nav
3. Cliquer onglet **Suivre**
4. Cliquer onglet **Récompenses**
5. Revenir sur **Accueil**
**UI attendue :** Indicateur bleu sous l'onglet actif, section correspondante visible, `getPanel()` reflète le bon état
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goGagner())
await page.waitForTimeout(3000)
await page.evaluate(() => window.__bolamu_test.goSuivre())
await page.waitForTimeout(3000)
await page.evaluate(() => window.__bolamu_test.goRecompenses())
await page.waitForTimeout(3000)
await page.evaluate(() => window.__bolamu_test.goAccueil())
await page.waitForTimeout(3000)
const panel = await page.evaluate(() => window.__bolamu_test.getPanel())
// panel === 'accueil'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T02 — Header solde/chat/avatar
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/zora/balance` (init)
**Parcours utilisateur :**
1. Charger le dashboard (connecté)
2. Observer le header : solde Zora affiché (`zoraTxt`)
3. Observer l'icône chat avec badge
4. Observer les initiales du patient (2 premières lettres du nom)
5. Vérifier que le solde est formaté avec séparateur espace (ex. `1 250`)
**UI attendue :** `zoraTxt` = balance formatée, initiales = 2 lettres uppercase, badge chat masqué par défaut
**Test Playwright :**
```js
const zora = await page.evaluate(() => window.__bolamu_test.getZora())
// zora !== undefined
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.toast === null
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T03 — Bottom nav mobile
**Statut :** ⏳ À tester
**Route API :** (pas d'appel API — navigation client uniquement)
**Parcours utilisateur :**
1. Charger le dashboard en viewport mobile (< 640px)
2. Observer la bottom nav (Accueil / Gagner / Suivre / Récompenses)
3. Tapper **Gagner**
4. Tapper **Récompenses**
5. Revenir **Accueil**
**UI attendue :** Icône et label colorés en `#003FB1` pour l'onglet actif, gris `#9498a8` pour les autres
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goGagner())
await page.waitForTimeout(3000)
const p1 = await page.evaluate(() => window.__bolamu_test.getPanel())
// p1 === 'gagner'
await page.evaluate(() => window.__bolamu_test.goAccueil())
await page.waitForTimeout(3000)
const p2 = await page.evaluate(() => window.__bolamu_test.getPanel())
// p2 === 'accueil'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T04 — Streak
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/streaks/me` (init)
**Parcours utilisateur :**
1. Charger le dashboard
2. Observer le bloc streak sur l'accueil
3. Lire le texte `streakTxt` : "N jour(s) d'affilée"
4. Observer les 7 cercles L/M/M/J/V/S/D — celui d'aujourd'hui est orange pulsant
5. Les jours passés dans la streak sont orange plein
**UI attendue :** `streakTxt` = "N jour(s) d'affilée" (N ≥ 0), cercle du jour actif avec animation `streakPulse`
**Test Playwright :**
```js
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.streakTxt est une string non vide
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T05 — Solde Zora + palier
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/zora/balance` (init)
**Parcours utilisateur :**
1. Charger le dashboard
2. Observer le solde Zora affiché en haut de l'accueil
3. Vérifier le formatage avec séparateur espace (ex. `1 250`)
4. Lire le palier actuel (`_zoraTier` : Kimia / Liboso / Nkembo / Elonga)
5. Lire `patientsToNext` : "À X pts du palier Y"
**UI attendue :** `zoraTxt` ≠ '—', `patientsToNext` avec palier suivant correct
**Test Playwright :**
```js
const zora = await page.evaluate(() => window.__bolamu_test.getZora())
// typeof zora === 'number' || zora !== undefined
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.zoraTxt !== '—'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T06 — Compteur pas du jour
**Statut :** ⏳ À tester
**Route API :** (pas de route API — suivi d'activité non connecté)
**Parcours utilisateur :**
1. Charger le dashboard — observer le ring circulaire des pas
2. `stepsTxt` affiche la valeur courante (défaut : 0)
3. Cliquer le bouton **Activité** (card Activité dans la section sport)
4. Observer le toast
5. Vérifier absence d'appel API
**UI attendue :** Toast `'Suivi d'activité bientôt disponible'`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.toastActivite())
await page.waitForTimeout(500)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.toast === "Suivi d'activité bientôt disponible"
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T07 — Carousel récompenses échangeables
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/zora/rewards` (init)
**Parcours utilisateur :**
1. Charger le dashboard (accueil)
2. Observer le carousel de récompenses échangeables
3. La card courante affiche nom + coût en Zora
4. Filtrer par catégorie → liste `affordable` filtrée
5. Points de pagination mis à jour
**UI attendue :** Card récompense visible avec coût, chips filtres fonctionnels, `rewardBandStyle.display !== 'none'` si rewards chargées
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.filterCatElec())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.filterCatSport())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.filterCatTout())
await page.waitForTimeout(500)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.filterCategorie === 'tout'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T08 — QR identification
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/qr/generate` (init — token d'identification pour check-in événement)
**Parcours utilisateur :**
1. Charger le dashboard
2. Token QR généré au chargement via `/api/v1/qr/generate`
3. `dossierQrText()` = `'BOLAMU:' + patientMembreId()` (bolamu_id du patient)
4. Le QR 66px est rendu dans la carte membre (tab Dossier)
5. Valeur encodée lisible par un lecteur QR Bolamu
**UI attendue :** QR rendu par QRCode.js, fond blanc, taille 66px, valeur `'BOLAMU:BLM-XXXX'`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goSuivre())
await page.waitForTimeout(3000)
await page.evaluate(() => window.__bolamu_test.suivreDossier())
await page.waitForTimeout(1000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.membreId commence par 'BLM-'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T09 — Événements proches
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/events` (init), `GET /api/v1/events/my/registrations` (init)
**Parcours utilisateur :**
1. Charger le dashboard (accueil)
2. Observer la liste des événements proches (max 5)
3. Chaque card : titre, lieu, date, badge Zora
4. Bouton **Participer** (bleu) si non inscrit, **Inscrit ✓** (vert) si déjà inscrit
5. Cliquer **Participer** sur un événement disponible
**UI attendue :** Toast `'Inscription confirmée · +50 Zora après participation'` si succès, ou toast d'erreur réseau
**Test Playwright :**
```js
const events = await page.evaluate(() => window.__bolamu_test.getEvents())
// events.length > 0
if (events && events.length > 0) {
  const ev = events.find(e => !e.registered)
  if (ev) {
    await page.evaluate((id) => window.__bolamu_test.participate(id), ev.dbId)
    await page.waitForTimeout(2000)
  }
}
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T10 — Mes événements + annulation
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/events/my/registrations` (init), `DELETE /api/v1/events/:id/register` (annulation)
**Parcours utilisateur :**
1. Charger le dashboard (accueil)
2. Identifier un événement avec badge **Inscrit ✓**
3. Cliquer **Annuler** l'inscription sur cet événement
4. Confirmer le `confirm()` natif du navigateur
5. Observer la réponse : succès = reload, erreur = alert
**UI attendue :** Alert `'Inscription annulée avec succès'` + `window.location.reload()`, ou `'Annulation impossible'`
**Test Playwright :**
```js
const events = await page.evaluate(() => window.__bolamu_test.getEvents())
const registered = events && events.find(e => e.registered)
if (registered) {
  page.once('dialog', d => d.accept())
  await page.evaluate((id) => window.__bolamu_test.cancelEventRegistration(id), registered.dbId)
  await page.waitForTimeout(3000)
}
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T11 — Groupes sport sur accueil
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/sport-groups` (init), `POST /api/v1/clubs/:id/join` (rejoindre)
**Parcours utilisateur :**
1. Charger le dashboard (accueil)
2. Observer la grille de groupes sport
3. Chaque groupe : icône, nom, nb membres, score hebdo
4. Bouton **Rejoindre** (bleu) si non membre, **Membre ✓** (vert) si déjà membre
5. Cliquer **Rejoindre** sur un groupe
**UI attendue :** Toast `'Groupe rejoint !'` ou `'Déjà membre de ce groupe'` ou `'Erreur de connexion'`
**Test Playwright :**
```js
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.sportGroupsData.length > 0
const groups = state.sportGroupsData
if (groups && groups.length > 0) {
  const g = groups.find(g => !g.isMember)
  if (g) {
    await page.evaluate(async (id) => window.__bolamu_test.joinGroup(id), g.id)
    await page.waitForTimeout(2000)
  }
}
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T12 — Classement + encourager + commenter
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/leaderboard/weekly` (init), `GET /api/v1/leaderboard/weekly?group_id=X` (filtre groupe)
**Parcours utilisateur :**
1. Charger le dashboard (accueil) — classement top 5 chargé
2. Observer les entrées : rang, initiale, nom masqué, pts
3. Cliquer **Encourager** sur un membre
4. Ouvrir le champ commentaire sur un membre
5. Saisir un texte et envoyer
**UI attendue :** Toast `'Fonctionnalité bientôt disponible'` pour encourager et commenter, champ commentaire toggle visible
**Test Playwright :**
```js
const lb = await page.evaluate(() => window.__bolamu_test.getLeaderboard())
if (lb && lb.length > 0) {
  const phone = lb[0].phone
  await page.evaluate((p) => window.__bolamu_test.encourageMember(p), phone)
  await page.waitForTimeout(500)
  await page.evaluate((p) => window.__bolamu_test.toggleCommentInput(p), phone)
  await page.waitForTimeout(300)
  await page.evaluate((p) => window.__bolamu_test.updateCommentText(p, 'Bravo !'), phone)
  await page.evaluate((p) => window.__bolamu_test.sendComment(p), phone)
  await page.waitForTimeout(500)
}
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T13 — Défis jour sport
**Statut :** ⏳ À tester
**Route API :** (pas d'appel API — données statiques / timer client)
**Parcours utilisateur :**
1. `goGagner()` puis `gagnerSport()`
2. Observer la carte **Défi du jour sport** (fond bleu nuit)
3. Lire le titre du défi (ex. "10 000 pas aujourd'hui")
4. Observer le badge **+X Zora** et la barre de progression
5. Observer le timer "Expire dans Xh Xmin" (`defi1Txt`)
**UI attendue :** Carte bleue `#0A2463`, badge Zora orange, countdown en blanc ou orange si < 2h restantes
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goGagner())
await page.waitForTimeout(3000)
await page.evaluate(() => window.__bolamu_test.gagnerSport())
await page.waitForTimeout(1000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.gagnerTab === 'sport'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T14 — Actions sport
**Statut :** ⏳ À tester
**Route API :** (pas de route API — toast "bientôt disponible")
**Parcours utilisateur :**
1. `goGagner()` puis `gagnerSport()`
2. Observer les 4 cards d'actions : Activité, Sommeil, Nutrition, Hydratation
3. Cliquer **Activer** sur la card Activité
4. Observer toast
5. Répéter pour Hydratation
**UI attendue :** Toast `'Suivi d'activité bientôt disponible'`, Toast `'Suivi hydratation bientôt disponible'`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.toastActivite())
await page.waitForTimeout(500)
const s1 = await page.evaluate(() => window.__bolamu_test.getState())
// s1.toast === "Suivi d'activité bientôt disponible"
await page.evaluate(() => window.__bolamu_test.toastHydratation())
await page.waitForTimeout(500)
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T15 — Actions sommeil
**Statut :** ⏳ À tester
**Route API :** (pas de route API — toast "bientôt disponible")
**Parcours utilisateur :**
1. `goGagner()` puis `gagnerSport()`
2. Observer la card **Sommeil**
3. Cliquer le bouton d'action
4. Observer le toast
5. Vérifier texte exact du toast
**UI attendue :** Toast `'Suivi du sommeil bientôt disponible'`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.toastSommeil())
await page.waitForTimeout(500)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.toast === "Suivi du sommeil bientôt disponible"
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T16 — Actions nutrition
**Statut :** ⏳ À tester
**Route API :** (pas de route API — toast "bientôt disponible")
**Parcours utilisateur :**
1. `goGagner()` puis `gagnerSport()`
2. Observer la card **Nutrition**
3. Cliquer le bouton d'action
4. Observer le toast
5. Vérifier texte exact du toast
**UI attendue :** Toast `'Suivi nutrition bientôt disponible'`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.toastNutrition())
await page.waitForTimeout(500)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.toast === "Suivi nutrition bientôt disponible"
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T17 — Événements sport + carte
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/events` (init), `POST /api/v1/events/:id/register` (inscription)
**Parcours utilisateur :**
1. `goGagner()` puis `gagnerSport()`
2. Observer la carte Leaflet (OpenStreetMap) avec marqueurs jaunes des événements
3. Observer la liste cards événements sport
4. Cliquer **Participer** sur un événement
5. Observer toast de confirmation
**UI attendue :** Carte Leaflet initialisée, marqueurs visibles, Toast `'Inscription confirmée · +50 Zora après participation'`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goGagner())
await page.waitForTimeout(3000)
await page.evaluate(() => window.__bolamu_test.gagnerSport())
await page.waitForTimeout(2000)
const events = await page.evaluate(() => window.__bolamu_test.getEvents())
if (events && events.length > 0) {
  await page.evaluate((id) => window.__bolamu_test.participate(id), events[0].dbId)
  await page.waitForTimeout(2000)
}
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T18 — Groupes sport complet
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/sport-groups` (init), `POST /api/v1/clubs/:id/join` (rejoindre)
**Parcours utilisateur :**
1. `goGagner()` puis `gagnerSport()`
2. Observer la section **Groupes sport** (icônes, noms, membres, score hebdo)
3. Cliquer **Rejoindre** sur un groupe non-membre
4. Attendre rechargement des groupes depuis `/api/v1/clubs`
5. Observer toast et mise à jour bouton en **Membre ✓**
**UI attendue :** Toast `'Groupe rejoint !'`, bouton devient vert
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.gagnerSport())
await page.waitForTimeout(2000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
const groups = state.sportGroupsData
if (groups && groups.length > 0) {
  const g = groups.find(g => !g.isMember)
  if (g) {
    await page.evaluate(async (id) => window.__bolamu_test.joinGroup(id), g.id)
    await page.waitForTimeout(2000)
  }
}
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T19 — Jeux Zora accès
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/zora/games/config` (init)
**Parcours utilisateur :**
1. `goRecompenses()`
2. Observer le banner **Salle de jeux Zora** (fond dégradé bleu nuit)
3. Lire `freeCount` : "N parties gratuites aujourd'hui"
4. Observer les 4 cards de jeux (Grattage, Roue, Coffre, Quiz)
5. Bouton **Jouer** (bleu) actif si `freeCount > 0`, gris "Plus de partie" sinon
**UI attendue :** `freeCount` affichée, 4 cards jeux avec icon/nom/gain, boutons contextuels selon freeCount
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goRecompenses())
await page.waitForTimeout(3000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.freeGames >= 0
// state.panel === 'reward'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T20 — Défi jour santé
**Statut :** ⏳ À tester
**Route API :** (pas d'appel API — données statiques / timer client)
**Parcours utilisateur :**
1. `goGagner()` puis `gagnerSante()`
2. Observer la carte **Défi du jour santé** (fond bleu nuit)
3. Titre : "Bilan annuel complet", badge "+200 Zora"
4. Barre progression à 20%
5. Timer "Expire dans Xh Xmin" (`defi2Txt`)
**UI attendue :** Carte bleue `#0A2463`, badge orange +200, barre gradient orange-jaune à 20%
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goGagner())
await page.waitForTimeout(3000)
await page.evaluate(() => window.__bolamu_test.gagnerSante())
await page.waitForTimeout(2000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.gagnerTab === 'sante'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T21 — Actions santé RDV/labo/bilan/parrainage
**Statut :** ⏳ À tester
**Route API :** `POST /api/v1/appointments/book` (body: `{patient_phone, doctor_id, date, time}`) — via `confirmRdv()`
**Parcours utilisateur :**
1. `goGagner()` puis `gagnerSante()`
2. Cliquer **Prendre RDV** → modal RDV s'ouvre
3. Cliquer **Réserver** (analyse labo) → toast
4. Cliquer **Planifier** (bilan annuel) → toast
5. Cliquer **Inviter via WhatsApp** (parrainage) → toast
**UI attendue :**
- Modal RDV s'ouvre (`state.modal === true`)
- Toast `'Réservation bientôt disponible'`
- Toast `'Planification bientôt disponible'`
- Toast `'Parrainage WhatsApp bientôt disponible'`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.gagnerSante())
await page.waitForTimeout(1000)
await page.evaluate(() => window.__bolamu_test.openModal())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.closeModal())
await page.evaluate(() => window.__bolamu_test.toastReserver())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.toastPlanifier())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.toastWhatsapp())
await page.waitForTimeout(500)
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T22 — Réseau partenaires + carte
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/map/intervenants` (init, chargé lors de `initReseauMap`)
**Parcours utilisateur :**
1. `goGagner()` puis `gagnerSante()`
2. Observer la carte Leaflet réseau partenaires (OpenStreetMap)
3. Filtrer **Cliniques** (marqueurs bleus `#003FB1`)
4. Filtrer **Pharmacies** (marqueurs verts `#00C9A7`)
5. Filtrer **Labos** (marqueurs oranges `#FF6B35`), puis **Tout**
**UI attendue :** Carte Leaflet avec marqueurs colorés par type, liste `reseauPlaces` filtrée
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.gagnerSante())
await page.waitForTimeout(2000)
await page.evaluate(() => window.__bolamu_test.filterClin())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.filterPharm())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.filterLabo())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.filterTout())
await page.waitForTimeout(500)
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T23 — Solde Zora + Zora Cash
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/zora/balance` (init)
**Parcours utilisateur :**
1. `goSuivre()` puis `suivreZora()`
2. Observer la carte dégradé bleu : **Zora Points** + **Zora Cash**
3. `zoraTxt` = balance formatée (ex. `1 250`)
4. `zoraCashTxt` = `'—'` (conversion non encore active)
5. Lire le label trimestre courant (ex. "Trimestre Q2 — remise à zéro dans X jours")
**UI attendue :** Carte avec 2 valeurs, badge MoMo vert, `zoraCashTxt = '—'`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goSuivre())
await page.waitForTimeout(3000)
await page.evaluate(() => window.__bolamu_test.suivreZora())
await page.waitForTimeout(500)
const zora = await page.evaluate(() => window.__bolamu_test.getZora())
// zora !== undefined && zora !== null
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T24 — Parcours paliers
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/zora/balance` (init — fournit `_zoraTier`, `_zoraNextTier`, `_zoraPointsToNext`)
**Parcours utilisateur :**
1. `goSuivre()` puis `suivreZora()`
2. Observer la barre de progression des 4 paliers
3. Paliers : **Kimia** (0) → **Liboso** (500) → **Nkembo** (3 000) → **Elonga** (7 000)
4. Point bleu indique la position actuelle
5. Texte `patientsToNext` : "À X pts du palier Y"
**UI attendue :** Barre avec 4 segments, point bleu à position actuelle, noms et seuils lisibles
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.suivreZora())
await page.waitForTimeout(500)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.zoraTierLabel est une string
// state.patientsToNext contient 'pts'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T25 — Historique points ledger
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/zora/ledger?limit=10` (init)
**Parcours utilisateur :**
1. `goSuivre()` puis `suivreZora()`
2. Scroller jusqu'à **Historique des points**
3. Observer les entrées : icône, label, date, delta
4. Delta vert pour gains (`+N`), rouge pour dépenses (`-N`)
5. "Aucun mouvement enregistré" si vide
**UI attendue :** Liste de mouvements, couleurs contextuelles, ou message vide
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.suivreZora())
await page.waitForTimeout(500)
const ledger = await page.evaluate(() => window.__bolamu_test.getLedger())
// Array.isArray(ledger)
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T26 — Conversion Zora Cash MoMo
**Statut :** ⏳ À tester
**Route API :** (pas de route active — toast "bientôt disponible")
**Parcours utilisateur :**
1. `goSuivre()` puis `suivreZora()`
2. Cliquer **Convertir en Zora Cash (MoMo)**
3. Observer le toast
4. Vérifier l'absence d'appel API
5. Vérifier que le solde n'est pas modifié
**UI attendue :** Toast `'Conversion Zora Cash bientôt disponible'`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.toastConvertir())
await page.waitForTimeout(500)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.toast === "Conversion Zora Cash bientôt disponible"
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T27 — Bons d'achat + QR
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/zora/vouchers` (init — via `/vouchers/my`)
**Parcours utilisateur :**
1. `goSuivre()` puis `suivreZora()`
2. Scroller jusqu'à **Mes bons d'achat**
3. Chaque voucher : partenaire, date expiration, code (monospace), statut Actif/Expiré
4. Cliquer **QR** sur un bon actif → modal QR voucher
5. Vérifier QR rendu avec QRCode.js
**UI attendue :** Liste vouchers, statut badge (vert/gris), modal QR avec `closeVoucherQrModal()`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.suivreZora())
await page.waitForTimeout(500)
const vouchers = await page.evaluate(() => window.__bolamu_test.getVouchers())
// Array.isArray(vouchers)
await page.evaluate(() => window.__bolamu_test.closeVoucherQrModal())
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T28 — Informations dossier
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/patients/profil` (init), `GET /api/v1/patients/check-subscription` (init)
**Parcours utilisateur :**
1. `goSuivre()` puis `suivreDossier()`
2. Observer le bloc **Informations**
3. Vérifier **Téléphone** affiché (`membreTel`)
4. Vérifier **Abonnement** (Bolamu Essentiel / Standard / Premium)
5. Vérifier **Membre depuis** (mois + année)
**UI attendue :** 3 champs visibles, abonnement correct (jamais bronze/silver/gold), date formatée en français
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goSuivre())
await page.waitForTimeout(3000)
await page.evaluate(() => window.__bolamu_test.suivreDossier())
await page.waitForTimeout(1000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.abonnementTxt inclut 'Bolamu' ou 'Essentiel' ou 'Standard' ou 'Premium'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T29 — Constantes médicales affichage
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/patients/constantes/:phone` (init)
**Parcours utilisateur :**
1. `goSuivre()` puis `suivreDossier()`
2. Observer le bloc **Constantes médicales**
3. Grille 2 colonnes : groupe sanguin, allergies, maladies chroniques, antécédents, traitements, poids·taille
4. Contact d'urgence (nom · téléphone · lien)
5. Valeurs "Non renseigné" / "Aucune" si champs vides
**UI attendue :** Grille remplie ou valeurs par défaut, mention "Renseigné par votre médecin" en bas
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.suivreDossier())
await page.waitForTimeout(500)
const constantes = await page.evaluate(() => window.__bolamu_test.getConstantes())
// constantes !== null (peut être objet vide ou objet avec données)
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T30 — Constantes médicales modification
**Statut :** ⏳ À tester
**Route API :** `POST /api/v1/patients/constantes` (enregistrement)
**Parcours utilisateur :**
1. `suivreDossier()` + cliquer **Modifier** (bouton `const-edit`)
2. `openEditConst()` → modal formulaire ouvert avec valeurs actuelles pré-remplies
3. Modifier groupe sanguin, poids, taille via `setConst*()`
4. `saveConst()` → `POST /api/v1/patients/constantes` avec les champs modifiés
5. Observer toast
**UI attendue :** Toast `'Constantes mises à jour'` ou `'Aucune modification à enregistrer'`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openEditConst())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.setConstGroupe('O+'))
await page.evaluate(() => window.__bolamu_test.setConstPoids('72'))
await page.evaluate(() => window.__bolamu_test.setConstTaille('175'))
await page.evaluate(() => window.__bolamu_test.saveConst())
await page.waitForTimeout(2000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.toast === 'Constantes mises à jour' ou 'Aucune modification à enregistrer'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T31 — Documents DMN
**Statut :** ⏳ À tester
**Route API :** `POST /api/v1/dmn/download/verify` (vérif password), `GET /api/v1/dmn/summary` (liste docs)
**Parcours utilisateur :**
1. `suivreDossier()` + cliquer **Accéder aux documents**
2. `openDmnPasswordModal()` → modal password visible
3. `confirmDmnPassword()` sans saisir → toast 'Mot de passe requis'
4. Saisir password via `state.dmnPassword` + confirmer → appel API verify
5. Si succès → `GET /api/v1/dmn/summary` → liste docs chargée
**UI attendue :** Toast `'Mot de passe requis'` si vide, toast `'Mot de passe incorrect'` si faux, ou liste docs
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openDmnPasswordModal())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.confirmDmnPassword())
await page.waitForTimeout(1000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.toast === 'Mot de passe requis'
await page.evaluate(() => window.__bolamu_test.closeDmnPasswordModal())
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T32 — QR urgence
**Statut :** ⏳ À tester
**Route API :** (client-side uniquement — `urgenceQrText()` = `'BOLAMU:URGENCE:' + id + ':' + groupe + ':' + allergies`)
**Parcours utilisateur :**
1. `suivreDossier()` + cliquer **Générer mon QR d'urgence**
2. `openQrUrg()` → modal visible, `renderQR('urg-qr', urgenceQrText(), 168)` exécuté
3. QR 168px rendu en blanc sur fond sombre
4. Observer l'UI : fond modal `rgba(10,36,99,0.55)`, QR blanc, description "Valable 24h"
5. `closeQrUrg()` → modal fermé
**UI attendue :** Modal visible avec QR 168px, fermeture propre sans erreur
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openQrUrg())
await page.waitForTimeout(1000)
const s1 = await page.evaluate(() => window.__bolamu_test.getState())
// s1.qrUrg === true
await page.evaluate(() => window.__bolamu_test.closeQrUrg())
await page.waitForTimeout(300)
const s2 = await page.evaluate(() => window.__bolamu_test.getState())
// s2.qrUrg === false
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T33 — QR médical
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/dmn/qr-payload` → `{success:true, data:{signed:"...", payload:{...}}}`
**Parcours utilisateur :**
1. `suivreDossier()` + cliquer **Générer mon QR médical**
2. `openDmnQrModal()` → appel `GET /api/v1/dmn/qr-payload`
3. Payload retourné : `{signed: "...", payload: {...}}` → QR rendu
4. Si erreur API → toast `'Génération du QR impossible'`
5. `closeDmnQrModal()` → modal fermé
**UI attendue :** Modal avec QR ou toast d'erreur
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openDmnQrModal())
await page.waitForTimeout(3000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.dmnQrModal === true ou state.toast === 'Génération du QR impossible'
await page.evaluate(() => window.__bolamu_test.closeDmnQrModal())
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T34 — Résultats labo
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/lab/results/patient/:phone` (optionnel — chargé si labo intégré)
**Parcours utilisateur :**
1. `suivreDossier()`
2. Trouver le bouton Résultats labo (si présent dans l'UI)
3. `openLabRes()` → modal visible
4. Observer le contenu (liste résultats ou état vide)
5. `closeLabRes()` → modal fermé
**UI attendue :** Modal `labRes` visible (`state.labRes === true`), puis fermé après `closeLabRes()`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openLabRes())
await page.waitForTimeout(500)
const s1 = await page.evaluate(() => window.__bolamu_test.getState())
// s1.labRes === true
await page.evaluate(() => window.__bolamu_test.closeLabRes())
await page.waitForTimeout(300)
const s2 = await page.evaluate(() => window.__bolamu_test.getState())
// s2.labRes === false
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T35 — Historique accès dossier
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/dmn/access-log` (init)
**Parcours utilisateur :**
1. `goSuivre()` puis `suivreDossier()`
2. Scroller jusqu'à **Historique des accès**
3. Chaque entrée : icône type (qr_scan/download/consultation/update), accesseur, date
4. Types traduits : "QR scan", "Téléchargement", "Consultation", "Mise à jour"
5. "Aucun accès enregistré" si liste vide
**UI attendue :** Jusqu'à 5 entrées les plus récentes, ou message vide
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.suivreDossier())
await page.waitForTimeout(500)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.suivreTab === 'dossier'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T36 — Timeline consultations
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/reports/patient/:phone/timeline` (init)
**Parcours utilisateur :**
1. `goSuivre()` puis `suivreDossier()`
2. Scroller jusqu'à **Historique des consultations**
3. Timeline verticale : chaque entrée = médecin, spécialité, date, motif
4. Si statut "en attente de compte rendu" → icône hourglass orange
5. "Aucune consultation enregistrée" si vide
**UI attendue :** Timeline avec cartes blanches, ou message vide
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.suivreDossier())
await page.waitForTimeout(500)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.suivreTab === 'dossier'
// timelineView accessible via DOM (sc-for list)
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T37 — Carte membre + QR dossier
**Statut :** ⏳ À tester
**Route API :** (client-side — `dossierQrText()` = `'BOLAMU:' + patientMembreId()`, QR rendu via QRCode.js)
**Parcours utilisateur :**
1. `goSuivre()` puis `suivreDossier()`
2. Scroller jusqu'à la **Carte membre** bleue
3. Lire `patientNom` (uppercase), `membreId` (format `BLM-XXXX`)
4. Observer le QR 66px dans la carte (`id="dossier-qr"`)
5. Badge BHP · Bolamu Health Protocol visible
**UI attendue :** Carte dégradé bleu `#1a3a8f→#0A2463`, QR blanc 66px, badge BHP jaune
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.suivreDossier())
await page.waitForTimeout(1000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.membreId commence par 'BLM-'
// state.membreNom est uppercase
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T38 — Récompenses solde + palier
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/zora/balance` (init)
**Parcours utilisateur :**
1. `goRecompenses()`
2. Observer l'en-tête de section : `zoraTxt` + ZoraCoin
3. Texte `'À X pts du palier supérieur'` en vert
4. Solde bien formaté avec séparateur espace
5. ZoraCoin animé (SVG)
**UI attendue :** `zoraTxt` ≠ '—', texte palier en `#00875f`, ZoraCoin visible
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goRecompenses())
await page.waitForTimeout(3000)
const zora = await page.evaluate(() => window.__bolamu_test.getZora())
// zora !== undefined
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.panel === 'reward'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T39 — Salle de jeux parties gratuites
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/zora/games/config` (init — fournit `free_plays_remaining` et config jeux)
**Parcours utilisateur :**
1. `goRecompenses()`
2. Observer le banner salle de jeux (`freeCount` affiché)
3. Vérifier badge animé "N parties gratuites aujourd'hui"
4. Observer les 4 cards : Grattage, Roue Fortune, Coffres, Quiz Santé
5. Si `freeCount === 0` → boutons gris "Plus de partie"
**UI attendue :** `state.freeGames >= 0`, badge pulsant, boutons bleus si parties dispo
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goRecompenses())
await page.waitForTimeout(3000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.freeGames !== undefined
// state.freeGames >= 0
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T40 — Jeux Grattage/Roue/Coffre/Quiz
**Statut :** ⏳ À tester
**Route API :** (ouverture modale client uniquement — pas d'API à l'ouverture)
**Parcours utilisateur :**
1. `goRecompenses()` puis `openScratch()` → modal grattage visible
2. `closeGame()` → modal fermé
3. `openWheel()` → modal roue visible avec segments colorés
4. `openChest()` → modal 3 coffres visible
5. `openQuiz()` → modal quiz avec question et 4 options
**UI attendue :** Chaque modal visible (fond `rgba(10,36,99,0.55)`), `state.game` = 'scratch'|'wheel'|'chest'|'quiz'
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goRecompenses())
await page.waitForTimeout(3000)
await page.evaluate(() => window.__bolamu_test.openScratch())
await page.waitForTimeout(500)
const s1 = await page.evaluate(() => window.__bolamu_test.getState())
// s1.game === 'scratch'
await page.evaluate(() => window.__bolamu_test.closeGame())
await page.evaluate(() => window.__bolamu_test.openWheel())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.closeGame())
await page.evaluate(() => window.__bolamu_test.openChest())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.closeGame())
await page.evaluate(() => window.__bolamu_test.openQuiz())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.closeGame())
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T41 — Gagner partie gratuite
**Statut :** ⏳ À tester
**Route API :** `POST /api/v1/zora/games/play` (body: `{game_type: 'wheel'|'chest'|'quiz'|'scratch', play_type: 'free'}`)
**Parcours utilisateur :**
1. `openWheel()` → `spinWheel()` → appel API play avec game_type='wheel'
2. Observer résultat : Toast `'+N Zora gagnés à la Roue !'`
3. `openChest()` → `openChest1()` → appel API play avec game_type='chest'
4. `openQuiz()` → `pickQuiz0()` → appel API play avec game_type='quiz'
5. `openScratch()` → `playScratch()` → appel API play avec game_type='scratch'
**UI attendue :**
- Roue : animation rotation + toast `'+N Zora gagnés à la Roue !'`
- Coffre : coffre ouvert + toast `'+N Zora trouvés dans le coffre !'`
- Quiz : option colorée (vert = correcte, rouge = fausse) + toast `'+N Zora · bonne réponse !'`
- Grattage : canvas révélé + gain affiché
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openWheel())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.spinWheel())
await page.waitForTimeout(5000)
const s1 = await page.evaluate(() => window.__bolamu_test.getState())
// s1.wheelDone === true
await page.evaluate(() => window.__bolamu_test.closeGame())
await page.evaluate(() => window.__bolamu_test.openChest())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.openChest1())
await page.waitForTimeout(2000)
await page.evaluate(() => window.__bolamu_test.closeGame())
await page.evaluate(() => window.__bolamu_test.openQuiz())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.pickQuiz0())
await page.waitForTimeout(2000)
await page.evaluate(() => window.__bolamu_test.closeGame())
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T42 — Filtres catégories récompenses
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/zora/rewards` (init)
**Parcours utilisateur :**
1. `goRecompenses()`
2. Observer les 8 chips de filtres : Tout / Électronique / Voyage / Télécom / Hôtels / Sport / Beauté / Carburant
3. Cliquer chaque filtre → liste `affordableView` filtrée
4. Chip actif en bleu `#003FB1` + texte blanc
5. Revenir sur **Tout**
**UI attendue :** Chip actif coloré, liste récompenses filtrée par catégorie
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goRecompenses())
await page.waitForTimeout(3000)
await page.evaluate(() => window.__bolamu_test.filterCatElec())
await page.waitForTimeout(300)
await page.evaluate(() => window.__bolamu_test.filterCatVoyage())
await page.waitForTimeout(300)
await page.evaluate(() => window.__bolamu_test.filterCatTelecom())
await page.waitForTimeout(300)
await page.evaluate(() => window.__bolamu_test.filterCatHotels())
await page.waitForTimeout(300)
await page.evaluate(() => window.__bolamu_test.filterCatSport())
await page.waitForTimeout(300)
await page.evaluate(() => window.__bolamu_test.filterCatBeaute())
await page.waitForTimeout(300)
await page.evaluate(() => window.__bolamu_test.filterCatCarburant())
await page.waitForTimeout(300)
await page.evaluate(() => window.__bolamu_test.filterCatTout())
await page.waitForTimeout(300)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.filterCategorie === 'tout'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T43 — Offres éclair
**Statut :** ⏳ À tester
**Route API :** (display client uniquement — `offerTxt` = countdown, `flashCount` = `'3'` statique)
**Parcours utilisateur :**
1. `goRecompenses()`
2. Observer le badge **Offres éclair** avec `flashCount` (= '3')
3. Countdown `offerTxt` : "X restantes" ou "Xh Xmin restantes"
4. Badge animé en rouge `#BA1A1A` si `hoursLeft(offer) < 4`
5. Badge statique sinon
**UI attendue :** Badge visible avec `flashCount = '3'`, animation `livePulse` si urgence, countdown formaté
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goRecompenses())
await page.waitForTimeout(3000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.panel === 'reward'
// flashCount et offerTxt visibles dans le DOM
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T44 — Catalogue partenaires
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/zora/rewards` (init)
**Parcours utilisateur :**
1. `goRecompenses()`
2. Observer la grille catalogue de récompenses
3. Chaque card : image partenaire, nom, coût en Zora
4. Bouton **Échanger** (bleu) si solde suffisant, **Solde insuffisant** (gris) sinon
5. Cliquer **Solde insuffisant** → toast `'Solde Zora insuffisant'`
**UI attendue :** Grille cards, boutons contextuels, Toast `'Solde Zora insuffisant'` si balance < coût
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goRecompenses())
await page.waitForTimeout(3000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.panel === 'reward'
// rewards chargées via _rewardsLoaded
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T45 — Derniers échanges
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/zora/vouchers` (init — via `/vouchers/my`)
**Parcours utilisateur :**
1. `goSuivre()` puis `suivreZora()`
2. Scroller jusqu'à **Mes bons d'achat**
3. Chaque voucher : nom partenaire, date expiration, code monospace, statut
4. Statut **Actif** (vert) ou **Expiré** (gris)
5. Bouton QR désactivé pour les expirés
**UI attendue :** Liste ou message "Aucun bon d'achat disponible"
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goSuivre())
await page.waitForTimeout(3000)
await page.evaluate(() => window.__bolamu_test.suivreZora())
await page.waitForTimeout(500)
const vouchers = await page.evaluate(() => window.__bolamu_test.getVouchers())
// Array.isArray(vouchers)
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T46 — Échange voucher
**Statut :** ⏳ À tester
**Route API :** `POST /api/v1/zora/redeem` (body: `{reward_id}`) → `{success:true, data:{...}}`
**Parcours utilisateur :**
1. `goRecompenses()`
2. Identifier une récompense avec solde suffisant
3. Cliquer **Échanger** → `POST /api/v1/zora/redeem`
4. Observer toast de succès
5. Modal voucher s'ouvre avec code et partenaire
**UI attendue :** Toast `'Échange réussi · voucher généré'`, puis modal voucher. Erreurs possibles : `'Solde Zora insuffisant'` / `'Palier insuffisant pour cette récompense'` / `'Récompense épuisée'` / `'Récompense introuvable'`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.goRecompenses())
await page.waitForTimeout(3000)
// L'échange se déclenche via affordableView.onExchange() dans le DOM
// Après échange, fermer le modal :
await page.evaluate(() => window.__bolamu_test.closeVoucherModal())
await page.waitForTimeout(500)
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T47 — Modal voucher + QR
**Statut :** ⏳ À tester
**Route API :** (client-side uniquement — modal affiche données du voucher retourné par T46)
**Parcours utilisateur :**
1. Après échange réussi (T46) : modal voucher visible
2. Lire le code voucher (`voucherCode`, police monospace)
3. Lire le nom du partenaire (`voucherPartner`)
4. Cliquer **Fermer** → `closeVoucherModal()`
5. Depuis **Mes bons d'achat** : cliquer QR → modal QR voucher → `closeVoucherQrModal()`
**UI attendue :** Modal fond sombre, code visible, partenaire lisible, fermeture sans erreur
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.closeVoucherModal())
await page.waitForTimeout(300)
await page.evaluate(() => window.__bolamu_test.closeVoucherQrModal())
await page.waitForTimeout(300)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.voucherModal === false
// state.voucherQrModal === false
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T48 — Chat communauté
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/chat/conversations/1/messages` (chargement), `POST /api/v1/chat/conversations/1/messages` (body: `{content}`)
**Parcours utilisateur :**
1. Cliquer icône chat dans le header → `openChatReal()`
2. Drawer slide-in depuis droite, onglet **Communauté** actif
3. Messages de la conversation 1 chargés
4. Socket.io connecté (`io('https://api.bolamu.co')`)
5. `sendChatMessage()` → `POST /api/v1/chat/conversations/1/messages`
**UI attendue :** Drawer visible (`state.chatOpen === true`), liste messages, champ saisie
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openChatReal())
await page.waitForTimeout(3000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.chatOpen === true
await page.evaluate(() => window.__bolamu_test.chatCommunaute())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.closeChat())
await page.waitForTimeout(300)
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T49 — Chat médecins
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/chat/doctors` (liste médecins avec RDV passés)
**Parcours utilisateur :**
1. `openChatReal()` pour ouvrir le drawer
2. `chatMedecins()` → basculer sur l'onglet **Médecins**
3. Observer la liste de conversations avec médecins
4. Chaque entrée : nom médecin, dernier message, compteur non-lu
5. `closeChat()` → drawer fermé
**UI attendue :** Onglet Médecins actif (`state.chatTab === 'medecins'`), liste conversations ou message vide
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openChatReal())
await page.waitForTimeout(2000)
await page.evaluate(() => window.__bolamu_test.chatMedecins())
await page.waitForTimeout(1000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.chatTab === 'medecins'
await page.evaluate(() => window.__bolamu_test.closeChat())
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T50 — Badge chat non lu
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/chat/unread` (init si appelé — `chatBadge: ''` et `chatBadgeStyle: {display:'none'}` par défaut)
**Parcours utilisateur :**
1. Charger le dashboard
2. Observer l'icône chat dans le header
3. Si aucun non-lu → badge masqué (`chatBadgeStyle.display = 'none'`)
4. Si non-lu > 0 → badge visible avec compteur
5. Après lecture → badge disparaît
**UI attendue :** Badge masqué par défaut, visible avec nombre si unreads > 0
**Test Playwright :**
```js
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.chatBadge === '' par défaut
// chatBadgeStyle.display === 'none' par défaut
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T51 — Modal RDV complet
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/appointments/slots/:doctor_id?date=YYYY-MM-DD` (créneaux), `POST /api/v1/appointments/book` (body: `{patient_phone, doctor_id, date, time}`)
**Parcours utilisateur :**
1. `openModal()` → modal RDV visible
2. `rdvSelectDoctor('1')` → chargement des créneaux pour ce médecin
3. `rdvSelectDate('2026-07-01')` → `GET /api/v1/appointments/slots/1?date=2026-07-01`
4. `rdvSelectSlot('09:00')` → créneau sélectionné
5. `confirmRdv()` → `POST /api/v1/appointments/book` → Toast `'Rendez-vous confirmé · +50 Zora après consultation'`
**UI attendue :** Toast `'Rendez-vous confirmé · +50 Zora après consultation'` ou `'Choisis un médecin, une date et un créneau'`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openModal())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.rdvSelectDoctor('1'))
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.rdvSelectDate('2026-07-01'))
await page.waitForTimeout(2000)
await page.evaluate(() => window.__bolamu_test.rdvSelectSlot('09:00'))
await page.waitForTimeout(300)
await page.evaluate(() => window.__bolamu_test.confirmRdv())
await page.waitForTimeout(3000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.toast !== null
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T52 — Modal constantes complet
**Statut :** ⏳ À tester
**Route API :** `POST /api/v1/patients/constantes` (body: tous les champs du formulaire)
**Parcours utilisateur :**
1. `openEditConst()` → modal formulaire pré-rempli avec valeurs actuelles
2. Remplir les 10 champs via `setConst*()` (groupe, poids, taille, allergies, maladies, antécédents, traitements, contactNom, contactPhone, contactLien)
3. `saveConst()` → `POST /api/v1/patients/constantes`
4. Observer toast
5. `closeEditConst()` → modal fermé, affichage mis à jour
**UI attendue :** Toast `'Constantes mises à jour'` ou `'Aucune modification à enregistrer'`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openEditConst())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.setConstGroupe('O+'))
await page.evaluate(() => window.__bolamu_test.setConstPoids('72'))
await page.evaluate(() => window.__bolamu_test.setConstTaille('175'))
await page.evaluate(() => window.__bolamu_test.setConstAllergies('Aucune'))
await page.evaluate(() => window.__bolamu_test.setConstMaladies('Aucune'))
await page.evaluate(() => window.__bolamu_test.setConstAntecedents('Aucun'))
await page.evaluate(() => window.__bolamu_test.setConstTraitements('Aucun'))
await page.evaluate(() => window.__bolamu_test.setConstContactNom('Marie Ngambou'))
await page.evaluate(() => window.__bolamu_test.setConstContactPhone('+242069000000'))
await page.evaluate(() => window.__bolamu_test.setConstContactLien('Mère'))
await page.evaluate(() => window.__bolamu_test.saveConst())
await page.waitForTimeout(3000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.toast === 'Constantes mises à jour'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T53 — Modal QR urgence
**Statut :** ⏳ À tester
**Route API :** (client-side uniquement — `urgenceQrText()` = `'BOLAMU:URGENCE:' + id + ':' + groupe + ':' + allergies`)
**Parcours utilisateur :**
1. `openQrUrg()` → modal visible, `renderQR('urg-qr', urgenceQrText(), 168)` exécuté
2. QR 168px rendu en blanc sur fond `rgba(10,36,99,0.55)`
3. Format encodé : `BOLAMU:URGENCE:BLM-XXXX:O+:Aucune` (ou valeurs réelles)
4. Description "Valable 24h" et "Accès secouriste"
5. `closeQrUrg()` → modal fermé
**UI attendue :** Modal visible avec QR 168px, fermeture propre sans erreur
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openQrUrg())
await page.waitForTimeout(1000)
const s1 = await page.evaluate(() => window.__bolamu_test.getState())
// s1.qrUrg === true
await page.evaluate(() => window.__bolamu_test.closeQrUrg())
await page.waitForTimeout(300)
const s2 = await page.evaluate(() => window.__bolamu_test.getState())
// s2.qrUrg === false
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T54 — Modal résultats labo
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/lab/results/patient/:phone` (optionnel selon intégration UI)
**Parcours utilisateur :**
1. `openLabRes()` → modal `labRes` visible (`state.labRes === true`)
2. Observer le contenu (liste résultats ou état vide)
3. Si résultats : valeur, unité, date, référence
4. Si vide : message "Aucun résultat disponible"
5. `closeLabRes()` → modal fermé
**UI attendue :** Modal visible et fermable sans erreur
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openLabRes())
await page.waitForTimeout(500)
const s1 = await page.evaluate(() => window.__bolamu_test.getState())
// s1.labRes === true
await page.evaluate(() => window.__bolamu_test.closeLabRes())
const s2 = await page.evaluate(() => window.__bolamu_test.getState())
// s2.labRes === false
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T55 — Modal DMN password + docs
**Statut :** ⏳ À tester
**Route API :** `POST /api/v1/dmn/download/verify` (body: `{password}`), `GET /api/v1/dmn/summary` (liste docs après verify), `GET /api/v1/dmn/download/:document_id` (téléchargement — URL Cloudinary 60s)
**Parcours utilisateur :**
1. `openDmnPasswordModal()` → modal password visible
2. `confirmDmnPassword()` sans saisie → toast `'Mot de passe requis'`
3. Avec mauvais password → toast `'Mot de passe incorrect'`
4. Avec bon password → `GET /api/v1/dmn/summary` → liste docs → `openDmnDocs()`
5. `downloadDmnDoc(ID)` → `GET /api/v1/dmn/download/:id` → URL Cloudinary signée (60s)
**UI attendue :**
- Toast `'Mot de passe requis'` si vide
- Toast `'Mot de passe incorrect'` si faux
- Toast `'Token expiré — re-vérifiez votre mot de passe'` si token DMN expiré
- Toast `'Téléchargement impossible'` si erreur download
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openDmnPasswordModal())
await page.waitForTimeout(300)
await page.evaluate(() => window.__bolamu_test.confirmDmnPassword())
await page.waitForTimeout(1000)
const s1 = await page.evaluate(() => window.__bolamu_test.getState())
// s1.toast === 'Mot de passe requis'
await page.evaluate(() => window.__bolamu_test.closeDmnPasswordModal())
await page.waitForTimeout(300)
const docs = await page.evaluate(() => window.__bolamu_test.getDmnDocs())
// docs est null ou [] si pas encore chargé
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T56 — Modal QR médical
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/dmn/qr-payload` → `{success:true, data:{signed:"...", payload:{...}}}`
**Parcours utilisateur :**
1. `openDmnQrModal()` → appel `GET /api/v1/dmn/qr-payload`
2. Si succès : payload signé reçu, QR rendu avec la valeur `signed`
3. Si erreur API → toast `'Génération du QR impossible'`
4. `closeDmnQrModal()` → modal fermé (`state.dmnQrModal === false`)
5. QR valide pour scan par un médecin (contient `payload.phone`, `payload.bolamu_id`, etc.)
**UI attendue :** Modal avec QR ou toast d'erreur API
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openDmnQrModal())
await page.waitForTimeout(3000)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.dmnQrModal === true ou state.toast === 'Génération du QR impossible'
await page.evaluate(() => window.__bolamu_test.closeDmnQrModal())
await page.waitForTimeout(300)
const s2 = await page.evaluate(() => window.__bolamu_test.getState())
// s2.dmnQrModal === false
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T57 — Panel événement
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/events/:id` (détail événement), `GET /api/v1/events/:id/participants` (classement), `POST /api/v1/events/:id/register` (participer depuis panel)
**Parcours utilisateur :**
1. `openEventPanel(ID)` → panel slide-in `event-panel.active`
2. `GET /api/v1/events/:id` → image hero, titre, lieu, date, Zora
3. `GET /api/v1/events/:id/participants` → classement des inscrits triés par Zora
4. Cliquer **Participer** (bouton fixe) → `POST /api/v1/events/:id/register`
5. `closeEventPanel()` → panel fermé
**UI attendue :** Panel plein-écran avec image hero 220px, classement participants, bouton fixe en bas
**Test Playwright :**
```js
const events = await page.evaluate(() => window.__bolamu_test.getEvents())
if (events && events.length > 0) {
  await page.evaluate((id) => window.__bolamu_test.openEventPanel(id), events[0].dbId)
  await page.waitForTimeout(3000)
  const panelActive = await page.evaluate(() =>
    document.getElementById('event-panel') &&
    document.getElementById('event-panel').classList.contains('active')
  )
  // panelActive === true
  await page.evaluate(() => window.__bolamu_test.closeEventPanel())
  await page.waitForTimeout(500)
}
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T58 — Panel participant
**Statut :** ⏳ À tester
**Route API :** `POST /api/v1/chat/conversations` (body: `{participant_phone}`) — via bouton **Message** dans le panel
**Parcours utilisateur :**
1. `openEventPanel(ID)` → panel événement chargé
2. Cliquer sur un participant (hors leader) → `openParticipantPanel(phone, nom, zora)`
3. Panel `participant-panel.active` visible : initiale, nom, Zora, compteurs
4. Bouton **Suivre** → `toggleFollow()` → toast `'Fonctionnalité bientôt disponible'`
5. Bouton **Message** → `startChat(phone)` → `POST /api/v1/chat/conversations`
**UI attendue :** Panel participant avec avatar initiale, stats, 2 boutons d'action. `openParticipantPanel` est une fonction globale JS hors `window.__bolamu_test`.
**Test Playwright :**
```js
// openParticipantPanel n'est PAS dans window.__bolamu_test — vérifier sa présence globale :
const hasFn = await page.evaluate(() => typeof openParticipantPanel === 'function')
// hasFn === true
// Pour fermer :
await page.evaluate(() => typeof closeParticipantPanel === 'function' && closeParticipantPanel())
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T59 — Panel club/groupe
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/clubs/:id` (détail), `GET /api/v1/clubs/:id/members` (classement membres), `POST /api/v1/clubs/:id/join` (rejoindre)
**Parcours utilisateur :**
1. `openClubPanel(ID)` → panel slide-in `club-panel.active`
2. `GET /api/v1/clubs/:id` → banner/image, nom, nb membres, Zora cumulés, description
3. `GET /api/v1/clubs/:id/members` → classement membres triés par Zora
4. Bouton fixe **Rejoindre** → `POST /api/v1/clubs/:id/join` → bouton devient **Membre ✓**
5. `closeClubPanel()` → panel fermé
**UI attendue :** Panel plein-écran avec banner 220px, classement membres, bouton fixe
**Test Playwright :**
```js
const state = await page.evaluate(() => window.__bolamu_test.getState())
const groups = state.sportGroupsData
if (groups && groups.length > 0) {
  await page.evaluate((id) => window.__bolamu_test.openClubPanel(id), groups[0].id)
  await page.waitForTimeout(3000)
  await page.evaluate((id) => window.__bolamu_test.joinClub(id), groups[0].id)
  await page.waitForTimeout(2000)
  await page.evaluate(() => window.__bolamu_test.closeClubPanel())
}
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T60 — Modal création groupe
**Statut :** ⏳ À tester
**Route API :** `POST /api/v1/clubs` (body: `{name, sport_type}`) — déclenché via `createClub()` global (hors `window.__bolamu_test`)
**Parcours utilisateur :**
1. Cliquer bouton **Créer un groupe** dans la section sport
2. `openCreateGroupModal()` dans `window.__bolamu_test` → toast `'Création de groupe bientôt disponible'`
3. (Le vrai modal `create-club-modal` existe dans le DOM mais est accessible via fonctions globales)
4. `closeCreateGroupModal()` → fermeture propre
5. Vérifier que `state.toast` contient le message attendu
**UI attendue :** Toast `'Création de groupe bientôt disponible'` (openCreateGroupModal = toast uniquement dans __bolamu_test)
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openCreateGroupModal())
await page.waitForTimeout(500)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.toast === 'Création de groupe bientôt disponible'
await page.evaluate(() => window.__bolamu_test.closeCreateGroupModal())
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T61 — Profil affichage
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/patients/profil` (init — fournit `_patientNom`, `_patientPrenom`, `_zoraTier`, `_zoraTotalEarned`, `_longestStreak`, `_events`)
**Parcours utilisateur :**
1. `openProfile()` → panneau profil visible (`state.profileOpen === true`)
2. Observer avatar (initiales 2 lettres sur fond bleu `#003FB1`)
3. Observer stats : Zora total gagné, record streak, nb événements
4. Observer menu items (Mes informations, Notifications, etc.)
5. `closeProfile()` → panneau fermé
**UI attendue :** Panneau plein-écran avec stats et menu, fermeture propre
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openProfile())
await page.waitForTimeout(1000)
const s1 = await page.evaluate(() => window.__bolamu_test.getState())
// s1.profileOpen === true
await page.evaluate(() => window.__bolamu_test.closeProfile())
const s2 = await page.evaluate(() => window.__bolamu_test.getState())
// s2.profileOpen === false
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T62 — Mes informations
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/patients/profil` (init → `{phone, full_name, gender, birth_date, city, neighborhood, bolamu_id, is_active, created_at}`)
**Parcours utilisateur :**
1. `openProfile()` → panneau profil
2. Trouver la section **Mes informations**
3. Vérifier : téléphone, nom complet, genre, date de naissance, ville
4. Vérifier `membreId` (format `BLM-XXXX`)
5. Vérifier statut abonnement
**UI attendue :** Données profil affichées, `membreId` présent au format `BLM-XXXX`, `is_active === true`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openProfile())
await page.waitForTimeout(500)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.patientNom est une string non vide
// state.membreId commence par 'BLM-'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T63 — Notifications
**Statut :** ⏳ À tester
**Route API :** `GET /api/v1/notifications` (?page), `PATCH /api/v1/notifications/:id/read`, `GET /api/v1/notifications/unread-count`
**Parcours utilisateur :**
1. `openProfile()`
2. Cliquer **Notifications** dans le menu profil
3. Action `comingSoon()` si non implémenté → toast `'Bientôt disponible'`
4. (Si implémenté) : liste `{id, type, titre, message, is_read, sent_at}`, pagination
5. Marquer comme lu → `PATCH /api/v1/notifications/:id/read`
**UI attendue :** Toast `'Bientôt disponible'` (actuel) ou liste notifications paginée
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openProfile())
await page.waitForTimeout(500)
await page.evaluate(() => window.__bolamu_test.comingSoon())
await page.waitForTimeout(500)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.toast === 'Bientôt disponible'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T64 — Confidentialité données
**Statut :** ⏳ À tester
**Route API :** (display only — informations BHP v1.2, Loi 29-2019)
**Parcours utilisateur :**
1. `openProfile()`
2. Cliquer **Confidentialité & données** dans le menu
3. Action `comingSoon()` → toast `'Bientôt disponible'`
4. (Futur) : informations RGPD local, consentements BHP, soft delete 5 ans
5. Retour au profil
**UI attendue :** Toast `'Bientôt disponible'`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openProfile())
await page.waitForTimeout(300)
await page.evaluate(() => window.__bolamu_test.comingSoon())
await page.waitForTimeout(500)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.toast === 'Bientôt disponible'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T65 — Moyens paiement MoMo
**Statut :** ⏳ À tester
**Route API :** `POST /api/v1/momo/request` (body: `{amount, plan}`), `GET /api/v1/momo/status/:referenceId`
**Parcours utilisateur :**
1. `openProfile()`
2. Cliquer **Moyens de paiement** dans le menu
3. Action `comingSoon()` → toast `'Bientôt disponible'`
4. (Futur) : saisir numéro MoMo, choisir plan (essentiel/standard/premium), déclencher paiement
5. Polling `GET /api/v1/momo/status/:referenceId` → SUCCESSFUL / FAILED / PENDING
**UI attendue :** Toast `'Bientôt disponible'` (actuel)
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openProfile())
await page.waitForTimeout(300)
await page.evaluate(() => window.__bolamu_test.comingSoon())
await page.waitForTimeout(500)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.toast === 'Bientôt disponible'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T66 — Langue FR/Lingala
**Statut :** ⏳ À tester
**Route API :** (client-side uniquement — changement de langue i18n non encore connecté)
**Parcours utilisateur :**
1. `openProfile()`
2. Cliquer **Langue** dans le menu
3. Action `comingSoon()` → toast `'Bientôt disponible'`
4. (Futur) : sélecteur Français / Lingala, persistance en localStorage
5. Textes traduits sans casser la logique (les `error.code` restent stables)
**UI attendue :** Toast `'Bientôt disponible'`
**Test Playwright :**
```js
await page.evaluate(() => window.__bolamu_test.openProfile())
await page.waitForTimeout(300)
await page.evaluate(() => window.__bolamu_test.comingSoon())
await page.waitForTimeout(500)
const state = await page.evaluate(() => window.__bolamu_test.getState())
// state.toast === 'Bientôt disponible'
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test

---

## TICKET T67 — Déconnexion
**Statut :** ⏳ À tester
**Route API :** (client-side — `localStorage.clear()` + `window.location.href = '/login.html'`)
**Parcours utilisateur :**
1. `openProfile()`
2. Cliquer **Déconnexion**
3. `logout()` → `localStorage.clear()` puis redirect vers `/login.html`
4. Vérifier que `bolamu_patient_token`, `bolamu_patient_phone` sont supprimés
5. Vérifier le redirect effectif vers `/login.html`
**UI attendue :** localStorage vidé, redirect vers `/login.html` (pas de toast — action immédiate)
**Test Playwright :**
```js
// NE PAS appeler logout() en début de suite car cela coupe la session de test.
// Vérifier uniquement la présence de la fonction, puis l'appeler en dernier :
const hasLogout = await page.evaluate(() => typeof window.__bolamu_test.logout === 'function')
// hasLogout === true
// En dernier test de la suite :
// await page.evaluate(() => window.__bolamu_test.logout())
// await page.waitForURL('**/login.html')
```
**Résultat du test :** ⏳ À remplir
**Verdict :** ⏳ À remplir
**Correction :** ⏳ En attente de test
