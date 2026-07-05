# ARCHITECTURE_BOLAMU_OVERVIEW.md — Document maître (BIM Bolamu)

> Ce document est la carte de navigation unique de la plateforme Bolamu. Il ne remplace aucun des 13 documents d'architecture existants — il explique comment ils s'articulent et comment une donnée traverse réellement les 3 couches (base → backend → frontend) et entre acteurs.
> Toute affirmation ci-dessous est ancrée dans le code lu (`src/server.js`, `src/middleware/auth.middleware.js`, `src/controllers/auth.controller.js`, `database/migrations/`, `migrations/`) et dans les 13 documents listés en §4. Quand un document contredit le code, l'écart est signalé explicitement — pas de réconciliation silencieuse.
> **Nature des sources** : certains documents cités décrivent ce qui est **réellement construit** (grounded), d'autres sont des **spécifications cibles** (vision produit, partiellement ou pas encore codées), un est **daté et partiellement obsolète**. Cette distinction est faite explicitement en §4 — la confondre serait le risque principal de lecture de ce document maître.

---

## 0. Vision produit et modèle économique

Bolamu est une plateforme de santé pour Brazzaville/Pointe-Noire, opérée par **NBA GESTION SARLU** (RCCM `CG-BZV-01-2025-B13-00178`, gérant M. Bouiti Tchitchiele Natsy, domaine `bolamu.co`). Concrètement, un adhérent paie un abonnement mensuel fixe et accède, sans avance de frais ni remboursement, à un réseau de médecins, pharmacies et laboratoires partenaires dans sa zone. En parallèle, chaque acte de santé/bien-être génère des points de fidélité (Zora), échangeables chez des commerçants partenaires, et un volet prévention (Elonga) organise des événements santé sur le terrain.

**Ce que Bolamu n'est pas** : une assurance. `public/cgu.html` Article 3 pose la distinction explicitement avec le régime CIMA (voir tableau détaillé dans `ARCHITECTURE_SECURITE_REGLEMENTAIRE_BOLAMU.md` §0) : pas de transfert de risque, pas de remboursement, pas de tarification actuarielle, pas de capital réglementaire requis. Le modèle est celui du **Direct Primary Care (DPC)** — Accès Direct aux Soins Primaires — où le paiement au prestataire (la CDR, Contribution de Disponibilité Réseau) est déclenché par la présence de l'abonné dans la zone du Hub, pas par un acte médical individuel. C'est cette découplage acte/paiement qui évite la requalification en assurance.

**3 plans** (colonne DB `subscriptions.plan` : `essentiel`/`standard`/`premium` ; libellés publics CGU : MOTO/NDEKO/LIBOTA — deux noms pour la même réalité, jamais deux systèmes) :

| Plan (DB) | Libellé public | Personnes | Mensuel | Annuel |
|---|---|---|---|---|
| `essentiel` | MOTO | 1 | 2 000 FCFA | 24 000 FCFA |
| `standard` | NDEKO | 2 | 5 000 FCFA | 60 000 FCFA |
| `premium` | LIBOTA | 5 | 10 000 FCFA | 120 000 FCFA |

**Reversement CDR** (toujours 50/30/12,5/7,5, indépendant du volume d'actes) : 50% Bolamu / 30% clinique / 12,5% pharmacie / 7,5% laboratoire. Seuil de rentabilité réel en base : `breakeven_subscribers = 280` (valeur `platform_config`, pas 1000 comme parfois répété ailleurs).

**Second modèle économique, distinct** : Bolamu Wellness (Corporate B2B) — une entreprise finance directement l'accès de ses salariés (l'entreprise paie, l'employé bénéficie, pas de retenue sur salaire dans ce cas). À ne pas confondre avec le module SmartFlow (hors-catalogue individuel, retenue sur salaire possible pour un acte ponctuel) — les deux coexistent et sont documentés séparément (`ARCHITECTURE_WELLNESS_BOLAMU.md` vs `ARCHITECTURE_FINANCIERE_BOLAMU.md` §5).

**Troisième pilier économique** : les points Zora, financés par les partenaires récompenses eux-mêmes (Bolamu ne finance pas les récompenses, il fournit le rail technologique — voir §3.3).

---

## 1. Architecture générale — les 3 couches

### 1.1 Couche Données (PostgreSQL / Neon, Frankfurt)

**134 tables en prod**, réparties en 9 domaines fonctionnels (détail exhaustif : `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md`) : Identité & Accès, Soins, Partenaires, Abonnements & Paiements, Zora, Elonga, Social, Notifications, Configuration.

**`users` est le centre de gravité absolu** : ~90 colonnes réelles, regroupant en une seule table ce qui devrait être plusieurs sous-domaines (identité, abonnement, données partenaire, constantes médicales, profil social, onboarding). Presque toutes les tables métier portent une colonne `*_phone` en FK vers `users(phone)` plutôt que l'`id` numérique — `phone` (`normalizePhone()`, format `+2420XXXXXXXX`) est l'identifiant universel de toute la plateforme.

**Règles fondamentales qui gouvernent toutes les données** :
- `normalizePhone()` avant tout INSERT/SELECT sur un numéro — jamais de regex inline.
- Soft delete uniquement (`is_active=FALSE`) — confirmé, aucun `DELETE FROM users` trouvé dans le code applicatif.
- `zora_ledger` et `audit_log` sont **insert-only** — aucun `UPDATE`/`DELETE` trouvé sur ces deux tables.
- `platform_config` (`config_key`/`config_value`) porte tous les taux et prix — jamais de valeur hardcodée (à quelques exceptions documentées en §6, ex. destination SEPA en dur).

**Migrations — anomalie structurelle majeure, à connaître avant tout** : trois emplacements coexistent :
1. `database/migrations/` — 001 à 059, numérotation continue mais avec doublons de numéro (`034` ×3, `039` ×2, `049` ×2) et racine `database/` contenant aussi des fichiers hors dossier (`migration_001` à `migration_008` visibles directement dans `database/`, avant la création du sous-dossier `migrations/`).
2. `migrations/` (racine du dépôt, dossier séparé) — 4 migrations BHP (`bhp_001` à `bhp_004`), `b6_001_zora_voucher_validations.sql`, `b7_001_icp_scores.sql` (crée aussi `smartflow_reports`), plus des fichiers isolés (`030_create_historique_abonnements.sql`, `add_subscription_payment_fields.sql`, `add_wizard_columns.sql`, `create_documents_table.sql`) sans rapport avec la numérotation `database/migrations/`.
3. **De nombreuses tables/colonnes massivement utilisées par le code n'ont aucun fichier de migration du tout** dans l'un ou l'autre dossier : `appointments`, `prescriptions`, `lab_prescriptions`, `lab_results`, `pharmacies`, `laboratories`, `payments`, `posts`/`post_likes`/`post_comments`/`follows`/`story_views`, `admins`, `secretaires`, `clinics`, `companies`, ainsi que les colonnes `users.role`/`bolamu_id`/`member_code`/`email`/`password`/`photo_url`. Elles ont été créées directement sur Neon, hors du système de migrations versionné.

**Exécution des migrations** : `runMigrations()` (`src/db/migrate.js`) est appelé et attendu (`await`) **avant** que `server.js` ne commence à écouter (`startServer()`, ligne 431-434) — les migrations tournent donc automatiquement à chaque déploiement/redémarrage, avant que la moindre requête HTTP ne soit acceptée. La table `migrations_applied` (`id`/`filename`/`applied_at`) trace ce qui a été exécuté par ce mécanisme — mais comme elle ne peut tracer que les fichiers réellement présents dans les dossiers scannés, elle ne couvre pas l'historique non versionné évoqué ci-dessus.

### 1.2 Couche Backend (Node.js / Express, Render)

**Structure réelle de `src/`** : `server.js` importe et monte ~70 fichiers de routes (liste exhaustive en §1.2 ci-dessous, vérifiée ligne par ligne dans `server.js:111-242`) sous `/api/v1/*`. Chaque fichier de routes définit ses propres gardes de rôle localement (voir §3.1) — il n'existe pas de registre central des permissions.

**Flux réel d'une requête HTTP, dans l'ordre exact où `server.js` empile les middlewares** :
```
requête entrante
  → cookieParser()                                    (server.js:34 — lit les cookies, peu utilisé)
  → cas spécial : express.raw() sur les 2 webhooks MoMo/Airtel (body brut requis pour vérif signature HMAC)
  → helmet + cors + compression + express.json()       (prod : config/production.js · dev : whitelist CORS inline)
  → requestLogger                                      (server.js:106)
  → standardLimiter                                    (rate limiting, appliqué à tout /api/v1/* — server.js:178)
  → routeur du fichier de routes concerné
      → authMiddleware (si route protégée) — vérifie le JWT, injecte req.user
      → garde de rôle locale (adminOnly / requireDoctor / requireAgent / etc. — voir §3.1)
      → controller ou logique inline dans le fichier de routes
      → pool.query() direct (pas d'ORM)
      → réponse JSON { success, data/message }
  → Sentry.setupExpressErrorHandler (server.js:342)
  → errorHandler global (server.js:347)
```
**Point de passage obligatoire pour toute route protégée** : `authMiddleware` (`src/middleware/auth.middleware.js:11-55`) — vérifie le JWT signé avec `JWT_SECRET` (obligatoire, `throw` fatal au démarrage si absent), lit `is_active`/`banned` depuis le payload du token si présent (évite une requête DB), sinon retombe sur une requête `SELECT is_active, banned FROM users`. **Il n'existe pas de vérification de rôle générique** — chaque fichier de routes doit ajouter sa propre garde après `authMiddleware` (`adminOnly`, `requireDoctor`, etc., dupliquées dans ~11 fichiers différents, cf. `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §3).

**Services centraux transversaux, réellement utilisés partout** :
- `whatsapp.service.js::sendAutoMessage(phone, templateName, params)` — **seul canal d'envoi WhatsApp actif** (infrastructure WAHA/GOWS, pas Meta Cloud API — Meta est confirmée abandonnée dans `docs/ARCHITECTURE_NOTIFICATIONS.md`). Appelé dans un `try/catch` non bloquant à chaque événement métier (inscription, validation, paiement, RDV...).
- `wame.service.js::buildWameLink()` — **service distinct**, construit des liens de deep-link WhatsApp (magic links), appelé **en complément** de `sendAutoMessage()` dans plusieurs controllers (ex. `registerPatient()`), pas à sa place. Écart à signaler : `PILOTAGE_BOLAMU.md` (§2 règle 6, §5) affirme que `wame.service.js` est *« le SEUL service WhatsApp autorisé »* — c'est inexact au regard du code réel actuel, où `whatsapp.service.js`/`sendAutoMessage()` est le canal d'envoi effectif, `wame.service.js` ne fait que construire des URLs.
- `zora.service.js::awardZora()` — point d'entrée unique confirmé pour tout crédit/débit de points (aucun `UPDATE zora_ledger` trouvé ailleurs).
- `audit_log` — **pas de fonction centrale** : ~35 fichiers font un `INSERT INTO audit_log` directement, avec un format globalement homogène (`event_type, actor_phone, target_table, target_id, payload::jsonb`) mais au moins un fichier (`appointments-validate.controllers.js`) omet des colonnes, en écart avec la règle CLAUDE.md.
- `platform_config` — lu directement (`pool.query(SELECT config_value FROM platform_config WHERE config_key=$1)`) dans 17+ fichiers, jamais via un service de configuration centralisé.

**Jobs et crons réellement actifs** (démarrés dans `server.js:356-375`) :
| Job | Fréquence | Condition d'activation |
|---|---|---|
| `jobAbonnement` (`src/jobs/abonnement.job.js`) | quotidien 02h00 Brazzaville | toujours démarré |
| `jobStoriesCleanup` (`src/cron/stories-cleanup.js`) | toutes les heures | toujours démarré |
| `wellness.cron.js` (2 jobs : sync Google Fit + évaluation règles) | toutes les 6h | **seulement si** `NODE_ENV=production` ou `ENABLE_WELLNESS_CRON=true` (`.env.example`, désactivé par défaut en dev) |
| `notification-worker` (BullMQ) | événementiel | Push uniquement — `sms-worker.js` explicitement commenté (`// SMS abandonné — ne pas réactiver`) |

Aucun cron de clearing financier trouvé (`ARCHITECTURE_FINANCIERE_BOLAMU.md` §2 — le clearing est déclenché manuellement et, de toute façon, le calcul réel n'est pas implémenté, voir §6).

### 1.3 Couche Frontend (HTML/CSS/JS vanilla)

**Un fichier HTML par rôle**, servi statiquement (`express.static`, `public/`), sans framework ni bundler (à l'exception de résidus `_next/` d'un ancien export Next.js, dont `public/index.html` a été retiré car jamais servi — `landing.html` sert `GET /`).

**Pattern commun à tous les dashboards** (confirmé fichier par fichier dans `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §3) :
```
chargement de la page
  → garde de sécurité (synchrone ou dans DOMContentLoaded selon le fichier — pas uniforme)
      → lit le token localStorage (clé bolamu_{role}_token, variable selon le dashboard)
      → si absent/rôle incorrect → redirect vers le login du rôle
  → appel(s) fetch() vers /api/v1/* avec header Authorization: Bearer {token}
  → renderXxx() injecte le HTML/JSON reçu dans le DOM
  → intercepteur global sur 401 → localStorage.clear() + redirect login (dupliqué indépendamment dans plusieurs dashboards, pas mutualisé dans bolamu-nav.js malgré son existence)
```
**Design system** (détail complet : `ARCHITECTURE_UX_UI_BOLAMU.md`) : Plus Jakarta Sans (corps) + Fraunces (titres), Material Symbols Outlined exclusivement (zéro emoji dans le HTML statique), fond `#FAF8FF`, navy `#0A2463`, turquoise `#00C9A7`, boutons en pilule (`border-radius` complet). `#2E86FF` est réservé exclusivement au rôle médecin (`--role-medecin`).

**Communication frontend/backend** : `fetch()` direct vers `bolamu.co/api/v1/*`, pas de couche d'abstraction HTTP centralisée sur la plupart des dashboards (exception notable : `apiFetch()` existant dans `patient/dashboard.html`, avec refresh silencieux, mais **une trentaine d'appels** dans ce même fichier utilisent encore l'ancien pattern `fetch()` + token manuel — dette technique documentée dans `docs/ARCHITECTURE_SOCIAL_COMMUNAUTE_BOLAMU.md` §15.3).

---

## 2. Les acteurs — qui fait quoi, comment, sur quelles données

### Vue d'ensemble — les 10 rôles réels + 1 jamais déployé

Rôles réellement attribués en base (`SELECT DISTINCT role FROM users`, 73 comptes) : `patient` (47), `doctor` (6), `laboratoire` (6), `pharmacie` (4), `secretaire` (2), `animateur` (2), `rh` (2), `agent_bolamu` (2), `admin` (1), `content_admin` (1). Le rôle `partenaire` existe en code complet (routes, middleware, dashboard, login) mais **0 compte réel** — fonctionnalité prête, jamais lancée.

### Patient

- **Base de données** : vit dans `users` (`role='patient'`), aucune table dédiée séparée — toutes ses données (constantes médicales, profil social, abonnement) sont des colonnes de `users`.
- **Backend** : login central (`auth.controller.js::login()`), JWT via `authMiddleware`. Routes réservées : `patient.routes.js`, `constantes-medicales.routes.js`, `appointment.routes.js` (création), `feed.routes.js`, `stories.routes.js`, `follows.routes.js`, `clubs.routes.js` (rejoindre), `events` (s'inscrire), `zora.routes.js` (solde/burn), `wellness.routes.js` (sync Google Fit).
- **Frontend** : `public/patient/dashboard.html`, clé `bolamu_patient_token`/`bolamu_patient_phone`. **Règle produit absolue** (`PILOTAGE_BOLAMU.md`) : ce fichier ne doit subir **aucun changement visuel**, seules des évolutions fonctionnelles sont tolérées.

### Médecin (`doctor`)

- **Base de données** : `users` (`role='doctor'`) + table dédiée `doctors` (`user_id` FK→`users.id`, `phone` UNIQUE séparé, `specialty`, `status` ENUM `doctor_status`, `is_active`). `is_active` réel vient toujours de `doctors`, jamais de `users`.
- **Backend** : `doctor.routes.js`, `appointment.routes.js` (accepter/gérer), `consultation.routes.js`/`ordonnance.routes.js` (Système B, voir `ARCHITECTURE_SOINS_BOLAMU.md` §3), `lab.routes.js` (prescrire examen), garde `requireDoctor`/`doctorOnly`.
- **Frontend** : `public/medecin/dashboard.html`, clé réelle `bolamu_doctor_token` — **bug confirmé** : `logout()` (ligne 1575) tente de supprimer `bolamu_medecin_token`, une clé qui n'a jamais existé (résidu de renommage `medecin`→`doctor` jamais terminé) — le logout ne nettoie donc pas le vrai token.

### Pharmacie / Laboratoire

- **Base de données** : `users` + table dédiée (`pharmacies`/`laboratories`, structure quasi identique, `status` propre, `member_code`, `abonnement_actif`/`abonnement_fin`).
- **Backend** : `pharmacie.routes.js`/`laboratoire.routes.js` (profil), `prescription.routes.js` (dispensation, Système A actif), `lab.routes.js` (résultats), `smartflow.routes.js`/`ssp.routes.js` (tagging SSP/hors-catalogue).
- **Frontend** : `public/pharmacie/dashboard.html` (**zéro changement visuel imposé**, même règle que patient) et `public/laboratoire/dashboard.html`.

### Secrétaire

- **Base de données** : table séparée **`secretaires`** (pas dans `users` — violation confirmée de la règle « table users unique », `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §1.1/§3), avec `partenaire_phone` FK→`users(phone)` (rattachement au partenaire géré).
- **Backend** : `secretariat.routes.js`, garde `requireSecretary`.
- **Frontend** : `public/secretaire/dashboard.html` et `dashboard_v2.html` (deux versions coexistantes — la v2 a une architecture plus propre, corrigée récemment pour pointer vers `/ssp-catalog` au lieu d'un endpoint inexistant).

### Admin / Content Admin

- **Base de données** : `users` (`role` ∈ `admin`/`content_admin`) — pas de table dédiée.
- **Backend** : détail complet `ARCHITECTURE_ADMIN_BACKOFFICE_BOLAMU.md`. Deux mécanismes de garde coexistent : `adminOnly` local (strict `admin`, utilisé par `admin.routes.js`) vs `authMiddleware.requireAdmin` (accepte les deux rôles, utilisé par `articles.routes.js` via `requireContentAdmin`, `collecte.routes.js`, `elonga-events.routes.js`).
- **Frontend** : `public/admin/dashboard.html` (admin) vs `public/admin/content.html` (content_admin) — routage décidé par `redirectByRole()` dans `admin/login.html` selon le rôle retourné par `POST /auth/admin-login`.

### Animateur

- **Base de données** : table dédiée **`animateurs`**, distincte de `users` (même anomalie que `secretaires`), `phone` UNIQUE sans FK déclarée vers `users`.
- **Backend** : `animateur.routes.js`, `elonga-events.routes.js` (création/gestion événements, check-in), `clubs.routes.js` (modération de son club).
- **Frontend** : `public/animateur/dashboard.html`, 4 onglets (Accueil, Événements, Clubs, Notifications).

### RH (`rh`, entreprise)

- **Base de données** : `users` (`role='rh'`) — rattaché à une entreprise via `company_contracts`/`company_employees` (relation cassée en pratique, voir §6).
- **Backend** : `smartflow.routes.js` section `/rh/*`, garde `rhOnly` (accepte aussi le rôle legacy `company_rh`, **0 compte réel**).
- **Frontend** : `public/rh/dashboard.html`, panel ICP Mensuel (voir `ARCHITECTURE_WELLNESS_BOLAMU.md` §3).

### Agent terrain (`agent_bolamu`)

- **Base de données** : `users` (`role='agent_bolamu'`) + colonne de traçabilité `agent_phone` (migration_056) sur 4 tables (`users`, `doctors`, `pharmacies`, `laboratories`).
- **Backend/Frontend** : **deux portails distincts pour le même rôle**, détaillé intégralement dans `ARCHITECTURE_AGENT_BOLAMU.md` — `agent.routes.js`+`public/agent/dashboard.html` (login central, traçabilité `agent_phone` effective) vs `agence.routes.js`+`public/agence/dashboard.html` (login propre dupliqué, traçabilité `agent_phone` **jamais renseignée**). Aucun des deux n'est tranché comme portail officiel.

### Partenaire récompense (`partenaire`) — jamais déployé

- Code complet (`partenaire.routes.js`, middleware `requirePartenaire`, `public/partenaire/dashboard.html`, login dédié) mais **0 compte réel en base**. Statut à clarifier côté produit : fonctionnalité en attente de lancement ou pan mort.

---

### Interactions réelles entre acteurs (fichiers et tables exacts)

**Patient → Médecin (prise de RDV)** : `POST /api/v1/appointments` (`appointment.routes.js`) → INSERT `appointments` (`patient_phone`, `doctor_id` FK→`doctors.id` — seule table du domaine soins à référencer l'`id`, pas le `phone`) → notification WhatsApp `bolamu_rdv_nouveau` au médecin. Le médecin le voit dans `GET /appointments/doctor/:phone` (`medecin/dashboard.html`, section agenda).

**Médecin → Pharmacie (ordonnance)** — **deux circuits parallèles non connectés**, détail complet `ARCHITECTURE_SOINS_BOLAMU.md` §3 : le médecin écrit dans `ordonnances`/`ordonnance_items` (Système B, `POST /ordonnances`, `ordonnance.service.js`) mais la pharmacie ne lit que `prescriptions` (Système A, `GET /prescriptions/by-session/:code`). Une ordonnance créée par un médecin via son dashboard n'est donc **jamais visible en pharmacie** dans le parcours réel actuel.

**Pharmacie → Patient (remise/dispensation)** : `POST /prescriptions/deliver` → UPDATE `prescriptions.status='delivered'` + `audit_log('prescription_delivered')` + notification `bolamu_ordonnance_dispensee`. Statut SSP/hors-catalogue affiché par ligne via `GET /ssp-catalog/check` (`ARCHITECTURE_SOINS_BOLAMU.md` §0bis).

**Secrétaire → Médecin (agenda)** : `secretariat.routes.js` — `POST /secretariat/rdv-manuel` (création RDV pour un patient au téléphone/guichet), `GET /secretariat/queue` (file d'attente temps réel), écrit dans `rendez_vous`/`appointments` selon le point d'entrée exact (deux tables de RDV coexistent, `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §1.2).

**Agent → Patient/Partenaire (inscription tracée)** : `POST /agent/inscrire-patient` (`agent.routes.js`) → `registerPatient()` (`patient.controller.js`, INSERT `users` avec `agent_phone`) → traçable ensuite via `GET /agent/mes-inscrits` (filtre `agent_phone`). **Le même geste via `agence.routes.js` (`POST /agence/souscrire-complet`) ne renseigne jamais `agent_phone`** — traçabilité à moitié cassée, détaillé `ARCHITECTURE_AGENT_BOLAMU.md` §5.

**Admin → Tous (validation/suspension/config)** : `POST /admin/validate-user` → UPDATE `users.is_active=true` + table spécifique `status='verified'` → `sendAutoMessage(phone, 'bolamu_compte_valide')`. Suspension/bannissement même schéma inverse. Configuration : `GET/PUT /admin/config` → `platform_config`, lu par toutes les routes au moment du calcul d'un tarif.

**Animateur → Patient (clubs et événements)** : `POST /events` (statut `pending`) → `PATCH /admin/events/:id/publish` (admin valide) → patient s'inscrit `POST /events/:id/register` → animateur scanne le check-in (`elonga-events.controller.js`) → crédit Zora automatique via `awardZora()`. Clubs : `clubs.routes.js`/`clubs.controller.js`, `club_members`, chat associé via `conversations`/`conversation_participants`/`messages`.

**RH → Employés (mesure d'impact Wellness)** : théoriquement `calculerICP()` (`smartflow.service.js`) agrège `wellness_actions.zora_points` des employés d'un contrat (`company_employees.contract_id`) — **en pratique cassé** (voir §6), le score ICP est proche de 0 car `company_employees` ne peut être peuplée par aucun des deux parcours UI existants.

---

## 3. Les systèmes transversaux

### 3.1 Authentification et RBAC

- **Base** : `users.role` (VARCHAR, **sans contrainte CHECK**) — n'importe quelle chaîne peut y être écrite, seule la discipline du code applicatif garantit des valeurs cohérentes. `JWT_SECRET` sur Render, obligatoire (`throw` fatal si absent, `auth.middleware.js:5-7` et `agence.routes.js:16-18`).
- **Backend** : `login()` (`auth.controller.js:101-170`) signe un access token 15 min (`{id, phone, role, is_active, banned}`) + un refresh token opaque haché SHA-256 stocké dans `refresh_tokens` (durée pilotée par `platform_config.refresh_token_ttl_days`, fallback 7 jours). `authMiddleware` vérifie le JWT et injecte `req.user` ; chaque fichier de routes ajoute ensuite sa propre garde de rôle (11 gardes différentes recensées, cf. `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §3) — il n'y a pas de middleware de rôle générique paramétrable.
- **Frontend** : `localStorage.bolamu_{role}_token` (clé non uniforme selon le dashboard — ex. `bolamu_admin_token`, `bolamu_agent_bolamu_token` vs `bolamu_agent_token` pour le portail agence) → guard au chargement (synchrone ou asynchrone selon le fichier) → header `Authorization: Bearer` sur chaque `fetch()`.
- Référence complète (tableau exhaustif des 11 gardes + 12 guards frontend) : `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §3.

### 3.2 Notifications WhatsApp (WAHA)

- **Base** : `notifications` (migration_023, `user_phone`/`type`/`titre`/`message`/`canal`/`is_read`) et `whatsapp_sessions` (migration_045, persistance de la session WAHA).
- **Backend** : événement métier → `sendAutoMessage(phone, templateName, params)` (`whatsapp.service.js`) → `POST https://waha-bolamu.onrender.com/api/sendText` (header `X-Api-Key`) → moteur GOWS (pas de Chrome/Puppeteer) → SIM dédiée Bolamu. Fallback : erreur WAHA → log + `INSERT notifications` avec `sent_at=NULL`. **Meta Cloud API est confirmée abandonnée** — sauf 2 routes résiduelles de diagnostic dans `admin.routes.js` qui l'appellent encore directement (dette technique documentée, `ARCHITECTURE_ADMIN_BACKOFFICE_BOLAMU.md` §6).
- **Frontend** : `public/patient/dashboard.html` uniquement (`GET /notifications/unread-count`, `GET /notifications`, `PATCH /:id/read`) — aucun autre dashboard de rôle ne consomme le canal interne de notifications.
- Référence complète (catalogue des templates par boucle métier) : `docs/ARCHITECTURE_NOTIFICATIONS.md`.

### 3.3 Points Zora

- **Base réelle** (confirmée `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §1.5, **à ne pas confondre avec le schéma cible ci-dessous**) : `zora_points` (solde par `phone`, `balance`/`total_earned`/`tier`), `zora_ledger` (insert-only, `phone`/`points`/`action_type`/`proof_reference` avec index unique idempotent), `zora_tiers_config`/`zora_earn_rules`/`zora_category_caps` (paramétrage paliers Kimia/Liboso/Nkembo/Elonga et plafonds), `zora_partners`/`zora_rewards`/`zora_vouchers` (marketplace), `zora_games`/`zora_game_plays`/`zora_game_prizes` (jeux).
- **Backend** : action patient → `awardZora()` (`zora.service.js`, point d'entrée unique confirmé) → `INSERT zora_ledger` (idempotent sur `(action_type, proof_reference)`) → `UPDATE zora_points`.
- **Frontend** : `public/patient/dashboard.html` (solde, tier, ledger, jeux), `public/pharmacie/dashboard.html`+`public/laboratoire/dashboard.html` (validation vouchers), `public/zora/*.html` (pages vitrines statiques).
- **⚠️ Écart de document important** : `ARCHITECTURE_ZORA_BOLAMU.md` décrit un schéma **cible** entièrement différent (`zora_wallets` avec `user_id` UUID, `zora_offers`, `zora_campaigns`, roadmap en phases non cochées) — ce n'est **pas** le schéma réel en production. Le système réellement construit et actif est celui listé ci-dessus, plus simple, basé sur `phone` et non sur des UUID. Ce document doit être lu comme une spécification produit/vision, pas comme une description de l'existant (détail en §4).

### 3.4 Audit trail

- **Base** : `audit_log` (migration_001, insert-only, `event_type`/`actor_phone`/`target_table`/`target_id`/`payload jsonb`).
- **Backend** : ~35 `INSERT` directs dispersés dans controllers/routes/jobs — pas de fonction centrale d'écriture, donc pas de garantie uniforme du format (au moins un fichier omet des colonnes attendues).
- **Frontend** : `public/admin/dashboard.html`, `panel-audit` → `GET /admin/audit` (filtre `event_type`, pagination).
- `cron_logs` (jobs planifiés) suit le même principe insert-only mais **n'a aucune route de lecture** — consultable uniquement par requête SQL manuelle sur Neon.

### 3.5 Configuration dynamique

- **Base** : `platform_config` (`config_key` UNIQUE / `config_value` texte / `description`).
- **Backend** : toutes les routes qui manipulent un tarif ou un taux lisent cette table au moment du calcul — pas de cache applicatif généralisé (exception notée : `zora_tiers_config` a un cache mémoire 5 min, `PILOTAGE_BOLAMU.md` §10).
- **Frontend** : `public/admin/dashboard.html`, `panel-config` → `GET/PUT /admin/config`.
- **Incohérence de nommage confirmée** (voir aussi §6) : deux constructions différentes de clé annuelle coexistent dans le code (`price_annual_{plan}` vs `price_{plan}_annual`), une seule correspond au nommage réellement seedé.

---

## 4. Carte des modules et graphe de dépendances

| Document | Périmètre en une phrase | Nature | Dépend de | Requis par |
|---|---|---|---|---|
| `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` | Schéma réel des 134 tables, 9 domaines, anomalies de migration | **As-built** | — (fondation) | Tous les autres |
| `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` | 10 rôles réels, middlewares, guards frontend, historique des corrections | **As-built** | Modèle de données | Tous les documents acteur/module |
| `ARCHITECTURE_SOINS_BOLAMU.md` | RDV → consultation → ordonnance → dispensation → labo, +§0bis SSP | **As-built** | Modèle de données, RBAC | Financière (CDR médecin), Wellness |
| `ARCHITECTURE_FINANCIERE_BOLAMU.md` | Abonnements, clearing, CDR, SmartFlow, crédits | **As-built** | Modèle de données, RBAC | Wellness, Agent, ce document §0 |
| `ARCHITECTURE_SECURITE_REGLEMENTAIRE_BOLAMU.md` | CNPD/BHP, webhooks, rate limiting, audit, CIMA | **As-built** | Modèle de données, RBAC | Ce document §0 (non-assurance) |
| `ARCHITECTURE_UX_UI_BOLAMU.md` | Design system, navigation, composants, règles UI | **As-built** | — | Tous les documents frontend |
| `ARCHITECTURE_ADMIN_BACKOFFICE_BOLAMU.md` | Cockpit admin : users, paiements, contenu, config, events, audit | **As-built** | Modèle de données, RBAC, Financière | Wellness (contrats B2B) |
| `ARCHITECTURE_WELLNESS_BOLAMU.md` | Corporate Wellness B2B, contrats, ICP, wellness individuel (Google Fit) | **As-built** | Modèle de données, RBAC, Financière, Admin backoffice | — |
| `ARCHITECTURE_AGENT_BOLAMU.md` | Agent terrain, double portail, traçabilité, absence de commission | **As-built** | Modèle de données, RBAC | Wellness (import employés) |
| `ARCHITECTURE_ZORA_BOLAMU.md` | Programme de fidélité — **schéma cible, ne décrit pas le schéma réel** | **Spec/vision** ⚠️ | — | Rien ne doit s'y référer pour le schéma réel — voir §3.3 |
| `ARCHITECTURE_ELONGA_BOLAMU.md` | Événements prévention — spec v5, audits techniques partiellement faits | **Spec + audit partiel** | Social & Communauté | — |
| `docs/ARCHITECTURE_SOCIAL_COMMUNAUTE_BOLAMU.md` | Feed, follows, clubs, chat — spec v1, audits partiels | **Spec + audit partiel** | — | Elonga |
| `docs/ARCHITECTURE_NOTIFICATIONS.md` | Catalogue des templates WhatsApp réels par boucle métier | **As-built** | — | Tous les modules avec notification |
| `PILOTAGE_BOLAMU.md` | Vision organisationnelle « boucles métier », juin 2025 | **Legacy/partiellement obsolète** ⚠️ | — | Contexte historique uniquement, certaines affirmations contredites (§1.2, §6) |
| `CLAUDE.md` / `AGENTS.md` | Règles d'équipe IA, 21 rôles, règles absolues par domaine | **Règles/process** | — | §5 de ce document |

**Graphe de dépendances (ordre de compréhension)** :
```
MODELE_DONNEES ──┬──> RBAC_GLOBAL ──┬──> SOINS ──────────┐
                 │                  ├──> FINANCIERE ──────┼──> WELLNESS
                 │                  ├──> SECURITE         │
                 │                  ├──> ADMIN_BACKOFFICE ─┘
                 │                  └──> AGENT
                 └──> UX_UI (indépendant, requis par tout le frontend)

SOCIAL_COMMUNAUTE ──> ELONGA (Elonga consomme les briques profil/feed/notif du doc Social)

ZORA (spec) ──/──> aucun document ne doit s'y référer pour le schéma réel (voir §3.3)

Tous les documents ci-dessus ──> CE DOCUMENT (OVERVIEW) qui les relie entre eux
```

---

## 5. Règles absolues — les lois fondamentales

**Données**
- `phone` (`normalizePhone()`) est l'identifiant universel — jamais l'`id` numérique dans les payloads d'API.
- Soft delete uniquement — jamais de `DELETE` sur `users`.
- `zora_ledger` et `audit_log` : insert-only, aucune exception.
- `platform_config` pour tous les taux/prix — jamais de valeur hardcodée (écarts documentés en §6).
- Migrations `CREATE TABLE IF NOT EXISTS` systématique.

**Notifications**
- `sendAutoMessage()` (`whatsapp.service.js`) est le seul canal d'envoi WhatsApp actif — WAHA/GOWS, pas Meta Cloud API.
- Tout lien WhatsApp sortant vers la plateforme doit être un magic link (`buildWameLink`/`sendOnboardingLink`), jamais une URL nue (règle posée dans `docs/ARCHITECTURE_SOCIAL_COMMUNAUTE_BOLAMU.md` §7.3, cohérente avec le reste du dépôt).

**Paiements**
- Tarifs toujours lus depuis `platform_config`.
- `clearing_transactions.partner_type` exclut volontairement `doctor`/`medecin` — les médecins sont payés via `doctor_payouts` (CDR clinique), circuit séparé.
- CDR versée indépendamment du nombre d'actes — argument central de non-qualification en assurance (§0).

**Sécurité**
- `JWT_SECRET` sans fallback, fatal au démarrage si absent.
- `normalizePhone()` sur tout input téléphone.
- Deux piliers réglementaires de rang égal : CNPD (général) et BHP (santé, consentement granulaire + journalisation immuable + purge 5 ans).
- `phone` en URL → toujours `?phone=encodeURIComponent(phone)`, jamais en path param brut sensible.

**UI**
- Plus Jakarta Sans + Material Symbols Outlined, zéro emoji dans le HTML statique.
- `#2E86FF` réservé à l'identité visuelle médecin.
- `patient/dashboard.html` et `pharmacie/dashboard.html` : zéro changement visuel (règle produit explicite, `PILOTAGE_BOLAMU.md`).
- Sidebar fixe interdite sur les dashboards métier, sauf exception assumée pour le backoffice admin.

---

## 6. État actuel — bugs et dette technique

### 🔴 CRITIQUE

- **Clearing financier non implémenté** : `runClearing()` (`src/scripts/clearing-mensuel.js`) est un stub qui ne fait rien et retourne `success:true` — le bouton admin « déclencher le clearing » ne calcule aucun reversement réel. Le vrai algorithme (`billing.service.js::calculerReversement()`/`validerClearing()`) existe mais n'est appelé par aucune route (`ARCHITECTURE_FINANCIERE_BOLAMU.md` §2). `validerClearing()` contient en plus un `UPDATE ... RETURNING SUM(...)` qui échouerait de toute façon en PostgreSQL.
- **`company_employees` cassée sur 3 des 4 chemins de code qui y écrivent/lisent** — noms de colonnes incompatibles avec le schéma réel (`matricule`/`categorie_rh`/`company_contract_id`/`phone`/`role` n'existent pas). Conséquence : le dashboard ICP RH (Wellness B2B) est fonctionnellement vide en production. Détail exact fichier/ligne : `ARCHITECTURE_WELLNESS_BOLAMU.md` §7.
- **Route diagnostic WhatsApp sans authentification** : `POST /admin/diagnostics/whatsapp-send-test` (`admin.routes.js:1431`) n'a **aucun** `authMiddleware`, protégée uniquement par une clé statique en dur dans le code source (`DIAG_KEY`). Accessible à quiconque connaît cette chaîne.
- **`POST /admin/subscriptions/activate` référence une variable `db` jamais importée** dans `admin.routes.js` — échoue systématiquement (`ReferenceError`) si appelée.

### 🟠 IMPORTANT

- **Deux systèmes d'ordonnance parallèles non unifiés** : `prescriptions` (liée à `appointments`, active côté pharmacie) vs `ordonnances`/`ordonnance_items` (liée à `consultations`, active côté médecin) — une ordonnance créée par le médecin n'est jamais visible en pharmacie dans le parcours réel (`ARCHITECTURE_SOINS_BOLAMU.md` §3).
- **Traçabilité agent à moitié cassée** : le portail `agence.routes.js` ne renseigne jamais `agent_phone` — les inscriptions faites par ce portail sont invisibles dans les stats de l'agent qui les a réalisées (`ARCHITECTURE_AGENT_BOLAMU.md` §5).
- **Double portail `agent_bolamu` non tranché**, avec double clé localStorage incompatible et login dupliqué (`ARCHITECTURE_AGENT_BOLAMU.md` §6, `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §4).
- **Incohérence `content_admin`** : `admin.routes.js` (le plus gros fichier de routes du backoffice) n'accepte jamais ce rôle — seul `articles.routes.js` lui est ouvert (`ARCHITECTURE_ADMIN_BACKOFFICE_BOLAMU.md` §8).
- **Incohérence de nommage `platform_config` annuel** : `price_annual_{plan}` (utilisé dans `POST /admin/company-contracts`) vs `price_{plan}_annual` (le nommage réellement seedé, utilisé par `POST /admin/subscriptions/activate`) — la création de contrat B2B en mode annuel échoue systématiquement.
- **`ARCHITECTURE_ZORA_BOLAMU.md` décrit un schéma qui ne correspond pas à la production** — risque de confusion majeure si lu comme une description de l'existant plutôt qu'une spec (§3.3, §4).
- **`PILOTAGE_BOLAMU.md` contient des affirmations obsolètes** : `wame.service.js` n'est pas le seul service WhatsApp (c'est `whatsapp.service.js`/`sendAutoMessage()`), plusieurs noms de fichiers de service cités (`zoraService.js`, `cryptoService.js`, `socketService.js` orthographes) ne correspondent pas exactement aux fichiers réels (`zora.service.js` etc.) — document daté juin 2025, à traiter comme historique.
- **Deux tables `otp_codes`/`otps`, deux systèmes de crédits (`credits`/`credit_transactions` vs `zora_ledger`), deux systèmes de vouchers (`zora_vouchers` vs `partner_vouchers`), clubs vs `sport_groups` (marqué DEPRECATED côté routes mais toujours en base)** — duplications non consolidées, `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §3.

### 🟡 DETTE TECHNIQUE

- Historique de migrations non exhaustif — nombreuses tables/colonnes structurantes créées hors du système de migrations versionné (§1.1).
- `admins`/`secretaires`/`animateurs` : tables séparées de `users`, en violation de la règle « table users unique ».
- `requireOpsAdmin` : middleware défini, jamais utilisé.
- Deux routes `/admin/ovp/pending`/`/admin/sepa/pending` dupliquées à l'identique entre `admin.routes.js` et `collecte.routes.js`.
- Deux implémentations redondantes de `POST /credits/grant` (`admin.routes.js` et `credits.routes.js`) — une seule a un appelant frontend.
- `constantes_medicales` : table lue par `ai-consult.service.js` mais jamais alimentée — le flux réel écrit sur des colonnes `users` dédiées, donc le briefing IA pré-consultation a toujours un champ « constantes » vide.
- Bug logout médecin (clé localStorage fantôme `bolamu_medecin_token`).
- Environ 30 appels `fetch()` legacy dans `patient/dashboard.html` n'utilisant pas `apiFetch()`, gardant le bug de session zombie sur ces écrans précis.
- `.windsurfrules`/`.devin/*`/anciens docs historiques (RESUME_PROJET, CONTEXT.md, etc.) contenaient des références à la téléconsultation (interdiction réglementaire) — neutralisées dans le code et la config active ; 10 docs historiques laissés intacts par décision produit explicite.

---

## 7. Ce qui reste à construire

- **Clearing par zone** — spécifié en détail (`ARCHITECTURE_FINANCIERE_BOLAMU.md` §2bis), mais le calcul même du clearing standard n'existe pas encore (voir §6 🔴) — cette extension ne peut pas démarrer avant que le socle soit réparé.
- **Système de commission agent terrain** — absent du code, confirmé par recherche exhaustive (`ARCHITECTURE_AGENT_BOLAMU.md` §5) — à construire si requis par le modèle commercial.
- **Méthodologie WHO HPQ / indicateur TPH (Taux de Part Humaine)** pour le score ICP RH — mentionnés dans la vision produit Wellness mais absents du code (`ARCHITECTURE_WELLNESS_BOLAMU.md` §3) ; le score ICP actuel est une formule simple sans lien avec ces référentiels.
- **Marketplace Zora avancée** (campagnes bonus, budget partenaire consommé, offres avec workflow DRAFT→REVIEW→ACTIVE) — spécifiée en détail dans `ARCHITECTURE_ZORA_BOLAMU.md` §5/§16 (roadmap phases 2-5, cases non cochées), à construire sur le schéma réel (`zora_rewards`/`zora_vouchers`/`zora_partners`), pas sur le schéma cible UUID décrit dans ce document.
- **Modération avancée des clubs** (`join_mode='approval'`, `club_join_requests`, `club_activities`, `profile_comments`) — spécifiée dans `docs/ARCHITECTURE_SOCIAL_COMMUNAUTE_BOLAMU.md` §5, migrations non encore exécutées (à confirmer par audit avant d'écrire le moindre code, comme l'exige le document lui-même en §1.3).
- **Check-in QR scannable pour Elonga** (remplacement de l'affichage texte du `session_code`) — décidé produit, migrations et composants pas encore construits (`ARCHITECTURE_ELONGA_BOLAMU.md` §0bis.5, §3.2-3.4).
- **Cohérence `company_contract_id`** entre `hors_catalogue_transactions`/`export_paie_mensuel` et les deux tables entreprise distinctes (`company_contracts` vs `companies`) — audit dédié nécessaire avant toute nouvelle fonctionnalité B2B.
- **Reconstruction d'un schéma de référence versionné** (`pg_dump --schema-only` committé) pour mettre fin à l'anomalie des migrations non exhaustives (§1.1, §6) — recommandation `/database-admin` déjà posée dans `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md`.

---

## 8. Ordre de lecture recommandé

**Nouveau développeur backend** : ce document (en entier) → `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` → `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` → le document du module sur lequel il travaille (Soins/Financière/Wellness/Agent/Admin).

**Nouveau développeur frontend** : ce document §0, §1.3, §2 → `ARCHITECTURE_UX_UI_BOLAMU.md` → le dashboard précis à modifier, en vérifiant d'abord dans `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §3 la clé localStorage et le guard exacts de ce fichier.

**Auditeur sécurité/conformité** : `ARCHITECTURE_SECURITE_REGLEMENTAIRE_BOLAMU.md` (en entier) → `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §3 (middlewares réels) → ce document §6 (bugs de sécurité déjà identifiés, pour ne pas les re-découvrir) → `docs/ARCHITECTURE_NOTIFICATIONS.md` (traçabilité des communications).

**Comprendre le modèle économique** : ce document §0 → `ARCHITECTURE_FINANCIERE_BOLAMU.md` (en entier) → `ARCHITECTURE_WELLNESS_BOLAMU.md` §0/§6 (second modèle B2B) → `ARCHITECTURE_ZORA_BOLAMU.md` §1/§9 (en gardant à l'esprit qu'il s'agit d'une spec, §3.3/§4 de ce document).

**Déboguer un module spécifique** : ce document §4 (carte des dépendances) pour identifier quel document lire en premier → le document du module → ce document §6 pour vérifier si le bug rencontré est déjà documenté ailleurs → le fichier de code cité précisément (fichier + ligne) dans le document du module.

**Comprendre pourquoi Bolamu n'est pas une assurance (partenaire, régulateur, investisseur)** : ce document §0 → `ARCHITECTURE_SECURITE_REGLEMENTAIRE_BOLAMU.md` §0 (tableau CIMA complet) → `public/cgu.html` Article 3.
