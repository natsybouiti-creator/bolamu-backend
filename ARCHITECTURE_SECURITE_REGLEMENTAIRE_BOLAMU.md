# Architecture sécurité & conformité réglementaire — Bolamu

> Document de référence sur la politique de sécurité et la conformité réglementaire.
> S'appuie sur `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` et `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` — non répétés ici (notamment le détail complet d'`auth.middleware.js`, déjà documenté dans le RBAC §0/§3, simplement cité ici).
> Sources : `src/middleware/{auth.middleware,bhpAccess,rateLimiter,idempotency,requestLogger,validateAirtelWebhook,validateMtnWebhook}.js`, `src/jobs/bhpPurge.job.js`, `migrations/bhp_00{1-4}_*.sql`, `.env.example`, `public/{mentions-legales,cgu}.html`, `docs/SECURITY-SPRINT1.md`, `docs/SECURITY-SQL-AUDIT.md`.

---

## 0. Périmètre réglementaire

Le socle réglementaire de Bolamu repose sur **deux piliers de rang équivalent**, à ne pas hiérarchiser l'un par rapport à l'autre : la protection générale des données personnelles (CNPD) et la protection spécifique des données de santé (BHP). Le premier couvre l'ensemble des données personnelles traitées par la plateforme (identité, paiement, usage) ; le second encadre exclusivement les données médicales — plus sensibles, avec ses propres exigences de consentement granulaire, de journalisation immuable et de purge automatique, détaillées en §2. Un abonné peut avoir exercé ses droits CNPD généraux sans que cela n'affecte le régime BHP appliqué à son dossier médical, et inversement.

**Pilier 1 — Loi 5-2025 / CNPD** (protection générale des données personnelles) — Le traitement des données est régi par la Loi n°29-2019 et la Loi n°5-2025 (`public/cgu.html:637`). La CNPD (Commission Nationale pour la Protection des Données, créée par la Loi n°5-2025) a reçu une déclaration préalable de Bolamu. Un Délégué à la Protection des Données (DPD/DPO) est désigné : **dpo@bolamu.co**. Droits garantis : accès, rectification, suppression, portabilité, opposition — réponse sous 30 jours. Droit à l'effacement anticipé hors DMN (conservation légale 5 ans, voir §6).

**Pilier 2 — BHP v1.2 (Bolamu Health Protocol)** (protection spécifique des données de santé) — Régime distinct et plus strict que la protection générale CNPD, portant spécifiquement sur les données médicales : consentement granulaire par type de donnée (`patient_consents`), journalisation d'accès rendue immuable au niveau des permissions PostgreSQL (`health_record_access_log`, `REVOKE UPDATE/DELETE/TRUNCATE` — voir §2), et purge physique automatique après 5 ans (`bhpPurge.job.js` — voir §6). 4 tables dédiées, créées par des migrations situées dans un **dossier distinct** `migrations/` (à la racine, différent de `database/migrations/` documenté dans le modèle de données) :
- `migrations/bhp_001_health_records.sql` → `health_records`
- `migrations/bhp_002_access_log.sql` → `health_record_access_log` (immuable, voir §2)
- `migrations/bhp_003_consents.sql` → `patient_consents`
- `migrations/bhp_004_documents.sql` → `documents`

Le détail technique complet de ces deux piliers (middlewares, requêtes, jobs) est traité respectivement en §1 (authentification, transversal aux deux) et §2 (BHP exclusivement) — non dupliqué ici.

**Conformité CIMA — pourquoi Bolamu n'est pas une assurance** : `public/cgu.html` Article 3 (« Bolamu n'est pas une assurance ») pose explicitement la distinction avec l'assurance maladie régie par le code CIMA :

| Critère | Assurance maladie (CIMA) | Bolamu (modèle DPC) |
|---|---|---|
| Transfert de risque | Oui | Non — CDR fixe indépendante de tout acte |
| Remboursement | Oui | Non — aucun remboursement d'acte |
| Tarification au risque | Oui — prime selon profil santé | Non — tarif fixe identique pour tous |
| Capital réglementaire | 3,5 Mrd FCFA (CIMA) | Non applicable |
| Déclencheur du paiement prestataire | Un sinistre, un acte médical | L'existence de l'abonné dans la zone du Hub |

Bolamu se positionne comme plateforme d'**Accès Direct aux Soins Primaires (ADSP)**, modèle *Direct Primary Care* : abonnement mensuel fixe donnant accès à un réseau de Hubs partenaires, sans intermédiaire financier de type assurance, sans transfert de risque ni tarification actuarielle. La CDR (voir `ARCHITECTURE_FINANCIERE_BOLAMU.md` §7) est structurellement découplée de tout acte médical individuel, ce qui est l'argument central de non-qualification en assurance.

**Mentions légales** (`public/mentions-legales.html`) : **NBA GESTION SARLU**, RCCM **CG-BZV-01-2025-B13-00178**, gérant Monsieur BOUITI TCHITCHIELE Natsy, domaine bolamu.co. Déjà déployées en prod.

---

## 1. Authentification et tokens

**Base de données** : `refresh_tokens` (`phone` VARCHAR **UNIQUE**, `token_hash` — hashé, pas en clair), `login_tokens` (`token`, `password_snapshot`, `expires_at`), `otp_codes` (`hashed_otp`, `expires_at`, `attempts`). Détail des colonnes exactes : voir `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §1.1.

**Backend** — `src/middleware/auth.middleware.js` (détail complet déjà dans `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §0/§3, résumé ici) : `jwt.verify(token, JWT_SECRET)` sans fallback (throw fatal au démarrage si `JWT_SECRET` absent) ; `req.user = decoded` intégral ; check `is_active`/`banned` d'abord depuis le payload token, puis fallback `SELECT` DB si absent du token (compatibilité anciens tokens). Pas de durée de vie ni de mécanisme de rotation de refresh token identifié dans ce middleware lui-même — la rotation observée se fait côté frontend (`apiFetch()` de `patient/dashboard.html` récupère un nouvel `accessToken` via `POST /auth/refresh` sur 401/403 et le réécrit en `localStorage`, voir `ARCHITECTURE_UX_UI_BOLAMU.md` §6).

**Frontend** : stockage `localStorage` avec une clé par rôle (`bolamu_<role>_token`), détail exhaustif déjà dans `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §2-3. Intercepteur 401 → `logout()`/`localStorage.clear()` + redirection vers le `login.html` du rôle, dupliqué indépendamment dans plusieurs dashboards (non mutualisé).

---

## 2. Protection des données médicales (BHP)

**Base de données** :
- `health_records` (`migrations/bhp_001_health_records.sql`) — `patient_id`/`source_user_id` FK→`users(id)`, `record_type`, `content` JSONB, `consent_granted`+`consent_date`, `is_deleted` (soft delete), index `idx_hr_purge` dédié à la purge (voir §6).
- `health_record_access_log` (`bhp_002_access_log.sql`) — **table immuable au niveau SQL** : `REVOKE UPDATE/DELETE/TRUNCATE ON health_record_access_log FROM bolamu_app` — la protection insert-only n'est pas qu'une convention applicative ici, elle est appliquée au niveau des permissions PostgreSQL elles-mêmes (plus strict que `audit_log`, qui lui n'a qu'une convention de code sans REVOKE SQL — voir `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §1.1).
- `patient_consents` (`bhp_003_consents.sql`) — `consent_type` (ordonnances/prescriptions_labo/historique_medecin/stats_employeur), `granted`+`granted_at`/`revoked_at`, UNIQUE(`patient_id`, `consent_type`).
- `documents` (`bhp_004_documents.sql`) — table unifiée pour tous les documents (remplace « l'ancienne logique uploads fragmentée » selon le commentaire du fichier), `is_verified`+`verified_by` (validation admin documents identité).

**Backend** — `src/middleware/bhpAccess.js` (`bhpAccessMiddleware(allowedRoles)`) :
1. Rejette (403 `BHP_ACCESS_DENIED`) si `user.role` n'est pas dans `allowedRoles` → log `health_record_access_log` (`ACCESS_DENIED_ROLE`).
2. Si un `recordId` est fourni, vérifie `health_records.consent_granted` → sinon 403 `BHP_CONSENT_REQUIRED` (log `ACCESS_DENIED_CONSENT`).
3. Sinon, log l'accès autorisé (`access_granted` ou motif fourni dans `req.body.reason`).
4. Commentaire dans le code (`bhpAccess.js:50-52`) : la vérification « consultation active requise » spécifique au rôle `cms_medecin` a été retirée lors de la fusion `cms_medecin`→`doctor` (migration_058) — cohérent avec `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §5 (rôle fusionné, 0 compte réel).

Posé uniquement sur `consultation.routes.js` (`['medecin','admin']`) et `ordonnance.routes.js` (`['medecin','pharmacie','patient']`) — voir `ARCHITECTURE_SOINS_BOLAMU.md` §2 pour la conséquence (le Système A de soins, `appointments`/`prescriptions`, ne passe jamais par ce middleware).

`bhpPurge.job.js` : purge physique automatique (voir §6).

**Frontend** — **aucun frontend actuel confirmé** pour les endpoints `/health-records` et `/consent` (aucun appel trouvé dans `public/` lors des recherches précédentes — voir `ARCHITECTURE_SOINS_BOLAMU.md` §2). Le module BHP est donc à ce jour backend-only, sans interface patient pour gérer ses consentements granulaires.

---

## 3. Sécurité des webhooks paiement

**Backend** — `src/middleware/validateAirtelWebhook.js` et `src/middleware/validateMtnWebhook.js` (implémentation quasi identique, secret distinct) :
- Signature attendue dans le header `X-Callback-Signature`.
- Secret lu depuis l'environnement (`AIRTEL_WEBHOOK_SECRET` / `MTN_WEBHOOK_SECRET`) — si absent, 500 (configuration serveur incorrecte, refuse plutôt que de bypasser silencieusement).
- Calcul HMAC-SHA256 du **corps brut** de la requête (`req.body` doit être un `Buffer`, donc `express.raw()` doit être monté sur ces routes en amont).
- Comparaison en temps constant (`crypto.timingSafeEqual`), avec vérification préalable de longueur identique des deux buffers — protège contre les attaques par timing.
- Si signature manquante ou invalide → 401, requête rejetée avant tout traitement métier.

**Base de données des webhooks** : pas de table dédiée aux webhooks identifiée — les événements validés déclenchent directement les écritures `payments`/`subscriptions` habituelles ; la traçabilité passe par `audit_log` comme le reste de la plateforme (insert-only, voir §5).

**Frontend** : sans objet pour cette section — un webhook est un appel serveur-à-serveur initié par MTN/Airtel directement vers le backend Bolamu, il n'existe structurellement aucune interface utilisateur intermédiaire. Le seul effet visible côté frontend est indirect : une fois le webhook traité, le statut du paiement/abonnement se reflète dans les dashboards patient/admin déjà documentés dans `ARCHITECTURE_FINANCIERE_BOLAMU.md` §1.

---

## 4. Rate limiting et idempotence

**Base de données** : `idempotency_keys` (migration_021 — `idempotency_key`, `endpoint`, `user_phone`, `request_hash`, `response_status`, `response_body`, `expires_at`) et `audit_log` (chaque dépassement de rate limit y est inscrit, `event_type: 'rate_limit.exceeded'`).

**Backend** — `src/middleware/rateLimiter.js` (`express-rate-limit`) :
- `strictLimiter` : 5 req/15 min — endpoints sensibles (OTP, login). Exempte une liste fixe de numéros de test (`TEST_PHONES`) + préfixes synthétiques E2E (`+24206TEST`, `+24206EMP`).
- `standardLimiter` : 60 req/min — toutes les routes `/api/v1/` sauf webhooks.
- `webhookLimiter` : 100 req/min — routes webhook MTN.
- Chaque dépassement de limite est **loggé dans `audit_log`** (`event_type: 'rate_limit.exceeded'`) avant de renvoyer 429 — traçabilité systématique des abus potentiels.

`src/middleware/idempotency.js` (`idempotencyMiddleware(endpoint)`) : activé uniquement si le header `Idempotency-Key` est présent (sinon passthrough). Hash SHA-256 du body+URL stocké dans `idempotency_keys` (table migration_021). Si la clé existe déjà avec une réponse enregistrée → rejoue la réponse cachée (header `X-Idempotent-Replayed: true`). Si la clé existe sans réponse encore (requête concurrente en cours) → 409. Sinon, intercepte `res.json()` pour capturer et stocker la réponse a posteriori. Utilisé notamment sur les 3 canaux `collecte.routes.js` (OVP, MoMo, SEPA — voir `ARCHITECTURE_FINANCIERE_BOLAMU.md` §1).

`src/middleware/requestLogger.js` : logge chaque requête (méthode, path, statut, durée, IP, `user_phone` si authentifié) via `logger.http()` (Winston, `src/config/logger.js`), à l'exception de `/metrics` et `/api/v1/test` (exclus pour éviter le bruit).

**Frontend** : aucune gestion spécifique du code HTTP 429 identifiée dans les dashboards audités — cohérent avec le pattern « erreur silencieuse » déjà relevé dans `ARCHITECTURE_UX_UI_BOLAMU.md` §6 (`AUDIT_CONTRATS_API_BILATERAL.md`) : un dépassement de quota tomberait vraisemblablement dans le même `catch(() => {})` vide que les autres échecs réseau sur la majorité des appels, sans message dédié « trop de tentatives » affiché à l'utilisateur au-delà du message générique renvoyé par le middleware lui-même.

---

## 5. Audit trail

**Base de données** : `audit_log` (migration_001) — `event_type`, `actor_phone`, `target_table`, `target_id`, `payload` JSONB. **Insert-only confirmé** (aucun `UPDATE`/`DELETE` trouvé dans tout le code applicatif).

**Backend — anomalie déjà documentée dans `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §1.1, reprise ici sous l'angle sécurité** : contrairement à `health_record_access_log` (§2), qui bloque `UPDATE`/`DELETE`/`TRUNCATE` **au niveau des permissions PostgreSQL** (`REVOKE`), `audit_log` ne repose que sur une **convention de code** — rien n'empêche techniquement un `UPDATE audit_log` d'être exécuté si un développeur en écrivait un par erreur. Aucun point d'entrée centralisé : le pattern `INSERT INTO audit_log` est dupliqué dans ~35 fichiers (controllers, routes, jobs, cron, middleware — y compris `rateLimiter.js` pour les dépassements, §4). Au moins un fichier (`appointments-validate.controllers.js`) omet `target_table`/`target_id`.

**Recommandation implicite pour `/database-admin`/`/security-officer`** (non traitée ici, documentée à titre d'anomalie) : durcir `audit_log` avec le même `REVOKE UPDATE/DELETE/TRUNCATE` que `health_record_access_log`, et centraliser les écritures dans une fonction unique plutôt que 35 `INSERT` indépendants.

**Frontend** : `public/admin/dashboard.html:1366` — `GET /admin/audit?type=` (filtre par type d'événement), seule vue confirmée sur l'`audit_log`, réservée au rôle `admin` (voir `ARCHITECTURE_RBAC_GLOBAL_BOLAMU.md` §1). Aucun autre rôle n'a de vue sur ce journal.

---

## 6. Politique de suppression des données

- **Soft delete uniquement** (`is_active = FALSE`) sur `users` et la quasi-totalité des tables métier — confirmé, aucun `DELETE FROM users` trouvé.
- **Insert-only sur `zora_ledger`** — jamais de suppression de points (voir `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md` §0).
- **Purge BHP automatique** (`src/jobs/bhpPurge.job.js`) : supprime physiquement (`DELETE`, transaction unique) les `health_records` marqués `is_deleted=true` depuis plus de **5 ans** (`updated_at < NOW() - INTERVAL '5 years'`), ainsi que les lignes correspondantes de `health_record_access_log` (via CTE en cascade manuelle). Cohérent avec la mention CGU : « droit à l'effacement anticipé... hors DMN soumis à conservation légale de 5 ans » (`cgu.html:694`). Chaque exécution logge un événement `BHP_PURGE_PHYSIQUE` dans `audit_log` (acteur `'system'`) — **seule exception connue à la règle « jamais de DELETE »**, et elle est physique + auditée, pas un simple soft-delete.
- Pas de cron/scheduler explicite trouvé qui invoque `bhpPurgeJob` dans cette passe de lecture — le fichier exporte la fonction mais son déclenchement (cron externe ? appel manuel ?) n'a pas été confirmé ici, à vérifier avec `/devops-engineer`.
- **Frontend** : sans objet — le soft delete et la purge BHP sont des opérations transparentes pour l'utilisateur, déclenchées uniquement par des actions serveur (cron/admin) ; aucune interface ne les expose directement (pas de bouton « purger » ni d'indicateur de purge trouvé dans les dashboards audités).

---

## 7. Variables d'environnement sensibles

Noms de variables configurées (extraites de `.env.example`, **valeurs jamais lues ni reproduites ici**) :

`DATABASE_URL`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `AT_USERNAME`, `AT_API_KEY`, `MOMO_SUBSCRIPTION_KEY`, `MOMO_API_USER`, `MOMO_API_KEY`, `MTN_WEBHOOK_SECRET`, `MOMO_DISBURSEMENT_SUBSCRIPTION_KEY`, `MOMO_DISBURSEMENT_API_USER`, `MOMO_DISBURSEMENT_API_KEY`, `AIRTEL_CLIENT_ID`, `AIRTEL_CLIENT_SECRET`, `AIRTEL_BASE_URL`, `AIRTEL_WEBHOOK_SECRET`, `SENTRY_DSN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `ANTHROPIC_API_KEY`, `GOOGLE_FIT_CLIENT_ID`, `GOOGLE_FIT_CLIENT_SECRET`, `GOOGLE_FIT_REDIRECT_URI`, `ENABLE_WELLNESS_CRON`, `BOLAMU_WA_PHONE`, + identifiants de comptes de test (`TEST_API_BASE`, `TEST_PATIENT_PASSWORD`, etc.).

Le `.env` réel en production (vu précédemment dans le cadre du travail sur ce dépôt, sans en reproduire les valeurs) comporte en plus `WAHA_BASE_URL`/`WAHA_API_KEY` (infrastructure notifications actuelle, voir `docs/ARCHITECTURE_NOTIFICATIONS.md`), `NEON_API_KEY`, `SENDZEN_API_KEY` — absents de `.env.example`, qui n'est donc pas parfaitement synchronisé avec la configuration réelle de prod.

**Règle absolue confirmée** : `JWT_SECRET` sans fallback codé en dur — `auth.middleware.js` fait un `throw` fatal au démarrage si la variable est absente, empêchant tout démarrage avec un secret par défaut non sécurisé.

---

## 8bis. Historique d'audit — Security Sprint 1 (20 mai 2026)

`docs/SECURITY-SPRINT1.md` documente 6 vulnérabilités CVSS ≥ 7.5 corrigées avant le lancement commercial, dont plusieurs mécanismes toujours en place aujourd'hui et déjà cités dans ce document :
1. **Race condition paiements MoMo (CVSS 9.8)** — corrigée par transaction BEGIN/COMMIT + `SELECT ... FOR UPDATE` + contrainte `UNIQUE(patient_phone, started_at)` sur `subscriptions` (`migration_016`, confirmée dans `ARCHITECTURE_MODELE_DONNEES_BOLAMU.md`).
2. **Webhooks MTN sans validation HMAC (CVSS 9.0)** — origine de `validateMtnWebhook.js` (§3 ci-dessus).
3. **JWT sans expiration (CVSS 8.5)**, 4. **Absence de rate limiting (CVSS 8.2)** — origine de `rateLimiter.js` (§4).
5. **Injection SQL potentielle (CVSS 7.8)** — `docs/SECURITY-SQL-AUDIT.md` conclut à une base saine : recherche exhaustive de concaténation de chaînes dans les requêtes SQL, **aucune vulnérabilité trouvée**, 100% des requêtes auditées utilisent des placeholders paramétrés (`$1, $2...`).
6. **Job cron facturation qui plantait à 500 abonnés (CVSS 7.5)**.

Statut déclaré à l'issue du sprint : « prêt pour lancement commercial ». Ce sprint date du 20 mai 2026 — il ne couvre pas les anomalies plus récentes documentées dans les autres documents d'architecture de cette passe, qui restent à traiter séparément. Une de ces anomalies (`POST /credits/grant`/`POST /credits/distribute-monthly` sans contrôle de rôle admin, relevée dans `ARCHITECTURE_FINANCIERE_BOLAMU.md` §6) a depuis été corrigée hors du périmètre documentaire de cette passe (`fix(security): controle role admin sur credits grant/distribute-monthly`).

---

## 8. Conformité CNPD

Résumé (détail complet en §0) : Loi n°29-2019 + Loi n°5-2025 (CNPD), déclaration préalable effectuée, DPD désigné (dpo@bolamu.co), consentement exprès/libre/spécifique/informé recueilli à l'inscription et révocable à tout moment, droits (accès/rectification/suppression/portabilité/opposition) exerçables sous 30 jours. Le mécanisme technique de consentement granulaire (`patient_consents`, §2) existe côté base de données mais **n'a pas de frontend confirmé** pour que le patient exerce concrètement ces droits en self-service — l'exercice des droits semble à ce jour passer par le canal humain `dpo@bolamu.co` plutôt que par une fonctionnalité applicative dédiée.
