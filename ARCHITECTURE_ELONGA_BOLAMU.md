# ARCHITECTURE ELONGA BOLAMU — DOCUMENT UNIQUE
### Événements santé & bien-être — cycle de vie, inscriptions, check-in, CRON, popup, publication au feed, page d'accueil, écrans frontend, intégration projet

**Version 5.0 — Remplace la v4.0.** Les 6 derniers points ouverts (check-in QR, ville, annulation, piliers, template WhatsApp, pondération Score Bolamu) sont désormais tranchés. Il ne reste plus que des **points d'audit technique** à faire avant/pendant l'implémentation (numéro de migration, contenu exact d'un template, nom réel d'une table) — plus aucune décision produit en attente.

Ce document dépend de `ARCHITECTURE_SOCIAL_COMMUNAUTE_BOLAMU.md` pour : le système de profil/avatar (organisateur), le système de posts (publication auto au feed), le pattern de popup en bottom sheet, et les règles invariantes générales (soft delete, `normalizePhone()`, anti-fraude sociale, sécurité JWT).

**Règle d'or : rien n'est « fait » tant que sa preuve réelle n'est pas visible (section 14).**

---

## 0. PHILOSOPHIE

Elonga est le moteur opérationnel de la stratégie de prévention santé de Bolamu — pas un simple catalogue d'événements. Chaque événement doit servir un objectif de prévention (nutrition, activité physique, dépistage, santé mentale, etc.). Contrairement aux interactions purement sociales du doc Social & Communauté, tout ce qui touche à Elonga peut déclencher un vrai gain Zora — ce qui impose une rigueur anti-fraude stricte (section 8) qu'aucune autre partie de l'app n'a.

✅ **Décidé** : la liste des piliers de prévention est figée à 4 valeurs (`activite`, `nutrition`, `anti_infectieux`, `sante`) — pas d'extension prévue pour l'instant. Une contrainte `CHECK` peut donc être ajoutée en base (section 3.1).

✅ **Décidé** : la participation à un événement doit compter dans le Score Bolamu (voir section 0bis.6 pour le principe d'intégration).

---

## 0bis. AUDIT DU FRONTEND RÉEL (dashboard.html) — remplace les suppositions par des faits vérifiés

### 0bis.1 Navigation réelle — pas d'onglet Elonga dédié (confirmé)

Les événements Elonga apparaissent à deux endroits dans le dashboard patient existant, jamais dans un onglet séparé :

| Emplacement | Élément DOM | Contenu |
|---|---|---|
| Section Accueil (`#sec-accueil`) | `#events-list` | Carrousel « Événements près de chez vous » |
| Section Accueil (`#sec-accueil`) | `#myreg-list` / `#myreg-empty` | « Mes événements » — inscriptions de l'utilisateur |
| Onglet Gagner → sous-onglet Sport (`#sportTab`) | `#events-list-2` | Même liste d'événements |
| Onglet Gagner → sous-onglet Sport (`#sportTab`) | `#events-map` + `#eventplaces-list` | Carte Leaflet + liste de lieux |

Conséquence : il faut étendre les deux carrousels existants (alimentés par la même fonction `A.renderEvents()`), sans changer leur emplacement (voir section 12).

### 0bis.2 Taxonomie des piliers — figée à 4 valeurs ✅

```js
pilierMap = { activite: 'Activité physique', nutrition: 'Nutrition', anti_infectieux: 'Anti-infectieux', sante: 'Santé' }
tintMap   = { activite: '#00C9A7',            nutrition: '#FF6B35', anti_infectieux: '#003FB1',        sante: '#F5A623' }
```

**✅ Décidé** : ces 4 valeurs sont considérées complètes pour l'instant. Aucune extension immédiate. La colonne réelle côté API s'appelle `pillar` (anglais, singulier) — la contrainte `CHECK` en section 3.1 se base sur cette liste fermée.

### 0bis.3 Champs réels de l'API `/api/v1/events` — corrige le schéma supposé

| Champ API réel | Ce que le doc supposait à tort (v1–v3) |
|---|---|
| `pillar` | `pilier` / `categorie` |
| `location_name` | `address` + `city` séparés |
| `cover_image_path` | `image_url` |
| `zora_reward` | pas de nom fixé |
| `places_restantes` (calculé) | `current_participants` dénormalisé |
| `latitude` / `longitude` | `lat` / `lng` génériques |
| `starts_at` | inchangé, confirmé |

⚠️ **Audit obligatoire non résolu** : aucune colonne `city` structurée n'apparaît dans la réponse API actuelle — seulement `location_name` en texte libre. Comme la Ville est désormais une **liste fermée** (décision 11.1), il faut vérifier en base si `city` existe déjà en plus de `location_name`, ou si elle doit être ajoutée par la migration (section 3.1). Ne pas supposer son existence.

### 0bis.4 Inscription — déjà en grande partie implémentée

Le frontend appelle déjà avec succès `POST /api/v1/events/:id/register`, `DELETE /api/v1/events/:id/register`, `GET /api/v1/events/my/registrations` (retourne déjà `session_code`). Une table d'inscriptions existe donc déjà en production. **Auditer d'abord son nom et ses colonnes réelles**, puis migrer/étendre plutôt que créer en double (ne pas recréer `event_registrations` en supposant qu'elle est neuve).

### 0bis.5 Check-in : passage au QR scannable ✅

**✅ Décidé** : on abandonne l'affichage en simple texte du `session_code` (`renderMyReg()` actuel) au profit d'un **vrai QR scannable**, pour la robustesse anti-fraude (empêche la transmission du code à distance). C'est un changement de portée réel par rapport à l'existant :

- Un composant de génération QR doit être ajouté côté « Mes événements » (encodage défini en section 3.4)
- Un composant de scan doit être construit ou étendu côté créateur (section 11.4, en réutilisant le composant scanner animateur existant après audit)
- Le bouton « Afficher mon QR » du popup (section 7) devient la cible réelle à livrer, pas une option distante

### 0bis.6 Score Bolamu — vrai endpoint identifié, pondération à intégrer avec bon sens ✅

`GET /api/v1/patients/score-bienetre` → `{score, tendance, label}`, déjà branché sur l'anneau SVG `#score-ring` et le texte `#scoreBolamu` de la section Accueil.

**✅ Principe validé** : la participation Elonga doit être intégrée « dans la normalité et le bon sens des choses » — c'est-à-dire comme un facteur supplémentaire cohérent avec la logique existante de `scoreBolamu.service.js`, sans écraser ni déséquilibrer les facteurs déjà en place (abonnement, consultations, etc. — à confirmer par lecture du fichier réel).

⚠️ **Audit obligatoire avant implémentation** : Claude Code doit lire le contenu réel de `scoreBolamu.service.js` pour identifier les facteurs et poids existants, **avant** de proposer un chiffre précis pour le facteur Elonga. Aucun pourcentage arbitraire ne doit être fixé sans cette lecture — ce n'est plus une question de choix produit mais d'intégration technique cohérente.

---

## 1. CONTRAT D'INTÉGRATION AVEC LE PROJET EXISTANT

### 1.1 Audit obligatoire avant tout code (bloquant)

Avant d'écrire une seule ligne, Claude Code doit confirmer par lecture réelle du repo :

1. Le prochain numéro de migration libre (dernière connue : `047_animateurs.sql` — vérifier s'il y en a eu depuis)
2. Le nom exact du fichier de routes événements existant s'il y en a déjà un
3. Le nom exact du fichier service existant pour les événements animateur, avant de créer un doublon
4. L'existence d'un endpoint d'upload photo générique déjà utilisé par pharmacie/laboratoire/animateur, pour le réutiliser
5. **(nouveau)** L'existence réelle d'une colonne `city` structurée sur `elonga_events` (section 0bis.3)
6. **(nouveau)** Le nom réel et les colonnes de la table d'inscriptions déjà en prod (section 0bis.4)
7. **(nouveau)** Le contenu réel de `scoreBolamu.service.js` — facteurs et poids existants (section 0bis.6)
8. **(nouveau)** Le contenu exact des variables de `confirmation_checkin` et `rappel_evenement` (section 4)

### 1.2 Fichiers à étendre vs fichiers à créer

| Élément | Action | Justification |
|---|---|---|
| Routes événements | Étendre le fichier existant s'il y en a un, sinon créer `elonga.routes.js` | Éviter la duplication déjà rencontrée sur notifications |
| Migration `event_registrations` + colonnes `elonga_events` | Créer une nouvelle migration, numéro = dernier + 1 (audité en 1.1) | Ne jamais réutiliser un numéro existant |
| Migration `posts_type_check` (ajout `'event'`) | Étendre via `ALTER TABLE`, jamais recréer la table | Cohérent avec la contrainte déjà en prod |
| CRON | Ajouter au runner CRON existant | Ne pas créer un second système parallèle |
| Upload photo | Réutiliser l'endpoint existant après audit | Cohérence avec le sprint de correction photo récent |
| Composant scan QR | Étendre le composant animateur existant après audit, sinon créer | Éviter deux composants caméra redondants |
| **Composant génération QR (nouveau, section 0bis.5)** | Créer, aucun équivalent existant identifié | Nécessaire pour le check-in QR décidé |

### 1.3 Sécurité — pattern IDOR/JWT (rappel obligatoire)

Toutes les routes Elonga qui touchent à une identité doivent suivre cette règle sans exception :

- `POST /events/:id/register` → le `phone` vient de `req.user.phone`, jamais du body ou de la query
- `POST /events/:id/checkin` → le `checked_in_by` vient de `req.user.phone`
- `GET /mes-events` → filtre sur `req.user.phone`, jamais sur un phone passé en query
- `GET /mes-events/:id/registrations` → doit vérifier que `elonga_events.created_by === req.user.phone` (ou rôle admin) avant de renvoyer les inscrits — sinon IDOR potentielle (voir T16, section 14)

### 1.4 Cohérence frontend — DCLogic abandonné (rappel obligatoire)

Le dashboard patient utilise du JS vanilla (`A.state.panel`). Tout écran Elonga doit suivre ce même pattern, jamais réintroduire DCLogic.

---

## 2. CYCLE DE VIE (6 états)

```
DRAFT → PENDING_VALIDATION → PUBLISHED → ACTIVE → COMPLETED → ARCHIVED
```

| État | Acteur | Déclencheur | Visible patient | Inscription | Check-in | Zora |
|---|---|---|---|---|---|---|
| draft | Créateur (animateur ou adhérent) | crée | Non | Non | Non | Non |
| pending_validation | Système | après soumission | Non | Non | Non | Non |
| published | Admin | valide | Oui (liste + feed) | Oui | Non | Non |
| active | CRON (section 5) | à `starts_at` | Oui (LIVE) | Oui (si places) | Oui | Non |
| completed | CRON (section 5) | à `ends_at` | Oui (historique) | Non | Non | Oui (auto) |
| archived | Admin | manuel, rejet, ou annulation | Non | Non | Non | Non |

### 2.1 Les adhérents peuvent créer un événement

Un adhérent (patient) peut créer un événement Elonga, au même titre qu'un animateur. Aucune différence de traitement dans le cycle de validation.

### 2.2 Autorité de check-in

Réservé au propriétaire (`created_by`) ou à l'admin. Le crédit Zora reste conditionné à un scan réel.

### 2.3 Rejet par l'admin ✅

**✅ Décidé** : passage à `archived` + `rejection_reason` **avec notification WhatsApp au créateur** (Option B).

### 2.4 Annulation d'un événement déjà publié avec des inscrits ✅

**✅ Décidé** — les 3 règles sont validées telles quelles :

1. Toutes les lignes `event_registrations` liées passent à `status='cancelled'`
2. Aucun crédit Zora n'est jamais accordé après l'annulation ; les crédits déjà passés (`zora_credited=true` avant l'annulation) ne sont **pas** rétractés
3. Notification WhatsApp automatique à tous les inscrits (`status IN ('registered','checked_in')`) — réutilise `rappel_evenement` en mode « annulation » si son contenu le permet (audit requis, section 4), sinon nouveau template Meta à soumettre (délai 24–48h à anticiper)

---

## 3. SCHÉMA CIBLE

### 3.1 Table `elonga_events` (extension)

```sql
ALTER TABLE elonga_events
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'draft'
    CHECK (status IN ('draft','pending_validation','published','active','completed','archived')),
  ADD COLUMN IF NOT EXISTS pillar VARCHAR(30) DEFAULT NULL
    CHECK (pillar IN ('activite','nutrition','anti_infectieux','sante')),
  ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS current_participants INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS address VARCHAR(300) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT NULL, -- 🔍 auditer d'abord si déjà présente (0bis.3)
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL,
  ADD CONSTRAINT current_participants_nonneg CHECK (current_participants >= 0);

CREATE INDEX IF NOT EXISTS idx_elonga_events_status ON elonga_events(status);
CREATE INDEX IF NOT EXISTS idx_elonga_events_starts_at ON elonga_events(starts_at);
CREATE INDEX IF NOT EXISTS idx_elonga_events_city ON elonga_events(city);
```

> La colonne `city` doit être alimentée depuis la **même liste fermée que `users.city`** (décision 11.1) — auditer la source de cette liste (table de référence ou enum codé en dur côté frontend) avant de créer le champ formulaire.

### 3.2 Table `event_registrations`

```sql
CREATE TABLE IF NOT EXISTS event_registrations (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES elonga_events(id),
  phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  session_code VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered','checked_in','cancelled')),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  checked_in_at TIMESTAMPTZ DEFAULT NULL,
  checked_in_by VARCHAR(20) DEFAULT NULL,
  reminder_sent_at TIMESTAMPTZ DEFAULT NULL,
  zora_credited BOOLEAN DEFAULT FALSE,
  zora_credited_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(event_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_phone ON event_registrations(phone);
```

⚠️ Avant de créer cette table : auditer si une table équivalente existe déjà (section 0bis.4) et étendre plutôt que dupliquer.

### 3.3 Concurrence sur les places limitées

```sql
BEGIN;
SELECT current_participants, max_participants
  FROM elonga_events
  WHERE id = $1
  FOR UPDATE;
-- si max_participants IS NOT NULL AND current_participants >= max_participants → ROLLBACK, retourner 409 "Complet"
INSERT INTO event_registrations (event_id, phone, session_code) VALUES ($1, $2, $3);
UPDATE elonga_events SET current_participants = current_participants + 1 WHERE id = $1;
COMMIT;
```

### 3.4 Génération et format du `session_code` — support du QR décidé

- Généré côté backend à l'inscription, jamais côté frontend
- Format : `crypto.randomBytes(16).toString('hex')`
- QR encodé : `{"type":"event_checkin","registration_id":<id>,"session_code":"<code>"}`
- Check-in vérifie : `registration_id` existe, `session_code` correspond, `status='registered'`, événement `active`. Toute non-correspondance → 400.

---

## 4. RATTACHEMENT WHATSAPP ✅

| Moment | Template à utiliser | État |
|---|---|---|
| Inscription confirmée | **✅ `confirmation_checkin`** (décidé — réutilisation validée) | ⚠️ Vérifier le contenu exact des variables avant câblage (audit non bloquant pour la conception, bloquant pour l'implémentation) |
| Rappel avant l'événement (J-1) | `rappel_evenement` (déjà créé, UTILITY) | Cron à ajouter (5.3) |
| Check-in effectué | `confirmation_checkin` | Réutilisable a priori |
| Annulation d'un événement (2.4) | `rappel_evenement` en mode « annulation » si le contenu le permet | Sinon nouveau template à soumettre (délai Meta 24–48h) |

---

## 5. AUTOMATISATION — CRON

⚠️ Audit requis : ajouter ces jobs au runner CRON existant, ne pas créer un second système parallèle.

### 5.1 Job — Activation
```sql
UPDATE elonga_events
SET status = 'active'
WHERE status = 'published' AND starts_at <= NOW();
```
Fréquence : toutes les 5 minutes.

### 5.2 Job — Complétion + crédit Zora
```sql
UPDATE elonga_events
SET status = 'completed', completed_at = NOW()
WHERE status = 'active' AND ends_at <= NOW();
```
Puis pour chaque `event_registrations` avec `status='checked_in' AND zora_credited=false` : `awardZora()` + `zora_credited=true`. Fréquence : toutes les 5 minutes.

### 5.3 Job — Rappel WhatsApp
Envoi de `rappel_evenement` aux inscrits (`status IN ('registered','checked_in')`) d'événements dont `starts_at` tombe dans les prochaines 24h, une seule fois par inscription (`reminder_sent_at`). Fréquence : une fois par jour. Fichier cible : `cron/elongaEvents.cron.js`.

---

## 6. ROUTES ÉVÉNEMENTS

| Méthode | Route | Auth |
|---|---|---|
| GET | `/api/v1/events?page=&limit=` | patient (published/active, paginé) |
| GET | `/api/v1/events/nearby?page=&limit=` | patient (filtré `users.city`, paginé) |
| GET | `/api/v1/events/:id` | patient |
| GET | `/api/v1/events/:id/participants` | patient |
| POST | `/api/v1/events/:id/register` | patient — phone extrait de `req.user.phone` |
| DELETE | `/api/v1/events/:id/register` | patient |
| POST | `/api/v1/events/:id/checkin` | propriétaire / admin — via scan QR (décidé) |
| POST | `/api/v1/events` | patient OU animateur |
| GET | `/api/v1/mes-events?page=&limit=` | patient OU animateur — filtré `req.user.phone` |
| GET | `/api/v1/mes-events/:id/registrations` | créateur — vérifier `created_by === req.user.phone` |
| GET | `/api/v1/animateur/checkins/today` | animateur |
| GET | `/api/v1/admin/events/pending?page=&limit=` | admin |
| PATCH | `/api/v1/admin/events/:id/publish` | admin |
| PATCH | `/api/v1/admin/events/:id/reject` | admin — archivage + notification WhatsApp (décidé, 2.3) |
| PATCH | `/api/v1/admin/events/:id/cancel` | admin — effets de bord décidés (2.4) |
| PATCH | `/api/v1/admin/events/:id/activate` | admin |
| PATCH | `/api/v1/admin/events/:id/complete` | admin |
| GET | `/api/v1/admin/checkins/history?page=&limit=` | admin |

`POST /api/v1/animateur/events` (ancienne route) reste acceptée en alias de `POST /api/v1/events`.

---

## 7. POPUP ÉVÉNEMENT (bottom sheet)

| Statut · inscription | Bouton (couleur) | Déclenche | Résultat |
|---|---|---|---|
| published · non inscrit, places dispo | Participer (vert) | `POST /events/:id/register` | `session_code` généré, bouton → bleu |
| published · complet, non inscrit | Complet (gris, désactivé) | — | aucune |
| published · inscrit | Inscrit — En attente (bleu, désactivé) | — | aucune |
| active · inscrit | **Afficher mon QR** (orange) + LIVE | ouvre le modal QR (décidé, 0bis.5) | QR affiché, scannable par le créateur |
| completed | Terminé (gris) | — | historique Zora crédité |

---

## 8. RÈGLE ANTI-FRAUDE

Aucun bouton ne permet à un participant de se déclarer présent. Le crédit Zora provient exclusivement d'un scan QR réel par le propriétaire/admin, ou d'une validation admin manuelle documentée.

---

## 9. PUBLICATION AUTOMATIQUE AU FEED

### 9.1 Migration préalable
```sql
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_type_check;
ALTER TABLE posts ADD CONSTRAINT posts_type_check
  CHECK (type IN ('manual','system','story','event'));
```

### 9.2 Mécanisme
À `pending_validation → published`, post `type='event'` créé automatiquement (`metadata: { event_id: 8 }`). Le frontend lit `post.metadata.event_id` pour rouvrir le popup. Tri chronologique décroissant, sans filtre géographique.

---

## 10. PAGE D'ACCUEIL — « ÉVÉNEMENTS PRÈS DE CHEZ VOUS »

Filtre `elonga_events.city = users.city`, tri `starts_at` croissant, fallback toutes villes avec `city_matched:false` si vide. Réponse paginée.

```jsonc
{
  "city_matched": true,
  "page": 1, "limit": 10, "total": 23,
  "items": [ { "id":8, "title":"…", "starts_at":"…", "city":"Brazzaville", "image_url":"…",
    "current_participants":23, "organizer": { "display_name":"Marie", "avatar_url":"…", "role":"animateur" } } ]
}
```

---

## 11. ÉCRANS FRONTEND

### 11.1 Formulaire de création d'événement

| Champ | Type | Validation |
|---|---|---|
| Titre | texte | requis, max 150 |
| Description | texte long | requis |
| starts_at | datetime | requis, futur |
| ends_at | datetime | requis, > starts_at |
| Adresse | texte | requis |
| **Ville** | **✅ liste fermée, alignée `users.city`** | requis |
| max_participants | nombre | optionnel, vide = illimité |
| Photo | upload | optionnel, endpoint existant réutilisé |

Soumission → `POST /events` → `pending_validation`. Message explicite de non-visibilité immédiate.

### 11.2 Écran « Mes événements »

Liste triée par date de création décroissante. Badge de statut, `current_participants/max_participants`, bouton « Voir mes inscrits » si publié/actif/terminé, mention « En attente de validation » si `pending_validation`, motif si `archived` avec `rejection_reason`. Bouton **« Afficher mon QR »** pour les inscriptions actives (0bis.5).

### 11.3 Écran admin — validation

Cartes des événements `pending_validation` : titre, dates, organisateur, ville, description. Boutons Valider (`PATCH /publish`) et Refuser (`PATCH /reject` — archivage + notification WhatsApp, décidé).

### 11.4 Écran de scan QR côté créateur

⚠️ Audit requis : étendre le composant scanner animateur existant plutôt qu'en créer un nouveau.

Flux : « Mes événements » → événement `active` → « Scanner les arrivées » → caméra → lecture QR → `POST /checkin` avec `registration_id` + `session_code` → confirmation immédiate (nom + ✅) ou erreur explicite.

---

## 12. NAVIGATION — confirmé par audit réel

Pas d'onglet Elonga dédié. Les événements restent affichés aux deux emplacements déjà existants (section 0bis.1). Toute nouvelle fonctionnalité doit s'insérer dans ces emplacements existants ou dans un panneau plein écran du même type que `#event-panel`/`#club-panel` — jamais via un nouvel onglet top-level ou bottom-nav.

---

## 13. PHOTOS

| Emplacement | Source | Valeur |
|---|---|---|
| Carte/fiche/popup événement | `elonga_events.image_url` | `/images/landing/<fichier>` |
| Badge organisateur | `users.avatar_url` | image ou fallback initiales |
| Avatars participants | `users.avatar_url` | image ou fallback initiales |

---

## 14. SYSTÈME DE PREUVE & PLAN DE TEST

| # | Test | Type | Critère de réussite | Preuve réelle | ✅ |
|---|---|---|---|---|---|
| T1 | Migrations exécutées (numéro confirmé par audit 1.1.1) | SQL | tables/colonnes existent | | ☐ |
| T1bis | `posts_type_check` accepte `'event'` | SQL | INSERT réussit | | ☐ |
| T2 | Adhérent crée un événement | HTTP+SQL | 201 + `pending_validation` | | ☐ |
| T3 | Admin valide | HTTP+SQL | 200 + `published` + post feed créé | | ☐ |
| T4 | Popup affiche organisateur correct | Navigateur+HTTP | badge cohérent | | ☐ |
| T5 | Double inscription même patient/événement | HTTP | 2ᵉ tentative rejetée | | ☐ |
| T6 | Adhérent-créateur scanne son propre événement | HTTP+SQL | `checked_in_at` renseigné | | ☐ |
| T7 | `session_code` invalide/déjà utilisé | HTTP | rejet explicite 400 | | ☐ |
| T8 | CRON active à `starts_at` | SQL | `status='active'` sans action manuelle | | ☐ |
| T9 | CRON complète + crédite Zora | SQL | `zora_credited=true` + ligne `zora_ledger` | | ☐ |
| T10 | Widget nearby filtre par ville | HTTP | résultats = `users.city` du patient testé | | ☐ |
| T11 | Fallback sans événement dans la ville | HTTP | `city_matched:false` | | ☐ |
| T12 | Post feed ouvre le bon popup | Navigateur | popup identique à l'ouverture directe | | ☐ |
| T13 | Aucun bouton d'auto-déclaration | Code+Navigateur | grep négatif confirmé | | ☐ |
| T14 | Formulaire rejette date passée | Navigateur+HTTP | erreur affichée, pas d'insertion | | ☐ |
| T15 | « Mes événements » affiche tous les statuts réels | Navigateur+SQL | cohérent avec la base | | ☐ |
| T16 | IDOR — `GET /mes-events/:id/registrations` par un non-propriétaire | HTTP | 403, jamais les données d'un autre créateur | | ☐ |
| T17 | Deux inscriptions simultanées sur la dernière place | HTTP concurrent | une seule réussit, l'autre reçoit 409 | | ☐ |
| T18 | Annulation d'un événement avec inscrits | HTTP+SQL | toutes les inscriptions passent à `cancelled`, aucun nouveau crédit Zora | | ☐ |
| T19 | `phone` dans register/checkin vient bien du JWT, pas du body | Code review+HTTP | tentative de forcer un autre phone en body échoue | | ☐ |
| **T20** | **(nouveau)** QR de check-in scanné avec succès génère `checked_in_at` | HTTP+Navigateur | scan réel → crédit conditionné | | ☐ |
| **T21** | **(nouveau)** Rejet admin déclenche bien la notification WhatsApp | HTTP+WhatsApp | message reçu avec `rejection_reason` | | ☐ |

**Règle de push : aucun `git push` tant que les preuves ne sont pas collées et vertes.**

---

## 15. ORDRE D'IMPLÉMENTATION

1. **Audit obligatoire** (section 1.1 + 0bis) — numéro de migration, fichiers existants, endpoint upload, composant scanner, existence réelle d'une colonne `city` structurée, nom réel de la table d'inscriptions déjà en prod, contenu de `scoreBolamu.service.js`, contenu exact de `confirmation_checkin`.
2. **Toutes les décisions produit sont tranchées** ✅ : rejet admin, annulation, navigation, Score Bolamu (principe), piliers, ville, check-in QR, template WhatsApp inscription. Il ne reste que des audits techniques (liste ci-dessus).
3. Migrations (T1, T1bis).
4. Backend — inscriptions & check-in QR avec verrou de concurrence (T2, T5, T6, T7, T17, T19, T20).
5. Backend — CRON (T8, T9) + rappel WhatsApp (5.3).
6. Backend — création, validation admin, rejet avec notif (T21), annulation, feed auto, nearby paginé (T3, T10, T11, T12, T18).
7. Sécurité — vérification IDOR sur toutes les routes propriétaire (T16).
8. Frontend — popup, formulaire (avec ville en liste fermée), mes-événements, écran admin, génération + scan QR, intégration navigation (T4, T13, T14, T15).
9. Intégration Score Bolamu — après lecture de `scoreBolamu.service.js`, ajout du facteur Elonga pondéré de façon cohérente.
10. Vérification anti-fraude finale (T13) avant tout push.

---

*Document unique de référence — Elonga Bolamu v5.0. S'appuie sur `ARCHITECTURE_SOCIAL_COMMUNAUTE_BOLAMU.md`. Une affirmation sans preuve n'est pas une réalisation.*
