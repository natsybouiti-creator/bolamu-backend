# AUDIT COHÉRENCE — Dashboard Patient vs Backend

**Date :** 23 juin 2026  
**Fichier audité :** `public/patient/dashboard.html` (version DCLogic, 2919 lignes)  
**Méthode :** lecture complète `componentDidMount()` + `renderVals()` + croisement avec tous les fichiers `src/routes/` et `src/services/` concernés  
**Statut :** lecture seule — aucune modification effectuée

---

## Tableau principal — Fonctionnalité par fonctionnalité

| # | Fonctionnalité | Route | Existe | Auth OK | Format dashboard | Format backend | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | Profil patient | `GET /patients/profil?phone=` | ✅ | ✅ authMiddleware + req.query.phone | `d.success && d.data` → `d.data.full_name`, `phone`, `bolamu_id`, `plan_name` | `{ success, data: { full_name, phone, bolamu_id, gender, birth_date, ... } }` — **`plan_name` absent du SELECT** | ⚠️ `plan_name` jamais dans la réponse — retombe sur default 'Bolamu Essentiel' |
| 2 | Solde Zora | `GET /zora/balance` | ✅ | ✅ | `d.data.points \|\| d.data.balance`, `d.data.tier`, `d.data.next_tier`, `d.data.points_to_next` | `{ success, data: { balance, tier, next_tier, points_to_next } }` — `tier` en minuscules ex: `"kimia"` | ✅ Mapped via tierMap — OK |
| 3 | **Streak** | `GET /streaks/me` | ✅ | ✅ | `if (d.success)` → `d.current_streak`, `d.longest_streak` | `{ current_streak, longest_streak, ... }` **— pas de `success: true`** | ❌ **FORMAT MISMATCH** — `d.success` undefined → falsy → streak jamais affiché, toujours 0 |
| 4 | Événements Elonga | `GET /events` | ✅ | public | `d.success && d.data` → `e.pillar`, `e.location_name`, `e.starts_at`, `e.places_restantes`, `e.max_participants`, `e.zora_reward`, `e.cover_image_path`, `e.latitude`, `e.longitude` | `SELECT e.*` + `places_restantes` calculé | ✅ Tous les champs présents |
| 5 | Leaderboard | `GET /leaderboard/weekly` | ✅ | ✅ | `if (d.success && d.top)` → `d.top`, `d.my_position` | `{ success: true, top: [...], my_position: {...} }` | ✅ |
| 6 | Zora palier (2ème appel) | `GET /zora/balance?phone=` | ✅ | ✅ JWT (phone param ignoré côté backend) | `d.data.tier`, `d.data.next_tier`, `d.data.points_to_next` | Même route, même réponse — `?phone=` ignoré, backend utilise `req.user.phone` | ✅ mais **appel dupliqué** (inutile) |
| 7 | Groupes sport | `GET /sport-groups` | ✅ | **pas d'authMiddleware** | `d.success && d.data` → `g.icon_name`, `g.name`, `g.member_count`, `g.weekly_score`, `g.is_member` | Route GET public — `req.user` non défini → `phone = null` → `is_member` **toujours false** | ⚠️ `is_member` incorrect — groupes rejoints apparaissent comme non-rejoints |
| 8 | Ledger Zora | `GET /zora/ledger?limit=10` | ✅ | ✅ | `d.data.data` | `{ success, data: { data: rows, pagination: {...} } }` | ✅ `d.data.data` = `rows` |
| 9 | Abonnement | `GET /patients/subscription?phone=` | ✅ | ✅ + `req.query.phone` | `d.data.plan`, `d.data.status` | `{ success, data: { plan, status, amount_fcfa, started_at, expires_at } }` | ✅ (404 si absent → fallback default gracieux) |
| 10 | Constantes médicales (lecture) | `GET /patients/constantes/:phone` | ✅ | ✅ + identité phone | `d.data.groupe_sanguin`, `allergies`, `maladies_chroniques`, `poids`, `taille`, etc. | `{ success, data: { groupe_sanguin, allergies, ... } }` | ✅ |
| 11 | Timeline consultations | `GET /reports/patient/:phone/timeline` | ✅ | ✅ + identité phone | `d.data.filter(t => t.report_submitted)`, `d.data.find(t => t.status === 'confirme')` | `{ success, data: rows }` avec `report_submitted`, `status`, `appointment_date`, `doctor_name` | ✅ |
| 12 | Historique accès dossier | `GET /reports/access-log/:phone` | ✅ | ✅ + identité phone | `d.data.slice(0, 3)` | `{ success, data: rows }` | ✅ |
| 13 | Config jeux Zora | `GET /zora/games/config` | ✅ | public | Stocké dans `this._gamesConfig` | `{ success, data: {...} }` | ✅ fetché — **mais jamais utilisé** pour `this.gamesList` |
| 14 | QR identification | `GET /qr/generate` | ✅ | ✅ + abonnement actif requis | `d.data.token`, `d.data.expires_at` | `{ success, data: { token, expires_at, ttl_seconds, phone } }` | ✅ |
| 15 | S'inscrire événement | `POST /events/:id/register` | ✅ | ✅ | `d.success` → mise à jour state `events` | `{ success: true }` | ✅ |
| 16 | Jeux Zora (wheel/chest/scratch/quiz) | `POST /zora/games/play` | ✅ | ✅ | `d.data.points_won` | `{ success, data: { points_won, ... } }` | ✅ |
| 17 | Constantes médicales (écriture) | `POST /patients/constantes` | ✅ | ✅ role=patient | body correspond aux champs DB | `{ success, data: {...} }` | ✅ |
| 18 | **Réservation RDV** | `POST /appointments/book` | ✅ | ✅ | ❌ **Bouton "Confirmer" (ligne 1771) appelle `{{ closeModal }}` uniquement — aucun fetch** | `{ success: true, appointment: {...} }` | ❌ **CRITIQUE — API jamais appelée** |
| 19 | **Liste médecins (modal RDV)** | `GET /doctors` | ✅ | public | ❌ **Jamais appelée — 3 médecins hardcodés en HTML (ligne 1766)** | `{ success, data: [...] }` | ❌ non branché |
| 20 | **Créneaux disponibles** | `GET /appointments/slots/:doctor_id?date=` | ✅ | public | ❌ **Jamais appelée — 4 créneaux hardcodés (ligne 1768)** | `{ success, slots: [...], pris: [...] }` | ❌ non branché |
| 21 | **Récompenses Zora** | `GET /zora/rewards` | ✅ | public | ❌ **Jamais appelée — `this.rewards` hardcodé** | `{ success, data: [...] }` | ❌ non branché |
| 22 | Rejoindre groupe sport | `POST /sport-groups/:id/join` | ✅ | ✅ + role=patient | Non visible dans `renderVals` — pas de bouton "Rejoindre" wired | `{ success, data: {...} }` | ⚠️ route OK, bouton mort |
| 23 | Chat messages (lecture) | `GET /chat/:channel/messages` | ✅ | ✅ + role=patient | — | `{ success, data: messages }` | ✅ (route ouverte, role=patient autorisé) |
| 24 | Chat messages (envoi) | `POST /chat/:channel/messages` | ✅ | ✅ + role=patient | — | `{ success, data: message }` | ✅ |
| 25 | Changer mot de passe | `POST /patients/change-password` | ✅ | ✅ | — | `{ success, message }` | ✅ |

---

## Mocks hardcodés à remplacer

| # | Valeur mockée | Ligne dashboard | Valeur actuelle hardcodée | Route réelle à brancher | Impact |
|---|---|---|---|---|---|
| M1 | QR dossier médical | 2236 | `'BOLAMU:BLM-4821-7763'` (ID fictif) | Utiliser `this._patientId` issu du profil API, format `'BOLAMU:' + membreId` | QR dossier affiché ne correspond à aucun patient réel |
| M2 | QR urgence | 2909 | `'BOLAMU:URGENCE:BLM-4821-7763:O+:Pénicilline'` (tout fictif) | Composer depuis `this._patientId` + `this._constantes.groupe_sanguin` + `this._constantes.allergies` | QR urgence inutilisable — données fausses affichées au médecin |
| M3 | Compteur de pas | 2226 | `steps: Math.round(7432 * e)` (animation vers 7432) | `POST /patients/activities/steps` (route inexistante) | Toujours 7 432 pas affichés — jamais réel |
| M4 | Récompenses (rewards) | 2200–2206 | 5 entrées fixes : MTN 5000F, Airtel 1Go, Daffé, Station, Salle sport | `GET /zora/rewards` (route existante — jamais fetchée) | Les vraies récompenses DB ne sont jamais affichées |
| M5 | Médecins dans modal RDV | 1766 | `Dr. Marc Ntolo`, `Dr. Alice Bekono`, `Dr. Pierre Massamba` | `GET /api/v1/doctors` (route existante — jamais appelée) | Patient ne peut réserver qu'avec des médecins fantômes |
| M6 | Créneaux dans modal RDV | 1768 | `09h00 / 10h30 / 14h30 / 16h00` (toujours les mêmes) | `GET /api/v1/appointments/slots/:doctor_id?date=` (route existante — jamais appelée) | Créneau choisi ne correspond pas à la disponibilité réelle |
| M7 | Jeux (gamesList) | 2188–2193 | 4 jeux fixes (scratch, wheel, chest, quiz) | Config `GET /zora/games/config` fetchée mais jamais utilisée pour `this.gamesList` | Jeux affichés ignorent la config backend (activés/désactivés, gains) |
| M8 | Quiz data | 2199 | 1 question fixe sur l'hydratation (réponse hardcodée = index 2) | DB questions quiz via `POST /zora/games/play` qui gère ses propres questions | Quiz toujours identique — jamais pioche en DB |
| M9 | Établissements réseau | 2207–2219 | 11 étabs hardcodés (cliniques, pharmacies, labos) | Aucune route backend Map/réseau (voir section suivante) | Réseau partenaires figé, ne reflète pas les établissements réels |
| M10 | Zora initial (avant API) | 2226 | `zora: Math.round(1250 * e)` | `GET /zora/balance` (appel OK, écrase la valeur) | Clignote à 1250 avant la vraie valeur — visuellement faux pendant ~1.2s |
| M11 | Défis countdown | 2233 | `defi1: now + 4h32min`, `defi2: now + 23h` | Aucune route défis | Les défis ont toujours la même durée à chaque rechargement |

---

## Routes manquantes backend

Ces routes sont attendues par le dashboard mais n'existent pas dans `src/routes/`.

| Route | Méthode | Fonctionnalité | Boutons concernés |
|---|---|---|---|
| `/patients/activities/steps` | POST | Tracking 10 000 pas | "En cours" (ligne 1202) |
| `/patients/activities/workout` | POST | Séance sport 30min | "Démarrer" (ligne 1214) |
| `/patients/activities/meditation` | POST | Méditation/respiration | "Commencer" (ligne 1226) |
| `/patients/activities` | GET | Historique activités | — |
| `/patients/activities/sleep` | POST | Suivi sommeil | "Suivre mon sommeil" (ligne 1255) |
| `/patients/activities/sleep-schedule` | POST | Coucher régulier 5j | "Activer" (ligne 1267) |
| `/patients/nutrition/journal` | POST | Journal alimentaire | "Remplir" (ligne 1284) |
| `/patients/nutrition/water` | POST | Hydratation 6 verres | "Suivre" (ligne 1296) |
| `/patients/referral` | POST | Parrainage patient | "Inviter via WhatsApp" (ligne 1408) |
| `/reports/patient/:phone/pdf` | GET | Téléchargement PDF résultats | "Télécharger le PDF" (ligne 1826) |
| `/zora/cashout` | POST | Conversion Zora → MoMo Cash | "Convertir en Zora Cash" |
| `/sport-groups` | POST | Créer un groupe | "Créer un groupe" |
| `/map/establishments` | GET | Liste étabs pour carte réseau | Carte réseau partenaires |
| `/patients/defis` | GET | Défis actifs + expiry réels | Compteurs défis |

---

## Incompatibilités de format

### ❌ CRITIQUE — `/api/v1/streaks/me`

**Dashboard attend :**
```javascript
if (d.success) {
  this._streak = d.current_streak || 0;
  this._longestStreak = d.longest_streak || 0;
}
```

**Backend retourne** (`streak.controller.js` → `streak.service.js:getStreak`) :
```json
{
  "current_streak": 5,
  "longest_streak": 12,
  "last_activity_date": "2026-06-22",
  "next_bonus_at": 7
}
```
Pas de champ `success`. → `d.success` est `undefined` → falsy → bloc jamais exécuté → `streakTxt` affiche toujours `"0 jour d'affilée"`.

**Correction minimale** : ajouter `success: true` dans le return de `getStreak()` (`src/services/streak.service.js` lignes ~144 et ~159).

---

### ⚠️ MINEUR — `/api/v1/patients/profil` : champ `plan_name` absent

**Dashboard attend** (ligne 1957) :
```javascript
this._patientAbonnement = d.data.plan_name || 'Bolamu Essentiel';
```

**Backend retourne** (`patient.routes.js:52`) :
```sql
SELECT phone, full_name, gender, birth_date, city, neighborhood, bolamu_id, is_active, created_at
FROM users WHERE phone = $1 AND role = 'patient'
```
`plan_name` n'est pas dans la table `users`. Il faut une jointure avec `subscriptions`.

→ Retombe sur le défaut 'Bolamu Essentiel' — acceptable si la route `/patients/subscription` réussit ensuite (elle override `this._abonnement`).

---

### ⚠️ MINEUR — `/api/v1/sport-groups` : `is_member` toujours `false`

La route `GET /sport-groups` n'a pas `authMiddleware`. Le dashboard envoie un header `Authorization: Bearer ...` mais Express ne le parse jamais. `req.user?.phone` → `undefined` → `phone = null` dans la requête → le LEFT JOIN ne trouve jamais de membre → `is_member = false` pour tous.

**Correction** : ajouter `authMiddleware` optionnel sur la route GET, ou extraire le JWT manuellement sans bloquer si absent.

---

### ❌ CRITIQUE — Modal RDV : bouton Confirmer sans appel API

**Ligne 1771 :**
```html
<button onclick="{{ closeModal }}" style="...">Confirmer</button>
```

`closeModal` → `this.setState({ modal: false })`. Aucun `POST /api/v1/appointments/book` n'est jamais émis. La réservation est totalement impossible malgré le formulaire affiché.

De plus :
- La liste de médecins (ligne 1766) est hardcodée → pas de `doctor_id` réel passable à l'API
- Les créneaux (ligne 1768) sont hardcodés → pas de `time` réel

**Correction** : créer un handler `async bookRdv()` dans le composant DCLogic qui lise les valeurs du formulaire et appelle `POST /api/v1/appointments/book` avec `{ patient_phone, doctor_id, date, time }`.

---

## Appels API dupliqués

| Route | Appels | Cause | Recommandation |
|---|---|---|---|
| `GET /zora/balance` | 2 (lignes 1964 et 2048) | Second appel avec `?phone=` pour récupérer le palier — mais le backend ignore le query param `phone` et utilise `req.user.phone` | Fusionner en un seul appel, lire `tier`/`next_tier`/`points_to_next` depuis la première réponse |

---

## Synthèse — Score de cohérence

| Catégorie | OK | Avertissement | Cassé |
|---|---|---|---|
| Routes existantes | 16/21 | 3 | 2 |
| Format réponse compatible | 14/16 vérifiés | 1 | 1 |
| Boutons wired avec vraie API | 10 | 3 | 3 |
| Valeurs dynamiques réelles (vs mock) | 8 | 5 | 3 |

**Score global : ~65 % de cohérence production.**  
Les 35 % restants sont bloquants (RDV jamais réservé), incorrects (streak toujours 0, QR urgence fictif) ou simplement absents (récompenses réelles, défis, activités).

---

## Priorités de correction recommandées

| Priorité | Correction | Effort | Impact |
|---|---|---|---|
| P0 | Ajouter `success: true` dans `getStreak()` return | < 5 min | Streak visible |
| P0 | Créer handler `bookRdv()` + fetch doctors + fetch slots dans modal | 2h | RDV fonctionnel |
| P0 | QR urgence : composer depuis constantes réelles patient (`this._patientId` + `this._constantes`) | 20 min | QR urgence utile |
| P1 | Fetcher `GET /zora/rewards` dans `componentDidMount` pour peupler `this.rewards` | 30 min | Vraies récompenses |
| P1 | QR dossier : utiliser `this._patientId` réel | 5 min | QR dossier cohérent |
| P1 | Fusionner les 2 appels `GET /zora/balance` | 10 min | Perf réseau |
| P1 | Ajouter authMiddleware optionnel sur `GET /sport-groups` | 10 min | `is_member` correct |
| P2 | Fetcher `GET /doctors` + `GET /appointments/slots` dans la modal RDV | 1h | Médecins et créneaux réels |
| P2 | Utiliser `this._gamesConfig` pour `this.gamesList` | 30 min | Config jeux depuis DB |
| P3 | Implémenter les routes activités/nutrition/referral/pdf/cashout | Long | Section Gagner complète |
