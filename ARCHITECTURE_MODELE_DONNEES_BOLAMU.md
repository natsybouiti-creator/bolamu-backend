# Architecture du modèle de données — Bolamu

> Document de référence sur la structure réelle des données en production (Neon/PostgreSQL, Frankfurt).
> Sources : `database/init.sql`, `database/migration_001` → `database/migrations/migration_058`, interrogation directe de `information_schema`/`pg_constraint` sur Neon, et lecture des controllers/services/routes/frontend.
> 134 tables existent en production à la date de rédaction. Ce document ne détaille pas les 134 — il couvre les domaines fonctionnels demandés et signale explicitement les zones d'ombre.

---

## 0. Principes fondamentaux du modèle de données

- **Identifiant universel : `phone`** (`normalizePhone()` obligatoire, format `+2420XXXXXXXX`). Presque toutes les tables métier portent une colonne `*_phone` en FK vers `users(phone)` plutôt que l'`id` numérique.
- **Soft delete uniquement** (`is_active = FALSE`, jamais de `DELETE`) — confirmé par grep : aucun `DELETE FROM users` trouvé dans le code applicatif.
- **Insert-only sur `zora_ledger`** (jamais d'`UPDATE` sur les points) — confirmé : `awardZora()` dans `src/services/zora.service.js` est le point d'entrée unique de crédit/débit, aucun `UPDATE zora_ledger` trouvé.
- **Timestamps** : `created_at` quasi partout, `updated_at` sur les entités mutables (users, doctors, subscriptions, payments, clearing…) — mais pas systématique (ex. `lab_results`, `consultation_reports` n'ont pas de vrai trigger `updated_at` malgré la présence de la colonne sur certaines).
- **Rôles valides réels en base** (vérifié par `SELECT DISTINCT role FROM users`, 73 comptes) : `patient` (47), `doctor` (6), `laboratoire` (6), `pharmacie` (4), `secretaire` (2), `animateur` (2), `rh` (2), `agent_bolamu` (2), `admin` (1), `content_admin` (1). Un rôle `partenaire` existe dans le code (`partenaire.routes.js`) mais **0 compte réel** actuellement.

**⚠️ Anomalie fondamentale à connaître avant de lire ce document** : la colonne `users.role` (VARCHAR, **sans contrainte CHECK**, défaut `'patient'`) n'est créée par **aucune migration trackée** du dépôt — `init.sql` définit un `user_type_enum` (`patient/medecin/pharmacie/laboratoire/entreprise/admin`) sur une colonne `user_type`, jamais renommée `role` dans les fichiers SQL versionnés. La colonne `role` réellement utilisée par tout le code (`req.user.role`) a donc été ajoutée directement sur Neon, hors du système de migrations. Il en va de même pour plusieurs colonnes massivement utilisées par le code : `bolamu_id`, `member_code`, `avatar_url`/`avatar_pid`, `looking_for`, `email`, `password`, `photo_url` sur `users`, et `clubs.conversation_id` (utilisée dès la migration_055 mais jamais créée par aucune migration lue). **Conséquence pratique : le dossier `database/migrations/` ne décrit qu'une partie de l'évolution du schéma — plusieurs changements structurels majeurs ont été appliqués directement en base, sans fichier de migration correspondant.** Voir §3 pour le détail.

---

## 1. Domaines fonctionnels

### 1.1 Identité & Accès (users, sessions, audit_log)

**Tables** :
- **`users`** (PK `id`, UNIQUE `phone`) — table pivot d'identité, ~90 colonnes réelles vérifiées sur Neon. Regroupe en réalité plusieurs sous-domaines qui devraient être des tables dédiées : identité de base (`full_name`, `birth_date`, `gender`, `role`, `bolamu_id`, `member_code`, `is_active`, `banned`+`ban_reason`+`banned_at`), abonnement (`statut_abonnement`, `date_fin_abonnement`, `credits_balance`), partenaire (`specialty`, `registration_number`, `rccm_number`, `agrement_number`, `director_name`, `document_url`, `trust_score`, `validated_at`, `agent_phone` — migration_056), constantes médicales (`groupe_sanguin`, `allergies`, `maladies_chroniques`, `antecedents_medicaux`, `traitements_en_cours`, `poids`, `taille`, `contact_urgence_*` — migration_014), établissement (`etablissement_nom/adresse/ville/lat/lng` — migration_029), profil social (`bio`, `interets[]`, `statut_disponibilite`, `avatar_url`, `avatar_pid`, `looking_for` — migration_052 + colonnes non trackées), onboarding (`onboarding_token(+expires)`, `first_login_done` — migration_028), paiement familial (`payeur_principal_id` FK→`users(id)` — migration_008).
- **`otp_codes`** (init.sql) — `id`, `phone` UNIQUE, `hashed_otp`, `expires_at`, `attempts`. **Une seconde table `otps` coexiste en prod** (visible dans la liste des 134 tables) sans trace dans aucune migration lue — probable doublon/legacy, à clarifier avec `/database-admin`.
- **`refresh_tokens`** (migration_017, recréée à l'identique en migration_035 car le fichier 017 était « égaré » hors du dossier `migrations/`) — `id`, `phone` VARCHAR **UNIQUE**, `token_hash` UNIQUE, `expires_at`, `is_revoked`, `created_at`. Diffère de la description CLAUDE.md (`user_phone`/`token` en clair) — en réalité c'est `phone`/`token_hash` (hashé).
- **`login_tokens`** (migration_053) — `id`, `phone` FK→`users(phone)`, `token` UNIQUE, `password_snapshot`, `used_at`, `expires_at`, `created_at`.
- **`audit_log`** (migration_001) — `id` BIGSERIAL, `event_type`, `actor_phone`, `target_table`, `target_id`, `payload` JSONB, `created_at`. Exactement les 5 colonnes + id/created_at attendues. **Insert-only confirmé** (aucun `UPDATE`/`DELETE` trouvé) mais **aucun point d'entrée centralisé** : le `INSERT INTO audit_log` est dupliqué dans ~35 fichiers (controllers, routes, jobs, cron, middleware). Au moins un fichier (`appointments-validate.controllers.js`) omet `target_table`/`target_id`, en violation de la règle CLAUDE.md.
- **`admins`** et **`secretaires`** — **tables séparées existant en parallèle de `users`** (id, phone, full_name/nom+prenom, role, is_active, created_at ; `secretaires` a en plus `partenaire_phone`/`partenaire_type` en FK vers `users(phone)`). Ceci **contredit la règle absolue** « table users unique — jamais de tables séparées pour l'identité » — à signaler en anomalie (§3).

**Lues/écrites par** : `users` est référencé dans la quasi-totalité des controllers/services (~80 fichiers) — écritures principales : `src/controllers/auth.controller.js` (inscription tous rôles), `doctor.controller.js`, `pharmacie.controller.js`, `laboratoire.controller.js`, `patient.controller.js`, `constantes-medicales.controller.js` (écrit directement sur `users`, voir §1.2), `admin.routes.js`, `agence.routes.js`, `src/jobs/abonnement.job.js`. `refresh_tokens`/`login_tokens` → `auth.controller.js`, `auth.routes.js`. `audit_log` → ~35 fichiers en écriture directe (voir liste ci-dessus), aucune lecture applicative trouvée hors dashboard admin.

**Frontend associé** : `public/login.html`, `public/register.html`, `public/onboarding.html`, `public/admin/login.html` (+ tous les `login.html` par rôle : `agence`, `animateur`, `partenaire`, `rh`, `secretaire`), `public/patient/dashboard.html` (refresh silencieux), `public/medecin/dashboard.html`, `public/laboratoire/dashboard.html` (`GET /auth/me`).

**Migrations** : init.sql, 001, 008, 014, 015, 017, 022 (index), 028, 029, 035, 041, 052, 053, 056 + colonnes non trackées (`role`, `bolamu_id`, `member_code`, `email`, `password`, `photo_url`, `avatar_*`, `looking_for`).

---

### 1.2 Soins (appointments, consultations, ordonnances, ordonnance_items, medical_records, rendez_vous)

**⚠️ Point critique** : `appointments`, `prescriptions`, `lab_prescriptions`, `lab_results` **n'ont aucun `CREATE TABLE` dans tout l'historique de migrations** — elles préexistent au système de migrations (créées directement sur Neon avant migration_001, ou via un schéma initial non versionné). Leur description ci-dessous vient de l'interrogation directe d'`information_schema` sur Neon.

**Tables** :
- **`appointments`** (préexistante, non migrée) — `id` PK, `patient_phone`, `doctor_id` FK→`doctors(id)` (⚠️ seule table du domaine soins à référencer `doctors.id`, pas `doctor_phone`), `appointment_date` DATE, `appointment_time` TIME, `status` (défaut `'en_attente'`), `session_code`, `notes`, `opened_at`, `validated_at`, `validation_delay_minutes`, `consultation_duration_minutes`, `doctor_lat/lng`, `report_submitted`, `motif`, `is_urgent`, `created_by` (défaut `'patient'`), `created_at`/`updated_at`.
- **`prescriptions`** (préexistante, non migrée) — `id` PK, `appointment_id` FK→`appointments(id)`, `patient_phone`, `doctor_phone`, `medications` (texte libre), `instructions`, `status` (défaut `'active'`), `session_code`, `pharmacie_phone`, `delivered_at`.
- **`lab_prescriptions`** (préexistante ; `priorite` ajoutée par migration_019) — `id` PK, `appointment_id`, `patient_phone`, `doctor_phone`, `lab_phone`, `examens`, `instructions`, `status` (défaut `'en_attente'`), `prescription_code`, `priorite` CHECK IN (`normale`/`urgente`/`critique`).
- **`lab_results`** (préexistante) — `id` PK, `lab_prescription_id`, `patient_phone`, `lab_phone`, `doctor_phone`, `resultats`, `fichier_url`(+`fichier_public_id`), `status` (défaut `'disponible'`), `notified_doctor`/`notified_patient`.
- **`ordonnances`** (migration_048) — `id` PK, `consultation_id` FK→`consultations(id)` CASCADE, `patient_phone`, `doctor_phone`, `issued_at`, `expires_at`, `status` CHECK IN (`active`/`dispensed`/`expired`/`cancelled`), `encrypted_content`.
- **`ordonnance_items`** (migration_048) — `id` PK, `ordonnance_id` FK→`ordonnances(id)` CASCADE, `medicament`, `dosage`, `frequence`, `duree`, `instructions`, `quantite`.
- **`medical_records`** (migration_048) — `id` PK, `patient_phone` UNIQUE, `blood_type`, `allergies[]`, `antecedents[]`, `traitements_en_cours[]`, `derniere_consultation_at`.
- **`rendez_vous`** (migration_048) — `id` PK, `patient_phone`, `doctor_phone`, `secretaire_phone` (aucune FK déclarée), `scheduled_at`, `duration_minutes` (défaut 30), `status` CHECK IN (`pending`/`confirmed`/`in_progress`/`completed`/`cancelled`/`no_show`), `motif`, `notes`.
- **`consultations`** (migration_048) — `id` PK, `rdv_id` FK→`rendez_vous(id)`, `patient_phone`, `doctor_phone`, `started_at`/`ended_at`, `motif`, `anamnese`, `examen_clinique`, `diagnostic`, `notes_confidentielles`, `status` CHECK IN (`open`/`completed`/`cancelled`).
- **`health_records`** (BHP v1.2) — `id` PK, `patient_id` FK→`users(id)`, `record_type`, `title`, `content` JSONB, `source_role`, `source_user_id` FK→`users(id)`, `company_id`, `consent_granted`+`consent_date`, `is_deleted`, `created_at`/`updated_at`.
- **`consultation_reports`**, **`dossier_access_log`**, **`patient_consents`** — satellites BHP : comptes rendus post-consultation, journal d'accès dossier, consentements granulaires (`patient_id` FK→`users(id)`, `consent_type`, `granted`+`granted_at`/`revoked_at`).
- **`constantes_medicales`** : **table inexistante en tant que telle en prod** malgré son usage dans `ai-consult.service.js` (`SELECT * FROM constantes_medicales` — requête probablement en échec silencieux ou table à recréer). **Le flux réel patient/médecin écrit directement sur les colonnes `users.groupe_sanguin/allergies/maladies_chroniques/...`** (migration_014) via `constantes-medicales.controller.js`. Deux représentations différentes du même concept coexistent — dette technique à documenter en priorité (§3).
- **⚠️ Duplication ordonnances/prescriptions** : `prescriptions` (liée à `appointments`, champ `medications` en texte libre) et `ordonnances`/`ordonnance_items` (liée à `consultations`, structure en lignes) sont **deux systèmes parallèles non unifiés** pour le même concept métier.

**Lues/écrites par** :
- `appointments` (25 fichiers) : `controllers/{doctor,qr,consultation-report,lab,prescription,ai-consult,appointments-validate.controllers,secretary,constantes-medicales,preRdv}.controller.js`, `routes/{credits,appointment,agence,admin,smartflow,secretariat,ratings,payouts,symptoms}.routes.js`, `services/{chat,dmn,secretariat,preRdv,ai-consult}.service.js`, `jobs/abonnement.job.js`.
- `consultations` → `services/{ordonnance,consultation,scoreBolamu}.service.js`, `routes/patient.routes.js`.
- `ordonnances`/`ordonnance_items` → `services/{pharmacie,ordonnance,consultation}.service.js` (routes/controller dédiés purs routing, sans SQL inline).
- `medical_records` → `services/consultation.service.js` uniquement.
- `rendez_vous` → `services/{consultation,scoreBolamu}.service.js`. **Aucun `INSERT INTO rendez_vous` trouvé dans le code** — table lue/mise à jour mais jamais peuplée par l'application scannée : à vérifier si legacy, vue, ou alimentation externe.
- `prescriptions` → `controllers/prescription.controller.js` (CRUD complet), `routes/ratings.routes.js`, `controllers/{consultation-report,ai-consult}.controller.js`, `services/{smartflow,ai-consult}.service.js`.
- `lab_prescriptions`/`lab_results` → `services/{lab,renouvellement}.service.js`, `controllers/{consultation-report,lab}.controller.js`.
- `health_records` → `routes/healthRecords.routes.js`, `middleware/bhpAccess.js`, `jobs/bhpPurge.job.js`.

**Frontend associé** : `public/patient/dashboard.html` (`appointments/slots`, `appointments/book`, `patients/constantes`, `patients/consultations/recentes`), `public/medecin/dashboard.html` (`appointments/doctor/:phone`, `consultations/queue`, `consultations/open`, `ordonnances`, `reports/submit`), `public/pharmacie/dashboard.html` (`prescriptions/by-session`, `prescriptions/deliver`), `public/secretaire/dashboard.html` + `dashboard_v2.html` (`secretariat/rdv-manuel`, `secretariat/queue`). **Aucun appel frontend trouvé** vers `/health-records`, `/consent`, `/pre-rdv` — routes montées côté backend mais sans consommateur frontend actuel (le futur remplaçant semble être `/dmn/*`, déjà appelé par `patient/dashboard.html`).

**Migrations** : préexistantes (appointments, prescriptions, lab_prescriptions, lab_results) + 019 (priorite lab), 025 (pre_rdv, ai_consult_sessions, renouvellement), 027 (appointment_symptoms), 048 (rendez_vous, consultations, ordonnances, ordonnance_items, medical_records), BHP (health_records/consultation_reports/dossier_access_log/patient_consents — non retrouvées dans les migrations lues, probablement aussi non trackées).

---

### 1.3 Partenaires (doctors, pharmacies, laboratories)

**Tables** :
- **`doctors`** (init.sql, redéfinie migration_001) — `id` PK, `phone` UNIQUE, `user_id` FK→`users(id)`, `full_name`, `specialty`, `registration_number` UNIQUE, `city` (défaut Brazzaville), `neighborhood`, `bio`, `availability_schedule` JSONB, `status` ENUM `doctor_status` (pending/verified/suspended), `is_active`, `total_consultations`, `total_earnings_fcfa`, `verified_at`, CHECK(`status != 'suspended' OR is_active = FALSE`) + `photo_url` (migration_051) + `agent_phone` (migration_056).
- **`pharmacies`** / **`laboratories`** (préexistantes, non migrées — structure quasi identique, vérifiée sur Neon, 26 colonnes chacune) : `id` PK, `user_id`, `name`, `phone`, `city`, `is_active`, `neighborhood`, `rccm_number`, `autorisation_number` (pharmacies) / `agrement_number`+`director_name` (laboratories), `responsible_name` (pharmacies), `status` (défaut `'pending'`), `member_code`, `document_url`+`document_public_id`, `trust_score`, `momo_number`, `cgu_accepted`, `abonnement_actif`+`abonnement_debut`+`abonnement_fin`, `latitude`/`longitude`, `address`, `photo_url` (migration_051), `agent_phone` (migration_056).
- **`secretaires`** (table séparée, non `users`) — FK vers `users(phone)` à la fois pour `phone` (le compte secrétaire) et `partenaire_phone` (le partenaire rattaché).
- **`clinics`** / **`companies`** — tables minimalistes (`id`, `name`, `city`, `phone`/`contact_phone`, `partner_code`/`company_code`, `is_active`) dont l'usage applicatif n'a pas été audité dans cette passe — statut à clarifier (probable legacy pré-`company_contracts`, voir §1.4).

**Lues/écrites par** : `doctors` (30 fichiers) : `controllers/{doctor,auth,qr,lab,prescription,appointments-validate.controllers,secretary,constantes-medicales,preRdv}.controller.js`, `routes/{agent,credits,appointment,agence,admin,doctor,secretariat,map,payouts}.routes.js`, `services/{conflict,lab,chat,dmn,secretariat,preRdv,renouvellement,ai-consult}.service.js`. `pharmacies` → `controllers/{pharmacie,auth,partner-convention,remise-partenaire}.controller.js`, `services/{conflict,pharmacie}.service.js`. `laboratories` → `controllers/{laboratoire,auth,partner-convention,remise-partenaire,lab}.controller.js`, `services/{conflict,lab}.service.js`.

**Frontend associé** : `public/medecin/dashboard.html`, `public/pharmacie/dashboard.html`, `public/laboratoire/dashboard.html` (profils), `public/patient/dashboard.html` (`GET /doctors` — annuaire), `public/admin/dashboard.html` (`GET /admin/doctors|pharmacies|laboratories`, `validate-user`, `reject-user`, `suspend-user`, `ban-user`).

**Migrations** : init.sql + 001 (doctors) ; pharmacies/laboratories non trackées ; 019 (priorite lab_prescriptions), 040 (dmn), 051 (photo_url), 056 (agent_phone).

---

### 1.4 Abonnements & Paiements (subscriptions, clearing_transactions, transactions_remise_partenaire)

**Tables** :
- **`subscriptions`** (migration_001) — `id` PK, `patient_phone` FK→`users(phone)`, `plan` ENUM `subscription_plan` (essentiel/standard/premium), `amount_fcfa`, `status` ENUM `subscription_status` (active/expired/suspended), `started_at`/`expires_at`, `is_active`, `payment_reference`, + `canal_paiement`/`statut_collecte` (migration_008), UNIQUE(`patient_phone`, `started_at`) (migration_016).
- **`payments`** (préexistante, non migrée — 27 colonnes réelles) — `id` PK, `patient_phone`, `amount_fcfa`, `operator`, `status` (défaut `'pending'`), `reference`, `plan` (ENUM), `reference_id`, `provider` (défaut `'momo'`), `currency` (défaut `'XAF'`), `direction` CHECK IN (`incoming`/`outgoing`), `payment_method_new`, `payment_type`, `subscription_id`, `appointment_id`, `source_account_*`/`destination_account_*` (migration_005), `external_reference`, `reconciled_at`/`reconciled_by`.
- **`clearing_transactions`** (migration_049) — `id` PK, `partner_phone`, `partner_type` CHECK `chk_partner_type` IN (**`pharmacie`, `laboratoire`, `partenaire`** uniquement), `reference_id`/`reference_type`, `amount_fcfa` CHECK(>0), `status` CHECK IN (`pending`/`cleared`/`disputed`/`cancelled`), `cleared_at`. **`doctor`/`medecin` explicitement exclu** — confirme la règle CLAUDE.md : médecins rémunérés via CDR clinique, pas via ce circuit.
- **`transactions_remise_partenaire`** (renommée de `transactions_tiers_payant` en migration_054, table réelle non recréée — vérifiée sur Neon) — `id` (séquence encore nommée `transactions_tiers_payant_id_seq`), `qr_token_id` FK→`qr_tokens(id)`, `patient_phone`, `partner_phone`, `prescription_id` FK→`prescriptions(id)`, `discount_rate_used`, `validated_at`, `convention_id`, `status_new`, `montant_total`/`montant_remise`/`montant_patient` (migration_011/012).
- **`partner_conventions`** (préexistante, altérée migration_005) — `partner_phone`, `partner_name`, `partner_type` CHECK IN (`pharmacie`/`laboratoire`/`clinique`), `discount_rate` CHECK(0–100), `monthly_cap_fcfa`, `status` CHECK IN (`actif`/`suspendu`/`resilié`), `signed_at`, + colonnes de compte source/destination (migration_005).
- **`bank_transfer_requests`** (migration_006) — `reference` UNIQUE, `patient_phone`, `amount_fcfa` CHECK(>0), `plan`, `status` ENUM (pending/reconciled/activated/rejected), `destination_account_id` FK→`bolamu_accounts`, `subscription_id` FK→`subscriptions`.
- **`company_contracts`** / **`company_employees`** (migration_006) — contrats entreprises (Tiers Payant Familial / Smart Flow) : `company_code` UNIQUE, `employee_count`, `total_amount_fcfa`, `billing_type` (monthly/annual), `status` ENUM (draft/signed/active/terminated) ; `company_employees.contract_id` FK→`company_contracts(id)`, `employee_phone` FK→`users(phone)`.
- **`hors_catalogue_transactions`** / **`export_paie_mensuel`** (migration_026, Smart Flow) — `company_contract_id` FK→`company_contracts(id)` (**voir anomalie smartflow ci-dessous**).
- **`ovp_documents`**, **`beneficiaires_familiaux`**, **`bolamu_accounts`** (migrations_005/008) — canaux OVP bancaire / familial.
- **`credits`**, **`credit_transactions`**, **`credit_partners`** — système de crédits parallèle (non demandé explicitement mais découvert en prod) : `credits` a un `role` propre et un solde par `phone`, distinct de `zora_ledger` — à clarifier si doublon fonctionnel avec Zora ou système indépendant.

**Lues/écrites par** : `subscriptions` (19 fichiers) : `routes/{agent,subscriptions,credits,agence,admin,momo,airtel,secretariat,payment,collecte,bank-transfer}.routes.js`, `controllers/{doctor,patient,qr,remise-partenaire}.controller.js`, `services/{consultation,prorata}.service.js`, `jobs/abonnement.job.js`. `clearing_transactions` → `services/{zora-voucher,smartflow,pharmacie,lab,billing}.service.js`. `transactions_remise_partenaire` → `controllers/remise-partenaire.controller.js` (seul fichier). **Le point d'entrée central des 4 canaux de collecte est `routes/collecte.routes.js`** (pas une table dédiée) : `/ovp/initier`, `/momo/initier`, `/familial/ajouter`, `/sepa/initier`.

**Frontend associé** : `public/register.html` (`subscriptions/initiate|confirm`), `public/patient/dashboard.html` (`payments/momo/request`), `public/agence/dashboard.html` (`agence/plans-config`, `agence/souscrire-complet`, `agence/import-employes`), `public/rh/dashboard.html` (`smartflow/rh/*`), `public/admin/dashboard.html` (`admin/payments`, `collecte/admin/*`, `clearing/*`, `admin/company-contracts`), `public/partenaire/dashboard.html` (`partenaire/stats`, `vouchers/programs`).

**Migrations** : 001, 003 (pricing), 004 (doctor_payouts), 005 (financial tracing), 006 (bank_transfers/company_contracts), 007 (partner_clearing), 008 (collecte 4 canaux), 009-012 (fixes tiers payant), 016, 026 (smartflow), 049 (clearing_transactions), 054 (rename remise_partenaire).

**⚠️ Anomalie smartflow confirmée** : `company_contract_id` apparaît dans `hors_catalogue_transactions` (migration_026, nullable) et `export_paie_mensuel` (migration_026, NOT NULL) en FK vers `company_contracts(id)` — mais `company_contracts` elle-même n'a jamais été créée par une migration lue en dehors de migration_006 (bank_transfers). La requête cassée mentionnée dans les tickets (bug connu, sujet séparé) porte vraisemblablement sur une incohérence entre cette FK et la structure réelle de `company_contracts`/`companies` (deux tables entreprise distinctes coexistent : `company_contracts` et `companies`).

---

### 1.5 Zora (zora_ledger, zora_marketplace, vouchers, zora_games, qr_zora_consent)

**Tables** :
- **`zora_points`** (migration_030) — solde par `phone` : `balance`, `total_earned`, `tier` (défaut `'kimia'`), `last_activity_at`.
- **`zora_ledger`** (migration_030) — **insert-only confirmé**, `phone` FK→`users(phone)`, `points`, `category`, `action_type`, `proof_class`, `proof_source`, `recording_method`, `proof_reference`, `verified`, `earned_at`, `expires_at` ; index unique idempotent `(action_type, proof_reference) WHERE points > 0`. **`awardZora()` (`src/services/zora.service.js`) est le point d'entrée unique confirmé.**
- **`zora_tiers_config`**, **`zora_earn_rules`**, **`zora_category_caps`** (migration_030) — paramétrage paliers (Kimia/Liboso/Nkembo/Elonga), règles de gain, plafonds par catégorie (santé 60%/sport 25%/plateforme 10%/lifestyle 5%).
- **`zora_partners`**, **`zora_rewards`**, **`zora_vouchers`** (migration_031, « marketplace ») — **il n'existe pas de table `zora_marketplace`** : le marketplace est la combinaison de ces 3 tables + `zora_voucher_validations`.
- **`partner_vouchers`**, **`partner_programs`**, **`partner_validations`** (migration_040) — second système de vouchers, distinct de `zora_vouchers`/`zora_rewards` (programmes partenaires génériques hors catalogue Zora).
- **`zora_games`**, **`zora_game_prizes`**, **`zora_game_plays`** (+`question_id` migration_037), **`zora_games_global_cap`**, **`zora_quiz_questions`** (migration_032) — moteur de jeux (scratch/wheel/chest/quiz).
- **`qr_zora_consent`** : **table inexistante**. Le consentement réel passe par `patient_consents` (routes/consent.routes.js) ; les QR de scan (traçabilité, pas consentement Zora) passent par `qr_tokens` + `audit_log`. `users.zora_balance_visible_qr` (migration_041) est le seul lien direct QR↔Zora trouvé (opt-in d'affichage du solde sur le QR).

**Lues/écrites par** : `zora_ledger` (via `awardZora()`) — appelants : `routes/clubs.routes.js`, `controllers/{clubs,qr}.controller.js`, `services/{event,notification,zora-voucher,zora-games,communityService,scoreBolamu,voucher,wellness,zora-marketplace,leaderboard}.service.js`, `routes/{admin,patient,elonga-events}.routes.js`, `cron/zora-expiration.js`. `zora_games`/`zora_game_plays` → `services/zora-games.service.js` uniquement. `zora_vouchers` → `services/{zora-voucher,pharmacie,zora-marketplace}.service.js`, `cron/zora-expiration.js` (expiration auto).

**Frontend associé** : `public/patient/dashboard.html` (`zora/balance`, `zora/games/play`, `zora/ledger`, `zora/rewards`, `streaks/me`, `leaderboard/weekly`), `public/pharmacie/dashboard.html` + `public/laboratoire/dashboard.html` (`zora/vouchers/:uuid/consume`, `zora/partner/vouchers`), `public/zora/recompenses.html` + `public/zora/partenaires/*.html` (pages vitrines statiques, sans appel API).

**Migrations** : 030, 031, 032, 037, 038, 040, 041 (zora_balance_visible_qr), 043 (fix balance).

---

### 1.6 Elonga (elonga_events, club_members, clubs, conversations, messages, conversation_participants)

**Tables** :
- **`elonga_events`** (migration_033) — `title`, `pillar`, `location_name/address`, `latitude/longitude`, `city`, `starts_at`/`ends_at`, `max_participants`, `zora_reward` (défaut 50), `proof_class` (défaut `'ground_truth'`), `status` CHECK IN (`draft`/`pending`/`published`/`cancelled` — migration_041), `organizer_phone` FK→`users(phone)`.
- **`elonga_registrations`** (migration_033) — `event_id` FK, `phone` FK→`users(phone)`, `status`, `checkin_at`+`checkin_by`, `zora_awarded`.
- **`elonga_checkin_tokens`** (migration_033) — token UUID par event/phone.
- **`event_registrations`**/**`event_checkin_log`** (migration_041) — **second système d'inscription événement**, distinct d'`elonga_registrations` : `session_code` UNIQUE, `qr_token` (TEXT depuis migration_042, JWT trop long pour VARCHAR(255)), `status` (registered/checked_in/cancelled/no_show).
- **`animateurs`**, **`animateur_clubs`**, **`elonga_points`** (migration_047) — table `animateurs` **distincte de `users`** (même anomalie qu'`admins`/`secretaires`), `phone` UNIQUE sans FK déclarée vers `users`.
- **`clubs`** (créée migration_039_wellness_sprint2, remaniée migration_044, colonnes finales vérifiées sur Neon) — `id`, `name`, `description`, `category`, `animateur_phone` FK→`users(phone)`, `max_members` (défaut 30), `is_active`, `status` (défaut `'active'`), **`conversation_id` FK→`conversations(id)`** (colonne non créée par aucune migration lue — ajoutée hors suivi), `sport_type`, `cover_image_path`.
- **`club_members`** (migration_039_wellness_sprint2) — `club_id` FK, `patient_phone` FK→`users(phone)`, UNIQUE(`club_id`, `patient_phone`).
- **`conversations`** (migration_039_chat_conversations) — `type` CHECK IN (`patient_medecin`/`communaute`/`club`), `club_id`, `is_active`.
- **`conversation_participants`** (migration_039_chat_conversations) — `conversation_id` FK CASCADE, `participant_phone` FK→`users(phone)` CASCADE, **`role` CHECK IN (`patient`, `medecin`, `animateur`) uniquement** (contrainte à l'origine de l'incident prod du 2026-07-05 : `admin`/`member` ne sont pas des valeurs valides), `last_read_at`.
- **`messages`** (migration_039_chat_conversations) — `conversation_id` FK CASCADE, `sender_phone` FK CASCADE, `content`, `type` (text/image/document).
- **`sport_groups`**, **`sport_group_members`**, **`chat_messages`**, **`chat_reactions`** (migration_034_sport_groups_chat) — **système parallèle et déprécié** (`routes/sport-groups.routes.DEPRECATED.js`), coexistant avec `clubs`/`conversations` sans avoir été retiré de la base.

**Lues/écrites par** : `clubs`/`club_members`/`conversations`/`conversation_participants`/`messages` → `routes/clubs.routes.js`, `controllers/clubs.controller.js`, `services/{animateur,communityService,chat}.service.js`, `routes/chat.routes.js`. `elonga_events`/`elonga_registrations`/`elonga_checkin_tokens` → `services/{event,elonga-events,animateur}.service.js`, `jobs/abonnement.job.js`, `routes/elonga-events.routes.js`.

**Frontend associé** : `public/patient/dashboard.html` (`events`, `clubs`, `clubs/:id/join`, `chat/conversations`), `public/animateur/dashboard.html` (`animateur/clubs`, `animateur/events`, `animateur/checkins/today`), `public/admin/dashboard.html` (`admin/events/pending`, `events/:id/publish`), `public/admin/events-checkin.html`.

**Migrations** : 033, 034 (x3), 039 (x2), 041, 042, 044, 047, 055, 056.

---

### 1.7 Social (follows, feed_items, stories, profiles)

**⚠️ Les noms `feed_items`/`stories`/`profil_social` n'existent pas en tant que tables distinctes.** Le module social repose sur une table unique **`posts`** (`id` UUID, `author_phone` FK→`users(phone)` CASCADE, `content`, `photo_url`+`photo_public_id`, `type` défaut `'manual'` — différencie feed normal vs story via ce champ, `city`, `is_active`, `expires_at`, `metadata` JSONB), avec satellites **`post_likes`** (`post_id`+`phone`, PK composite implicite), **`post_comments`** (`id` UUID, `post_id`, `phone`, `content`), **`story_views`** (`story_id` FK→`posts(id)`, `phone`, `viewed_at`). **`follows`** (`follower_phone`/`following_phone`, tous deux FK→`users(phone)` CASCADE) existe bien en tant que table dédiée. Le "profil social" (`bio`, `interets[]`, `statut_disponibilite`, `avatar_url/pid`, `looking_for`) est porté par des colonnes sur **`users`** (migration_052 + colonnes non trackées), pas par une table `profil_social` séparée malgré le nom de la migration_052.

**Lues/écrites par** : `controllers/{stories,follows,feed}.controller.js`, `services/feed.service.js`. Routes montées directement dans `server.js` : `/api/v1/feed`, `/api/v1/stories`, `/api/v1/follows` (le profil passe par `/api/v1/patients/profil-social`).

**Frontend associé** : `public/patient/dashboard.html` uniquement (`feed`, `feed/:postId/like`, `stories`, `stories/:id/view`, `follows/:phone`, `patients/profil-social/:phone`, `patients/encouragements/received`, `patients/score-bienetre`).

**Migrations** : `posts`/`post_likes`/`post_comments`/`story_views`/`follows` non trouvées dans les migrations lues — table non trackée comme les autres anomalies signalées ; `migration_052_profil_social.sql` n'ajoute que des colonnes sur `users` (`bio`, `interets`, `statut_disponibilite`), pas de table dédiée malgré le titre. `leaderboard_encouragements`/`leaderboard_comments` (migration_046) et `wellness_actions`/`wellness_logs` (migration_039_wellness_sprint2) sont des tables sociales connexes (encouragements, bien-être) rattachées au même domaine.

---

### 1.8 Notifications (notifications, whatsapp_sessions)

**Tables** :
- **`notifications`** (migration_023) — `user_phone` FK→`users(phone)`, `type` CHECK (liste étendue en migration_050 avec `'encouragement'`), `titre`, `message`, `data` JSONB, `canal` CHECK IN (`push`/`whatsapp`/`sms`/`email`), `is_read`, `sent_at`/`read_at`.
- **`push_subscriptions`** (migration_023) — `user_phone` FK, `endpoint`, `p256dh`, `auth`, UNIQUE(`user_phone`, `endpoint`).
- **`whatsapp_sessions`** (migration_045) — `id` VARCHAR PK (session WAHA), `session` TEXT, `created_at`/`updated_at`.
- **`whatsapp_notifications`** (migration_039_chat_conversations) — `recipient_phone`, `template_name`, `template_params` JSONB, `status` CHECK IN (`pending`/`sent`/`failed`/`delivered`).
- **`cron_logs`** (migration_008) — logs d'exécution des jobs planifiés (SMS/push workers).

**Lues/écrites par** : `notifications`/`push_subscriptions` → `routes/notification.routes.js`, `services/{notification,push}.service.js`. `whatsapp_sessions` → `services/whatsapp-session-store.js` uniquement. `cron_logs` → `workers/{notification-worker,sms-worker}.js`.

**Frontend associé** : `public/patient/dashboard.html` uniquement (`notifications/unread-count`, `notifications`, `notifications/:id/read`). **Aucun appel frontend trouvé vers `/push`** — l'abonnement Web Push (VAPID) n'a pas de consommateur frontend actif identifié, malgré la route backend existante.

**Migrations** : 023, 039 (whatsapp_notifications), 045, 050.

---

### 1.9 Configuration (platform_config, migrations_applied)

**Tables** :
- **`platform_config`** (migration_001) — `config_key` UNIQUE, `config_value` (texte), `description`, `updated_at`. Confirmé : c'est bien `config_key`/`config_value` (pas `key`/`value`), conforme à la règle CLAUDE.md.
- **`migrations_applied`** — `id`, `filename`, `applied_at`. Table de tracking des migrations exécutées — mais **son existence même illustre l'anomalie centrale du document** : de nombreuses tables/colonnes citées plus haut (rôle, bolamu_id, appointments, prescriptions, pharmacies, laboratories, posts, admins, secretaires…) n'ont jamais eu de fichier correspondant dans `database/migrations/`, donc ne sont probablement jamais passées par cette table de tracking non plus.

**Lues/écrites par** : `platform_config` (17 fichiers) : `controllers/{auth,patient,qr,partner-convention,remise-partenaire}.controller.js`, `routes/{agent,subscriptions,agence,admin,auth,momo,airtel,payment,collecte,payouts,bank-transfer}.routes.js`, `services/prorata.service.js`.

**Frontend associé** : `public/admin/dashboard.html` (`GET/PUT /admin/config`).

**Migrations** : 001, 003 (seed pricing), 038 (seed zora_earn_rules).

---

## 2. Schéma relationnel — diagramme textuel

```
users (id PK, phone UNIQUE)
  ← doctors (user_id FK→users.id, phone UNIQUE séparé)
  ← pharmacies (user_id FK→users.id)
  ← laboratories (user_id FK→users.id)
  ← secretaires (phone FK→users.phone, partenaire_phone FK→users.phone)
  ← subscriptions (patient_phone FK→users.phone)
  ← payments (patient_phone FK→users.phone, appointment_id FK→appointments.id, subscription_id FK→subscriptions.id)
  ← appointments (patient_phone FK→users.phone, doctor_id FK→doctors.id)
  ← prescriptions (appointment_id FK→appointments.id, patient_phone/doctor_phone/pharmacie_phone FK→users.phone)
  ← lab_prescriptions (appointment_id FK→appointments.id, patient_phone/doctor_phone/lab_phone FK→users.phone)
      ← lab_results (lab_prescription_id FK→lab_prescriptions.id)
  ← rendez_vous (patient_phone/doctor_phone/secretaire_phone FK→users.phone)
      ← consultations (rdv_id FK→rendez_vous.id)
          ← ordonnances (consultation_id FK→consultations.id)
              ← ordonnance_items (ordonnance_id FK→ordonnances.id)
  ← health_records (patient_id/source_user_id FK→users.id)
  ← patient_consents (patient_id FK→users.id)
  ← qr_tokens (user_phone FK→users.phone)
      ← transactions_remise_partenaire (qr_token_id FK→qr_tokens.id, prescription_id FK→prescriptions.id)
  ← bank_transfer_requests (patient_phone FK→users.phone, destination_account_id FK→bolamu_accounts.account_id, subscription_id FK→subscriptions.id)
  ← company_contracts ← company_employees (contract_id FK→company_contracts.id, employee_phone FK→users.phone)
      ← hors_catalogue_transactions (company_contract_id FK→company_contracts.id)
      ← export_paie_mensuel (company_contract_id FK→company_contracts.id)
  ← zora_points / zora_ledger (phone FK→users.phone)
  ← zora_vouchers (phone FK→users.phone, reward_id FK→zora_rewards.id, partner_id FK→zora_partners.id)
  ← elonga_events (organizer_phone FK→users.phone)
      ← elonga_registrations (event_id FK, phone FK→users.phone)
      ← event_registrations (event_id FK→elonga_events.id, patient_phone FK→users.phone)
  ← clubs (animateur_phone FK→users.phone, conversation_id FK→conversations.id)
      ← club_members (club_id FK→clubs.id, patient_phone FK→users.phone)
  ← conversations
      ← conversation_participants (conversation_id FK CASCADE, participant_phone FK→users.phone CASCADE)
      ← messages (conversation_id FK CASCADE, sender_phone FK→users.phone CASCADE)
  ← posts (author_phone FK→users.phone CASCADE)
      ← post_likes / post_comments (post_id FK→posts.id CASCADE, phone FK→users.phone CASCADE)
      ← story_views (story_id FK→posts.id CASCADE, phone FK→users.phone CASCADE)
  ← follows (follower_phone / following_phone FK→users.phone CASCADE)
  ← notifications / push_subscriptions (user_phone FK→users.phone)
  ← documents (owner_id / verified_by FK→users.id)
  ← audit_log (actor_phone — pas de FK déclarée, simple VARCHAR)
```

---

## 3. Points de vigilance et anomalies connues

- **Migrations non exhaustives (anomalie transversale la plus importante)** : les tables `appointments`, `prescriptions`, `lab_prescriptions`, `lab_results`, `pharmacies`, `laboratories`, `payments`, `partner_conventions`, `fraud_signals`, `documents`, `transactions_tiers_payant`/`transactions_remise_partenaire`, `posts`/`post_likes`/`post_comments`/`follows`/`story_views`, `admins`, `secretaires`, `clinics`, `companies`, `otps` (doublon de `otp_codes`) **n'ont aucun `CREATE TABLE` dans `database/`**. De même, sur `users` : les colonnes `role`, `bolamu_id`, `member_code`, `email`, `password`, `photo_url`, `avatar_url`/`avatar_pid`, `looking_for` n'ont aucun `ALTER TABLE` correspondant. Et `clubs.conversation_id`, utilisée dès migration_055, n'est créée par aucune migration lue. **Conclusion : le dossier `database/migrations/` documente uniquement les évolutions incrémentales depuis un schéma de base non versionné dans le dépôt actuel — il ne peut pas servir de source unique de vérité pour reconstruire le schéma complet.** À faire valider par `/database-admin` : soit exporter un schéma de référence (`pg_dump --schema-only`) versionné une bonne fois, soit reconstituer et committer les migrations manquantes a posteriori.

- **Double identifiant patient (`bolamu_id` vs `member_code`)** : les deux colonnes coexistent sur `users` (et `member_code` existe aussi sur `pharmacies`/`laboratories`). `bolamu_id` (format `BLM-XXXX`) est généré/lu dans `qr.controller.js` (`SUBSTRING(bolamu_id FROM 5)`) ; `member_code` est généré par `MAX()+1` (règle CLAUDE.md) et utilisé dans les controllers partenaires (`doctor.controller.js`, `patient.controller.js`). Les deux ne sont pas interchangeables : `bolamu_id` sert l'identification QR/traçabilité, `member_code` sert la numérotation séquentielle d'adhérent.

- **`clearing_transactions.partner_type` exclut `doctor`/`medecin`** (CHECK `chk_partner_type IN ('pharmacie','laboratoire','partenaire')`) — **intentionnel et confirmé** : les médecins sont rémunérés via le circuit CDR clinique (`doctor_payouts`, migration_004), pas via le clearing partenaire pharmacie/labo.

- **`agent_phone` (migration_056)** : ajoutée sur `users`, `pharmacies`, `laboratories`, `doctors` (4 tables exactement, ADD COLUMN additif + index partiels `WHERE agent_phone IS NOT NULL`) — traçabilité de l'agent terrain qui a réalisé l'inscription.

- **`conversation_id` sur `clubs` (migration_055)** : le backfill des clubs actifs sans conversation a été exécuté avec les bonnes valeurs de rôle (`animateur`/`patient`, corrigées le 2026-07-05 suite à un incident prod — la version originale utilisait `admin`/`member`, rejetées par la contrainte CHECK `conversation_participants_role_check IN ('patient','medecin','animateur')`). Les clubs créés après cette correction utilisent également ces valeurs (`clubs.routes.js`, `clubs.controller.js` corrigés).

- **Smart Flow — `company_contract_id` cassé (bug connu, sujet séparé)** : `hors_catalogue_transactions` et `export_paie_mensuel` référencent `company_contracts(id)`, mais deux tables entreprise distinctes existent en prod (`company_contracts` et `companies`), avec un risque de confusion/désynchronisation entre elles. Ne pas corriger dans le cadre de ce document — audit dédié nécessaire.

- **Duplication de systèmes parallèles non consolidés** (dette technique à documenter, pas à corriger ici) :
  - `prescriptions` (liée à `appointments`) vs `ordonnances`/`ordonnance_items` (liée à `consultations`) — deux modèles d'ordonnance.
  - `elonga_registrations`/`elonga_checkin_tokens` (migration_033) vs `event_registrations`/`event_checkin_log` (migration_041) — deux systèmes d'inscription événement.
  - `zora_vouchers`/`zora_rewards` (migration_031) vs `partner_vouchers`/`partner_programs` (migration_040) — deux systèmes de vouchers.
  - `clubs`/`conversations`/`conversation_participants` vs `sport_groups`/`sport_group_members`/`chat_messages` (migration_034, marqué `DEPRECATED` côté routes mais toujours en base).
  - `credits`/`credit_transactions`/`credit_partners` — système de points parallèle à `zora_ledger`/`zora_points`, statut de coexistence non clarifié.
  - `otp_codes` vs `otps` — doublon apparent.

- **`constantes_medicales`** : table lue seule par `ai-consult.service.js` (probablement obsolète/non alimentée), alors que le flux applicatif réel écrit directement sur les colonnes dédiées de `users`. À clarifier avec `/database-admin` avant toute évolution du module IA santé.

- **`admin_password` sur `users`** : colonne présente en clair dans le nom (`admin_password`) en plus de `password_hash`/`password` — à faire auditer par `/security-officer` (nom de colonne suggérant un usage sensible, à vérifier qu'aucun mot de passe n'y est stocké en clair).
