# Architecture du backoffice admin — Bolamu

> Document de référence sur le cockpit d'administration (validation comptes, paiements, contenu, configuration, événements, outils avancés, audit).
> S'appuie sur `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` (schéma), `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` (rôles, middlewares, guards frontend) et `ARCHITECTURE_FINANCIERE_BOLAMU.md` (flux paiement/clearing) — non répétés ici, seulement cités.
> Sources : `src/routes/{admin,admin-docs,articles,push,coupon,conflict,credits,elonga-events}.routes.js`, `public/admin/{dashboard,content,login}.html`, `src/middleware/auth.middleware.js`.

---

## 0. Vue d'ensemble du backoffice

Deux profils distincts partagent la même porte d'entrée (`public/admin/login.html`, `POST /api/v1/auth/admin-login`), redirigés selon le rôle retourné par le backend :

- **`admin`** (« Espace Opérationnel ») → `public/admin/dashboard.html` — cockpit complet (utilisateurs, paiements, config, événements, outils avancés, audit).
- **`content_admin`** (« Espace Éditorial ») → `public/admin/content.html` — périmètre restreint aux articles et blocs de contenu (vitrine, plans, réseaux sociaux).

Le token est stocké dans `localStorage` (`bolamu_admin_token`, `bolamu_admin_phone`, `bolamu_role`) et envoyé en `Authorization: Bearer` sur chaque appel — jamais en cookie côté client, malgré le support cookie existant côté backend (voir §8).

Deux mécanismes de contrôle d'accès **coexistent sans être unifiés** (détail complet dans `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §3, non répété ici) :
- `admin.routes.js` définit sa propre garde locale `adminOnly` (`admin.routes.js:14-19`) — strict `admin`, ignore `content_admin`.
- D'autres fichiers de routes utilisés par le backoffice (`admin-docs.routes.js`, `collecte.routes.js`, `elonga-events.routes.js`, `secretariat.routes.js`) utilisent `authMiddleware.requireAdmin` (`auth.middleware.js:59-120`) — accepte `admin` **et** `content_admin`, avec support double mode token (header **ou** cookie `bolamu_admin_token`).

---

## 1. Gestion des utilisateurs

**Base de données** : `users` (identité universelle, `phone` comme clé), `doctors`, `pharmacies`, `laboratories` (tables spécifiques par rôle pro, `is_active`/`status` propres à chaque table — cf. `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md`).

**Backend** (`admin.routes.js`, garde `adminOnly` sur toutes ces routes) :

| Méthode | Chemin | Action |
|---|---|---|
| GET | `/admin/stats` | Compteurs globaux (patients/pros/RDV/fraude/revenus) |
| GET | `/admin/patients` | Liste patients actifs, pagination |
| GET | `/admin/pending` | Comptes en attente (JOIN doctors/pharmacies/laboratories + documents) |
| POST | `/admin/validate-user` | Valide un compte → `users.is_active=true` + table spécifique `status='verified'` (+ `abonnement_actif`/`abonnement_fin` pour pharmacie/labo) |
| POST | `/admin/reject-user` | Rejette → `is_active=false` + `status='rejected'` |
| POST | `/admin/suspend-user` | Suspend → `banned=true` + `status='suspended'` |
| POST | `/admin/ban-user` | Bannit → `banned=true, is_active=false, banned_at=NOW()` |
| PATCH | `/admin/users/:phone/status` | Changement de statut générique (`verified`/`rejected`/`suspended`/`pending`) |
| GET | `/admin/users` | Liste tous rôles, filtre `role`/`search`, pagination |
| GET | `/admin/users/:phone/profile` | Fiche complète (RDV, prescriptions, paiements, fraude, historique crédits) |
| PATCH | `/admin/users/:phone/ban` | Variante bannissement par path param |
| PATCH | `/admin/users/:phone/unban` | Réactivation (`is_active=true, banned=false`) |
| PATCH | `/admin/users/:phone/toggle` | Bascule `is_active` (ouverture/fermeture rapide) |
| GET | `/admin/doctors` | Liste médecins, filtre `status` |
| GET | `/admin/pharmacies` | Liste pharmacies, filtre `status`/`is_active` |
| GET | `/admin/laboratories` | Liste laboratoires, filtre `status`/`is_active` |
| PATCH | `/admin/doctors/:phone/rehabilitate` | Réhabilite un médecin suspendu |
| GET | `/admin/fraud` | Signaux fraude (`fraud_signals` JOIN `users`) |
| PATCH | `/admin/fraud/:id/suspend` | Bannit un compte suite à un signal fraude |
| GET / POST / DELETE | `/admin/team` | Équipe admin (liste, création `content_admin` par défaut — ligne 1292, `member_code` via `MAX+1` format `ADM-XXXXX`, suppression en soft-delete) |

**Frontend** (`public/admin/dashboard.html`) : panels `panel-pending`, `panel-doctors`, `panel-pharmacies`, `panel-laboratories`, `panel-patients`, `panel-admin-team` (lignes 466-542), fonctions `loadPending()`, `loadDoctors()`, `loadPharmacies()`, `loadLabos()`, `loadPatients()`, `loadAdminTeam()` (lignes 1243-1421). Actions ligne 1971-2016 : `validate-user`, `reject-user`, `suspend-user`, `ban-user`.

**Notifications WAHA** déclenchées à chaque action (`sendAutoMessage`, non bloquant, `try/catch` systématique) : `bolamu_compte_valide`, `bolamu_compte_rejete`, `bolamu_compte_suspendu`, `bolamu_compte_banni`, `bolamu_compte_suspendu_fraude`, `bolamu_compte_banni_admin`, `bolamu_compte_reactive` — détail des templates dans `docs/ARCHITECTURE_NOTIFICATIONS.md`.

---

## 2. Gestion des paiements et abonnements

**Base de données** : `payments`, `subscriptions`, `platform_config` (tarifs), `ovp_documents`, `bank_transfer_requests` — circuit clearing complet documenté dans `ARCHITECTURE_FINANCIERE_BOLAMU.md`.

**Backend** (`admin.routes.js`) :

| Méthode | Chemin | Action |
|---|---|---|
| GET | `/admin/payments` | Liste paiements + total/revenu cumulé (`status='success'`) |
| GET | `/admin/appointments` | Tous les RDV (JOIN médecin) |
| GET | `/admin/prescriptions` | Toutes les prescriptions (JOIN médecin) |
| PATCH | `/admin/pros/:type/:id/abonnement` | Active/désactive l'abonnement pro d'une pharmacie/labo (30 jours) |
| GET | `/admin/ovp/pending`, `/admin/sepa/pending` | Paiements OVP/SEPA en attente de validation manuelle (alias de `collecte.routes.js`, doublon exact des routes déjà montées ligne 1554-1591 — même requête répétée deux fois dans le fichier) |
| POST | `/admin/subscriptions/activate` | Active un abonnement manuellement — **bug relevé** : utilise `db.query` (ligne 901, 912, 919, 920) alors que le reste du fichier utilise `pool.query` ; `db` n'est importé nulle part dans `admin.routes.js` → route en échec systématique (`ReferenceError: db is not defined`) si jamais appelée |
| POST / GET / DELETE | `/admin/company-contracts`, `/admin/company-contracts/:id/employees` | Contrats grands comptes B2B (Smart Flow V2) — détail complet dans `ARCHITECTURE_WELLNESS_BOLAMU.md` §1/§7 (bug de colonnes documenté là-bas, non répété ici) |

**Frontend** : `panel-payments` (ligne 510), `panel-collecte` (ligne 579), fonctions `loadPayments()`, `loadCollecte()` (lignes 1333-2089).

---

## 3. Gestion du contenu éditorial

**Backend** (`src/routes/articles.routes.js`) — garde locale `requireContentAdmin` (ligne 33-39, accepte `admin` et `content_admin`) :

| Méthode | Chemin | Action |
|---|---|---|
| GET | `/articles` | Liste publique (articles publiés) |
| GET | `/articles/content-blocks` | Blocs de contenu publics (page vitrine) |
| GET | `/articles/admin/all` | Liste complète (brouillons inclus), pagination |
| GET / PUT | `/articles/admin/content-blocks[/:key]` | Lecture/écriture des blocs (vitrine, plans, textes, réseaux sociaux) |
| POST | `/articles/admin/upload-vitrine`, `/articles/upload-image` | Upload Cloudinary (buffer mémoire, limite 8 Mo) |
| POST / PUT / DELETE | `/articles[/:id]` | CRUD article complet |

**Base de données** : table `articles` — colonnes utilisées dans le code (`title`, `excerpt`, `content`, `category`, `author`, `read_time`, `emoji`, `image_url`, `is_published`, `is_featured`, `created_at`, `updated_at`) ; table `content_blocks` (`block_key` unique, `content` JSON, `updated_at`) — **aucune migration `CREATE TABLE articles`/`CREATE TABLE content_blocks` retrouvée dans `database/migrations/`** (même anomalie que celle déjà documentée pour d'autres tables dans `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §1.2).

**Frontend** (`public/admin/content.html`) : sidebar dédiée (badge « CONTENT » violet, accent `--content-accent: #9f7aea`), panel articles (grille de cartes, filtres par catégorie, actions publier/dépublier/supprimer — lignes 485-562), panel config (vitrine, plans tarifaires, textes, réseaux sociaux — lignes 646-808). Workflow : chaque bloc de contenu s'édite et se sauvegarde indépendamment (`api('/articles/admin/content-blocks/'+key,{method:'PUT',...})`), pas de sauvegarde globale.

---

## 4. Configuration plateforme

**Backend** (`admin.routes.js`) :
- `GET /admin/config` — liste `platform_config` (id, config_key, config_value)
- `PATCH /admin/config/:key` — met à jour une clé + `audit_log('config.updated')`
- `PUT /admin/config` — variante body `{key, value}` (compat dashboard), **sans** log d'audit contrairement à la version PATCH

**Base de données** — clés `platform_config` réellement seedées en prod (`database/migration_001_doctors_subscriptions.sql:130-141`, mises à jour par `migration_003_update_pricing.sql` et `migration_008_collecte_4canaux.sql`) :

| Clé | Valeur actuelle | Description |
|---|---|---|
| `price_essentiel` | `2000` | Tarif mensuel Essentiel (FCFA) — écrasé de `1000`→`2000` par migration_003 |
| `price_standard` | `5000` | Tarif mensuel Standard — écrasé de `2500`→`5000` |
| `price_premium` | `10000` | Tarif mensuel Premium — écrasé de `5000`→`10000` |
| `price_essentiel_annual` | `24000` | Tarif annuel Essentiel |
| `price_standard_annual` | `60000` | Tarif annuel Standard |
| `price_premium_annual` | `120000` | Tarif annuel Premium |
| `doctor_fee_bootstrap` | `2500` | Rémunération médecin phase bootstrap |
| `doctor_fee_growth` | `3500` | Rémunération médecin phase croissance |
| `doctor_fee_maturity` | `5000` | Rémunération médecin phase maturité |
| `active_phase` | `bootstrap` | Phase commerciale active |
| `doctor_patient_ratio` | `200` | Max abonnés actifs par médecin |
| `breakeven_subscribers` | `280` | Seuil de rentabilité |
| `subscription_duration_days` | `30` | Durée standard abonnement |
| `rib_france_qonto` | `A_RENSEIGNER` | RIB SEPA diaspora (non renseigné) |
| `sepa_contact_email` | `contact@bolamu.co` | Email confirmation diaspora |

**Bug de nommage confirmé** (à documenter, pas à corriger ici) : `admin.routes.js:1063` construit la clé annuelle sous la forme `price_annual_${plan}` (ex. `price_annual_premium`) pour la création de contrats B2B, alors que la seule route qui fonctionne réellement (`POST /admin/subscriptions/activate`, ligne 900) construit `price_${plan}_annual` (ex. `price_premium_annual`) — qui correspond au nommage réel seedé ci-dessus. La création de contrat en mode `annual` (`POST /admin/company-contracts`) cherchera donc une clé qui n'existe jamais et échouera systématiquement avec « Tarif introuvable pour ce plan ».

**Frontend** : `panel-config` (ligne 536), `loadConfig()` (ligne 1375), édition ligne par ligne via modal (`PUT /admin/config`).

---

## 5. Gestion des événements Elonga

**Backend** (`src/routes/elonga-events.routes.js`) — garde `authMiddleware.requireAdmin` sur les routes de modération :

| Méthode | Chemin | Action |
|---|---|---|
| POST | `/events` | Créer événement, statut `pending` (upload cover Cloudinary) |
| PATCH | `/events/:id/publish` | Publier (`pending`→`published`) |
| PUT / DELETE | `/events/:id` | Modifier / supprimer |
| GET | `/events/admin/events/pending` | Liste en attente de publication |
| PATCH | `/events/:id/activate` | Activer (`published`→`active`) — animateur ou admin |
| PATCH | `/events/:id/complete` | Compléter (`active`→`completed`) + crédit Zora automatique aux check-ins — animateur ou admin |
| GET | `/events/admin/checkins/history` | Historique check-ins, filtres `event_id`/`date`/`animateur_phone`, pagination |

**Base de données** : `elonga_events`, `elonga_registrations`, `event_checkin_log` (JOIN `elonga_events` + `users` ×2 pour patient/animateur).

**Frontend** : `public/admin/dashboard.html` — `panel-events` (ligne 763), `loadEvents()` (ligne 1514, appelle `/admin/events/pending`) ; `public/admin/events-checkin.html` (page dédiée historique check-in, non lue en détail ici — hors périmètre routes déjà couvertes).

---

## 6. Outils admin avancés

**Push notifications** (`src/routes/push.routes.js`, garde locale `adminOnly`) : `POST /push/test` (envoi notification test à un utilisateur donné) — routes `POST /push/subscribe`/`DELETE /push/unsubscribe` accessibles à tout utilisateur authentifié (pas admin-only).

**Coupons** (`src/routes/coupon.routes.js`) : `POST /admin/coupons` (création), `GET /admin/coupons` (liste) — validation côté utilisateur via `POST /coupons/validate` (authentifié, non admin).

**Conflits** (`src/routes/conflict.routes.js`) : `GET /admin/conflicts` (liste tous conflits), `PATCH /conflicts/:id/statut`, `/assign`, `/escalade`, `/resolve`, `/close`, `/suspend-partner` — toutes `adminOnly`. Côté patient : `POST /conflicts`, `GET /conflicts` (scope automatique à ses propres conflits si `role==='patient'`).

**Crédits admin** — **deux chemins distincts pour la même action**, comme signalé dans la demande :
- `POST /api/v1/admin/credits/grant` (`admin.routes.js:846`) — implémentation propre, écrit dans `credits`/`credit_transactions`/`users.credits_balance` en 4 requêtes séparées (non transactionnel).
- `POST /api/v1/credits/grant` (`credits.routes.js:109`) — implémentation via helpers `ensureCreditAccount()`/`addCredits()`, même effet final.
Les deux routes sont protégées par un `adminOnly` local (fix de sécurité déjà appliqué et documenté dans `ARCHITECTURE_FINANCIERE_BOLAMU.md` §6, non répété ici) ; `GET /credits/admin/all`, `POST /credits/partners`, `PATCH /credits/partners/:id` bénéficient de la même garde. Le frontend (`admin/dashboard.html:1441`) appelle la route `/admin/credits/grant` (celle d'`admin.routes.js`), la route `/credits/grant` de `credits.routes.js` n'a aucun appelant frontend retrouvé — code dupliqué, un des deux chemins est mort côté UI.

**Diagnostics WhatsApp** (`admin.routes.js:1380-1509`) — **dette technique confirmée, à ne pas corriger ici** : `GET /admin/diagnostics/whatsapp-token` et `POST /admin/diagnostics/whatsapp-send-test` appellent directement `graph.facebook.com/v18.0/...` (Meta Cloud API legacy) au lieu de passer par le service WAHA standard (`sendAutoMessage`) utilisé partout ailleurs dans le backoffice. La seconde route contourne même `adminOnly` : elle n'a **aucun** `authMiddleware`, protégée uniquement par une clé statique en dur dans le code (`DIAG_KEY = 'BOLAMU_DIAG_2024_XK9M2P4Q7R'`, ligne 1377) passée en query string — accessible à quiconque connaît cette chaîne, sans JWT.

**Nettoyage données de test** (`DELETE /admin/test/cleanup`, ligne 1515) — restreint aux numéros `+24206TEST*`/`+24206EMP*` uniquement, `audit_log` jamais supprimé (règle insert-only respectée).

---

## 7. Audit et monitoring

**Base de données** :
- `audit_log` (`migration_001_doctors_subscriptions.sql:179-187`) — insert-only, `event_type`/`actor_phone`/`target_table`/`target_id`/`payload jsonb`/`created_at`.
- `cron_logs` (`migration_008_collecte_4canaux.sql:83-90`) — `job_name`/`nb_traites`/`nb_erreurs`/`details`/`executed_at`. Alimentée uniquement par 3 jobs backend (`src/jobs/abonnement.job.js:294`, `src/workers/sms-worker.js:34`, `src/workers/notification-worker.js:59`). **Aucune route ne l'expose en lecture** — pas de `GET` correspondant trouvé dans tout `src/routes/` : la table est écrite mais jamais consultable depuis un dashboard ou une API, seule une requête SQL manuelle sur Neon permet de la lire.

**Backend** : `GET /admin/audit` (`admin.routes.js:830`) — filtre optionnel `event_type`, pagination (défaut 300, max 1000).

**Frontend** : `panel-audit` (ligne 530), `loadAudit(filter)` (ligne 1363, appelle `/admin/audit`).

---

## 8. Sécurité backoffice

Référence complète : `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §3 (tableau exhaustif middlewares + guards frontend par dashboard, non répété ici).

Points spécifiques au backoffice admin :
- **Double mode token** — `authMiddleware.requireAdmin` (`auth.middleware.js:59-79`) accepte le token via header `Authorization` **ou** cookie `req.cookies.bolamu_admin_token`. En pratique, aucun des deux fronts admin (`dashboard.html`, `content.html`, `login.html`) n'envoie jamais de cookie — le support cookie est une capacité backend inutilisée côté client actuel, à ne pas considérer comme un chemin d'attaque actif tant qu'aucun front ne l'active.
- **Incohérence de garde** : `admin.routes.js` (le plus gros fichier de routes du backoffice) n'utilise **jamais** `authMiddleware.requireAdmin` — il redéfinit sa propre garde locale `adminOnly` (ligne 14-19), strictement `admin`, qui refuse `content_admin` sur absolument toutes ses routes. Un compte `content_admin` n'a donc accès à **aucune** route de `admin.routes.js` (y compris les routes qui ne semblent pas sensibles, ex. `GET /admin/config`) — seul `articles.routes.js` (`requireContentAdmin`) lui est ouvert.
- **`requireOpsAdmin`** (`auth.middleware.js:150-158`) — défini mais **jamais utilisé** dans aucun fichier de routes du dépôt (recherche exhaustive, aucun appelant trouvé) : middleware mort, vraisemblablement prévu pour un niveau de permission « admin opérationnel strict » jamais branché.
- **Bug logout médecin (clé localStorage fantôme)** — référencé dans `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §3, sans rapport direct avec le backoffice admin mais de même nature (résidu de renommage de rôle), non répété ici.
