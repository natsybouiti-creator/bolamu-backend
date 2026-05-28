# BOLAMU — CONTEXTE PROJET
Mis à jour : 28 mai 2026
Statut : EN PRODUCTION — https://bolamu-backend.onrender.com
Score Ayokai : 21/23 (91.3%)

## VISION PRODUIT
Plateforme de santé numérique au Congo-Brazzaville. Connecte patients, médecins, pharmacies et laboratoires. Developed by NBA Gestion SARLU.

## ARCHITECTURE TECHNIQUE
- Runtime : Node.js/Express — Render Standard (port 10000)
- Base de données : PostgreSQL Neon (Frankfurt)
- Auth : JWT access 15min + refresh 7j + bcrypt
- Rate limiting : express-rate-limit (strict 5/15min sur auth)
- Sécurité : Helmet + CORS whitelist + HMAC webhooks
- Stockage : Cloudinary (cloud_name: dpxefz80w)
- SMS : Africa's Talking (sandbox — Live en attente crédit)
- Email : Resend
- Push : Web Push VAPID (optionnel)
- WhatsApp : Meta Business API (optionnel)
- IA : Anthropic Claude — agent Amina (optionnel)
- Monitoring : Winston + BetterStack + Prometheus /metrics
- CI/CD : GitHub Actions 6 jobs + Docker multi-stage
- Frontend : HTML/CSS/JS vanilla
- Repo : natsybouiti-creator/bolamu-backend

## DESIGN SYSTEM
- Fonts : Plus Jakarta Sans + Fraunces
- Couleurs : navy #0A2463 + turquoise #00C9A7

## TABLES PRINCIPALES ET RÈGLES CRITIQUES

### users
Colonnes : id, phone, role, full_name, first_name, last_name, gender, age, city, neighborhood, is_active, validated_at, document_url, trust_score, member_code, banned, password_hash, id_card_url, id_card_public_id, niu, created_at

- Table centrale pour TOUS les utilisateurs sans exception
- Identifiant universel : phone (jamais l'id numérique)
- Roles : 'patient', 'doctor', 'pharmacie', 'laboratoire', 'admin', 'content_admin', 'secretaire', 'company_rh'
- is_active : boolean (jamais un champ status string dans users)
- password_hash : mot de passe bcrypt — tous les comptes en ont un depuis migration 25 avril 2026
- id_card_url : carte d'identité patient (Cloudinary)
- niu : Numéro d'Identification Unique (optionnel, patients)
- Constantes médicales (migration_014) : groupe_sanguin, allergies, maladies_chroniques, antecedents_medicaux, traitements_en_cours, poids, taille, contact_urgence_nom, contact_urgence_phone, contact_urgence_lien, constantes_remplies_par, constantes_updated_at
- Soft delete uniquement — jamais de DELETE

### doctors
Colonnes : id, phone, user_id, full_name, specialty, registration_number, city, neighborhood, status, is_active, member_code, document_url, trust_score, momo_number, created_at
- is_active vient TOUJOURS de cette table, jamais de users
- status : enum('pending', 'verified', 'suspended')
- JOIN users obligatoire pour récupérer validated_at

### pharmacies
Colonnes : id, phone, user_id, name, responsible_name, rccm_number, city, neighborhood, status, is_active, member_code, document_url, trust_score, momo_number, created_at
- is_active vient TOUJOURS de cette table, jamais de users
- status : enum('pending', 'verified', 'suspended')

### laboratories
Colonnes : id, phone, user_id, name, director_name, agrement_number, rccm_number, city, neighborhood, status, is_active, member_code, document_url, trust_score, momo_number, created_at
- is_active vient TOUJOURS de cette table, jamais de users
- status : enum('pending', 'verified', 'suspended')

### appointments
Colonnes : id, patient_phone, doctor_id, appointment_date, appointment_time, status, status_new, session_code, notes, created_at, updated_at, opened_at, validated_at, validation_delay_minutes, consultation_duration_minutes, doctor_lat, doctor_lng, report_submitted
- doctor_id : référence à doctors.id (pas doctor_phone)

### prescriptions
Colonnes : id, patient_phone, doctor_phone, status, created_at

### lab_prescriptions (Sprint 4)
Colonnes : id, prescription_id, medication, dosage, instructions, created_at
- Table des prescriptions laboratoire (pas lab_orders)

### refresh_tokens (Sprint 5)
Colonnes : id, user_phone, token, expires_at, created_at
- JWT refresh tokens 7 jours

### audit_log
Colonnes : id, event_type, actor_phone, target_table, target_id, payload, created_at
- Insert-only — jamais de UPDATE ou DELETE

### fraud_signals
Colonnes : id, signal_type, severity, actor_phone, appointment_id, details, created_at, fraud_score
- fraud_score : INTEGER 0-100 DEFAULT 0 (migration_013)

### Nouvelles tables Sprints 1-9
conflicts, conflict_messages, conflict_actions,
coupons, coupon_usages, idempotency_keys,
push_subscriptions, notifications,
secretaires, file_attente, agenda_blocs,
pre_rdv_formulaires, ai_consult_sessions,
renouvellement_demandes,
hors_catalogue_transactions, medicaments_catalogue, export_paie_mensuel,
appointment_symptoms, secretary_assignments, agenda_blocks, queue_entries

### platform_config — taux actuels
- price_essentiel / price_annuel_essentiel : 2000 / 24000 FCFA
- price_standard / price_annuel_standard : 4000 / 48000 FCFA
- price_premium / price_annuel_premium : 10000 / 120000 FCFA
- partner_rate_bolamu : 0.50
- partner_rate_clinique : 0.30
- partner_rate_pharmacie : 0.125
- partner_rate_laboratoire : 0.075
- discount_rate_pharmacie : 0.15 (réduction accordée aux adhérents)
- discount_rate_laboratoire : 0.10 (réduction accordée aux adhérents)

### ENUMs PostgreSQL
- doctor_status : {pending, verified, suspended}
- subscription_plan : {essentiel, standard, premium}
- subscription_status : {active, expired, suspended}
- user_type_enum : {patient, medecin, pharmacie, laboratoire, entreprise, admin}
- payment_status : {pending, success, failed, refunded, reconciling}
- payment_method : {mtn_momo, airtel_money, bank_transfer, cash, simulation}
- account_type : {mtn_momo, airtel_money, bank_account}
- convention_status : {pending, actif, suspendu, resilie}
- transaction_status : {pending, validated, paid, rejected, reconciling}
- bank_transfer_status : {pending, reconciled, activated, rejected}
- company_contract_status : {draft, signed, active, terminated}
- company_employee_status : {pending, active, suspended}
- partner_payout_status : {pending, paid, failed}
- partner_zone_type : {clinique, pharmacie, laboratoire}

### Tables manquantes (roadmap)
notifications

## AUTHENTIFICATION — SYSTÈME ACTUEL (depuis 25 avril 2026)
- Connexion : téléphone + mot de passe permanent (bcrypt) — plus d'OTP à chaque connexion
- Inscription : OTP envoyé pour vérification du numéro, puis mot de passe généré automatiquement et envoyé par SMS
- Mot de passe oublié : nouveau mot de passe généré et envoyé par SMS via POST /api/v1/auth/forgot-password
- Changement de mot de passe : disponible depuis le profil pour tous les rôles
  - Patient : POST /api/v1/patients/change-password
  - Médecin : POST /api/v1/doctors/change-password
  - Pharmacie : POST /api/v1/pharmacies/change-password
  - Laboratoire : POST /api/v1/laboratories/change-password
- Admin : auth séparée — rôles 'admin' et 'content_admin' acceptés, redirection vers dashboard.html ou content.html

## MEMBER CODES
- Patients : BLM-XXXXX
- Médecins : MED-XXXXX
- Pharmacies : PHM-XXXXX
- Laboratoires : LAB-XXXXX
- Génération : MAX(numéro existant) + 1 — jamais COUNT (risque de doublons si trous dans séquence)

## INSCRIPTION PATIENTS
- Champs obligatoires : téléphone, nom, prénom, genre, âge, ville, quartier, carte d'identité (upload Cloudinary)
- Champ optionnel : NIU (Numéro d'Identification Unique)
- is_active = true immédiatement après inscription (pas de validation admin requise)

## INSCRIPTION PARTENAIRES (médecin, pharmacie, laboratoire)
- is_active = false par défaut — validation admin obligatoire
- Documents uploadés sur Cloudinary
- INSERT dans users ET table spécifique dans la même transaction
- document_url synchronisé dans users ET table spécifique

## LOCALSTORAGE KEYS
- bolamu_patient_token / bolamu_patient_phone
- bolamu_doctor_token / bolamu_doctor_phone
- bolamu_pharmacie_token / bolamu_pharmacie_phone
- bolamu_laboratoire_token / bolamu_laboratoire_phone
- bolamu_secretaire_token / bolamu_secretaire_phone
- bolamu_rh_token / bolamu_rh_phone

## FLUX VALIDÉS EN PRODUCTION
- Inscription patient (OTP vérification → mot de passe généré → SMS → compte actif)
- Inscription partenaire (OTP → INSERT users + table spécifique → validation admin)
- Connexion (téléphone + mot de passe → JWT)
- Mot de passe oublié (SMS nouveau mot de passe)
- Changement mot de passe depuis profil (tous les rôles)
- Validation admin (PATCH /api/v1/admin/validate → is_active=true + validated_at)
- Dashboard admin : comptes en attente, modal profil avec documents + carte d'identité patient
- Consultation médecin (appointment → dashboard patient)
- Prescription médicale (création → pharmacie/labo)
- Résultats labo (QR code scan → dépôt résultats)
- Pharmacie délivrance (QR code scan → remise tiers payant)
- Timeline patient (RDV, prescriptions, résultats)
- QR code authentification
- Téléconsultation JaaS 8x8.vc
- RDV patient : GET /api/v1/appointments/patient/:phone
- Sentry monitoring

## FLUX IMPLÉMENTÉS — EN ATTENTE DE TEST
- Virements bancaires individuels (patient → Bolamu) et B2B (entreprise → Bolamu)
- Clearing mensuel partenaires automatique (calcul + versements MTN/Airtel)
- Versements MTN MoMo Disbursement et Airtel Money vers partenaires avec détection opérateur

## ADMIN — DEUX RÔLES
- 'admin' : accès dashboard.html — gestion complète
- 'content_admin' : accès content.html — gestion éditoriale articles
- Middleware requireContentAdmin accepte les deux rôles
- Colonne : role (VARCHAR), password_hash stocké dans admin_password, pas de colonne status

## RÈGLES ARCHITECTURALES ABSOLUES — NE JAMAIS VIOLER
1. Table users unique — jamais de tables séparées pour l'identité
2. Identifiant universel : phone — jamais l'id numérique
3. is_active des partenaires vient TOUJOURS de la table spécifique (doctors/pharmacies/laboratories)
4. validated_at se récupère TOUJOURS via LEFT JOIN users
5. is_active = false forcé à l'inscription pour tous les partenaires
6. Cloudinary centralisé via src/utils/cloudinary.js — jamais de config locale
7. Toute normalisation de numéro passe par normalizePhone() — jamais de regex inline
8. Numéros congolais : format +2420XXXXXXXX (12 chiffres avec le 0)
9. instrument.js Sentry dans src/ — chargé en première ligne de src/server.js
10. audit_log : insert-only — colonnes event_type, actor_phone, target_table, target_id, payload
11. Soft delete uniquement — jamais de DELETE sur users
12. member_code généré avec MAX() + 1 — jamais COUNT()
13. Taux répartition partenaires : TOUJOURS depuis platform_config (partner_rate_*) — jamais hardcodés
14. Prix abonnements : TOUJOURS depuis platform_config (price_*) — jamais hardcodés
15. Calcul forfait partenaire : adherents × price_essentiel × partner_rate
16. SMS : TOUJOURS via src/services/sms.service.js (sendBolamuSms) — jamais réinitialiser AfricasTalking directement
17. La table prescriptions labo s'appelle lab_prescriptions (pas lab_orders)
18. refresh_tokens table existe pour JWT refresh tokens 7 jours
19. Middleware : rateLimiter (strict 5/15min, standard 30/min, webhook 100/min)
20. Middleware : idempotency sur POST paiements
21. Middleware : validateMtnWebhook pour HMAC-SHA256
22. Middleware : requestLogger pour logs structurés Winston
23. Middleware : errorHandler pour erreurs standardisées sans stack trace
24. Paiements manuels uniquement (pas d'API MTN/Airtel)
25. 7 rôles : patient, doctor, pharmacie, laboratoire, admin, content_admin, secretaire

## BUGS CORRIGÉS — NE JAMAIS REPRODUIRE
- Double insertion users à l'inscription partenaire — supprimé INSERT users dans auth.controller.js
- is_active calculé sur trust_score — remplacé par is_active = false forcé
- Incohérence localStorage keys — standardisé par rôle
- validated_at manquant dans getProfile — LEFT JOIN users ajouté
- normalizePhone non utilisée dans requestOtp/login — centralisée
- Double format numéros congolais — migré vers +2420XXXXXXXX
- Route GET /appointments/patient/:phone manquante — créée
- Jitsi meet.jit.si bloqué — migré vers JaaS 8x8.vc
- instrument.js Sentry mal placé — déplacé dans src/
- member_code doublon (COUNT au lieu de MAX) — corrigé le 25 avril 2026
- Dashboard admin panel En attente crashait (catch(err) variable shadowing) — corrigé
- Badge is_active non mappé sur strings — corrigé
- renderPartners() appelée dans INIT dashboard patient alors que remplacée par loadCarte() — supprimé le 25 avril 2026
- PATCH /api/v1/admin/validate mettait is_active dans users au lieu de la table spécifique — supprimé 25 avril 2026, remplacé par POST /validate-user
- document_public_id non récupéré à l'inscription partenaire — corrigé 25 avril 2026 (register.html + auth.controller.js)
- handlePaymentSuccess mettait à jour users.statut_abonnement au lieu de créer dans subscriptions — corrigé 25 avril 2026
- Montant paiement MoMo non validé contre platform_config — corrigé 25 avril 2026

## TRAVAUX EN COURS — SUITE IMMÉDIATE
Mis à jour : 28 avril 2026

### Corrections appliquées — 28 avril 2026
✅ Statuts payments — déjà unifiés (pending/success/failed)
✅ Montants hardcodés — déjà corrigés dans admin.routes.js
✅ Médecins couverts via forfait mensuel partner_payouts
✅ phone vs patient_phone — pas de problème confirmé
✅ Validation montant frontend — déjà en place dans payment.routes.js
✅ Taux partenaires dynamiques depuis platform_config
✅ Prix plans corrigés (Standard 5000→4000, annual 60000→48000)
✅ Migration 008 — système collecte 4 canaux déployé
✅ Routes /api/v1/collecte/* — 11 routes déployées
✅ Job cron abonnements — démarré automatiquement au lancement serveur

### Infrastructure financière — Actions en attente
🔴 Renseigner rib_france_qonto dans platform_config
   (attente ouverture compte Qonto/Revolut Business France)
🔴 Finaliser ouverture compte Ecobank Congo NBA Gestion SARLU
� Négociation MTN Congo Entreprises — API Subscriptions + taux préférentiel
   (document de négociation produit — Bolamu_MTN_Negociation.docx)
🟠 Activer Airtel Money API — credentials attendus 29 avril 2026
🟠 Activer Africa's Talking Live (en attente crédit)
🟡 Tester routes /api/v1/collecte/* en sandbox
🟡 Audit /subscriptions — vérifier accès conditionnel par plan
🟡 Passer Render au plan payant avant lancement
🟡 Acheter domaine bolamu.co

## PAIEMENTS — MODÈLE MANUEL (DÉCISION DÉFINITIVE)
Pas d'API MTN MoMo ni Airtel Money.
Raison : frais API 3% vs frais manuel 1%.
Flux : patient paie sur numéro marchand → admin valide
l'abonnement depuis le dashboard.
Variables MTN_* et AIRTEL_* optionnelles dans .env.

## MODÈLE TARIFAIRE — DÉFINITIF
- Bronze/MOTO : 1 personne — 2 000 FCFA/mois
- Silver/NDEKO : 2 personnes — 5 000 FCFA/mois
- Gold/LIBOTA : 5 personnes — 10 000 FCFA/mois
Toujours depuis platform_config — jamais hardcodé.

## RÉMUNÉRATION PARTENAIRES CDR
- Cliniques : 30% — Pharmacies : 12.5% — Laboratoires : 7.5%
- Bolamu : 50%
- Versement : 25 du mois au 5 du mois suivant
- Canal : virement bancaire uniquement

## 9 RÔLES UTILISATEURS
patient, doctor, pharmacie, laboratoire,
admin, content_admin, secretaire, company_rh

### Système de collecte 4 canaux — DÉPLOYÉ
- Canal 1 OVP Bancaire : bancarisés Congo — Ecobank Congo (en attente ouverture compte)
- Canal 2 MoMo Annuel : non bancarisés — MTN MoMo actif + Airtel dès activation
- Canal 3 Tiers Payant Familial : payeur bancaire, bénéficiaires illimités
- Canal 4 SEPA Diaspora : congolais Europe — compte France NBA Gestion (en attente)

## COMPTES DE TEST
- Patient : +242069735418
- Médecin : +242060000001 (Dr. Mbemba Jean)
- Pharmacie : +242066226116
- Laboratoire : +242068582563
- Admin : +242060000099

### Partenaires de test avec conventions actives
- Pharmacie +242066226116 (mot de passe : WR383LMW) — convention active, discount 15%
- Labo +242068582563 — convention active, discount 10%
- Labo +242063125478 — convention active, discount 10%
- partner_zones : Plateau/pharmacie, Plateau/labo, Brazzaville/labo

## ÉTAT ACTUEL — 25 AVRIL 2026

### Fonctionnel ✅
- Auth OTP+JWT + mot de passe permanent pour tous les rôles
- Inscription complète 4 rôles avec upload documents
- Dashboard admin (validation, modal profil, carte identité patient)
- Dashboard patient (RDV, profil, changement mot de passe, carte intervenants Leaflet)
- Dashboard médecin (profil, changement mot de passe, géolocalisation GPS)
- Dashboard pharmacie (profil, changement mot de passe, géolocalisation GPS)
- Dashboard laboratoire (profil, changement mot de passe, géolocalisation GPS)
- Rotating QR code tiers payant
- Appointment flow complet
- Jitsi JaaS téléconsultation
- Cloudinary upload documents
- TrustScore auto-validation à 80+/100
- Sentry monitoring
- Admin dual-role (admin + content_admin)
- CGU + Confidentialité + Page urgence
- Dossier médical — consultation_reports + dossier_access_log + routes
- Constantes médicales patient ✅ — API complète (get/update patient + update médecin) + dashboard patient modal d'édition + dashboard médecin intégré
- Timeline patient + Rapports de consultation médecin
- Credits Bolamu + Articles / blog santé + Admin content editor
- Prescriptions flux complet + Flux labo→patient complet
- Système de notation patients — ratings, étoiles + adjectifs + panel admin
- MTN MoMo — flux paiement corrigé (handlePaymentSuccess crée maintenant dans subscriptions + audit_log + validation montant contre platform_config)
- Clearing mensuel partenaires — taux dynamiques depuis platform_config (partner_rate_clinique 30%, partner_rate_pharmacie 12.5%, partner_rate_laboratoire 7.5%)
- Géolocalisation — GPS dans dashboards intervenants + carte Leaflet patient
- index.html — inscription patient complète avec NIU + CNI Cloudinary
- localStorage keys standardisées par rôle
- MCP Neon configuré dans Windsurf (mcp_config.json) — requêtes SQL directes depuis Cascade
- Système de collecte 4 canaux — Migration 008 déployée
  (tables ovp_documents, beneficiaires_familiaux, cron_logs)
- Routes API collecte /api/v1/collecte/* — 11 routes (OVP, MoMo annuel, 
  Familial, SEPA diaspora + routes admin)
- Job cron abonnements — 02h00 Brazzaville (expiration MoMo annuel, 
  rappels SMS J-30, suspension cascade bénéficiaires)
- platform_config — modèle tarifaire définitif :
  Essentiel 1 pers. 2000/24000, Standard 2 pers. 4000/48000, 
  Premium 5 pers. 10000/120000 FCFA (mois/an)
- platform_config — taux répartition partenaires :
  clinique 30%, pharmacie 12.5%, laboratoire 7.5%, Bolamu 50%

### Partiel ⚠️
- Africa's Talking (sandbox — activation Live en attente crédit)
- Partner conventions ✅ IMPLÉMENTÉ — src/controllers/partner-convention.controller.js — routes POST/GET/PATCH /api/v1/admin/conventions — 3 conventions actives en base
- Transactions tiers payant ✅ IMPLÉMENTÉ ET TESTÉ EN PRODUCTION — src/controllers/tiers-payant.controller.js — routes /api/v1/tiers-payant et /api/v1/admin/tiers-payant — test validé : 10 000 FCFA → remise 1 500 FCFA → patient paie 8 500 FCFA
- Workflows agents Windsurf — 9 agents créés dans .windsurf/workflows/
- Compte MTN MoMo marchand — numéro actif depuis 28 avril 2026
- Compte Airtel Money marchand — attendu 29 avril 2026
- Compte Ecobank Congo NBA Gestion SARLU — en attente ouverture
- Compte France Qonto/Revolut Business — en attente ouverture
- rib_france_qonto dans platform_config — à renseigner dès ouverture compte

### Absent ❌
- Notifications push
- Domaine custom — bolamu.co disponible, achat en attente
- Airtel Money — en attente credentials API

## TABLES EXISTANTES — LISTE COMPLÈTE
users, doctors, pharmacies, laboratories, appointments, prescriptions, payments, subscriptions, credits, credit_transactions, credit_partners, fraud_signals, audit_log, platform_config, articles, content_blocks, qr_tokens, lab_prescriptions, lab_results, consultation_reports, dossier_access_log, partner_conventions, transactions_tiers_payant, otp_codes, ratings, doctor_payouts (obsolète — non utilisée), bolamu_accounts, bank_transfer_requests, company_contracts, company_employees, partner_zones, partner_payouts, ovp_documents, beneficiaires_familiaux, cron_logs, conflicts, conflict_messages, conflict_actions, coupons, coupon_usages, idempotency_keys, push_subscriptions, notifications, secretaires, file_attente, agenda_blocs, pre_rdv_formulaires, ai_consult_sessions, renouvellement_demandes, hors_catalogue_transactions, medicaments_catalogue, export_paie_mensuel, appointment_symptoms, secretary_assignments, queue_entries

## COLONNES GPS AJOUTÉES — 25 AVRIL 2026
Tables users, doctors, pharmacies, laboratories — latitude DECIMAL(10,7), longitude DECIMAL(10,7), address TEXT

## TABLES FINANCIÈRES — COLONNES AJOUTÉES — 27 AVRIL 2026

### payments (Migration 005)
Colonnes ajoutées : direction, payment_method_new, payment_type, subscription_id, appointment_id, source_account_id, source_account_type, source_account_reference, destination_account_id, destination_account_type, destination_account_reference, external_reference, notes, reconciled_at, reconciled_by

### partner_conventions (Migration 005)
Colonnes ajoutées : status_new, started_at, expires_at, payout_account_id, payout_account_type, payout_account_reference, partner_account_id, partner_account_type, partner_account_reference, contract_document_url, validated_by, validated_at

### transactions_tiers_payant (Migration 005)
Colonnes ajoutées : convention_id, status_new, source_account_id, source_account_type, source_account_reference, destination_account_id, destination_account_type, destination_account_reference, notes, reconciled_at, reconciled_by

### Nouvelles tables (Migration 006)
- bolamu_accounts : référentiel des comptes NBA Gestion SARLU (MTN MoMo, Airtel Money, comptes bancaires)
- bank_transfer_requests : virements individuels patients (référence BOL-{phone}-{YYYYMMDD}-{random4})
- company_contracts : contrats entreprises B2B (référence BOL-B2B-{company_code}-{YYYYMMDD})
- company_employees : employés rattachés aux contrats entreprises

## ROADMAP — ÉTAT RÉEL
- Ph1 : Quick fixes ✅ TERMINÉ
- Ph2 : CGU + confidentialité ✅ TERMINÉ
- Ph3 : Dossier médical ✅ TERMINÉ
- Ph4 : Prescriptions + flux labo ✅ TERMINÉ
- Ph5 : Ratings + commentaires ✅ TERMINÉ
- Ph6 : MTN MoMo frontend ✅ TERMINÉ
- Ph7 : Géolocalisation + carte patient ✅ TERMINÉ
- Ph8 : Production — domaine custom, Africa's Talking Live, Airtel Money (en attente)

## WORKFLOWS AGENTS — ÉQUIPE DE DÉVELOPPEMENT
Mis à jour : 25 avril 2026

### Agents d'audit permanent
- `/bugcheck` — Détection bugs, code mort, fetch cassés, INIT dashboards
- `/securite` — Audit routes, JWT, inputs, données sensibles
- `/database` — Audit SQL, transactions, index, cohérence schéma
- `/performance` — Scalabilité, pagination, timeouts, Render
- `/design` — Cohérence UI/UX, responsive, design system

### Agents phase actuelle (flux partenaires + financiers)
- `/partenaires` — Flux complet médecin/pharmacie/laboratoire
- `/paiements` — MTN MoMo, Airtel Money, flux financiers
- `/subscriptions` — Abonnements Essentiel/Standard/Premium
- `/deployment` — Checklist pré-déploiement production

### Règles d'utilisation des agents
- Toujours lancer /bugcheck et /deployment avant un push important
- Toujours lancer /partenaires avant de déclarer le flux partenaire terminé
- Toujours lancer /paiements avant toute modification des routes financières
- Les agents auditent D'ABORD, proposent ENSUITE, agissent APRÈS validation
- Un problème à la fois — jamais de correction en masse

### Deuxième vague à créer (roadmap)
- `/notifications` — SMS Africa's Talking + notifications système
- `/tests` — Génération tests automatisés flux critiques
- `/api` — Cohérence endpoints backend ↔ appels frontend

## ROUTES COLLECTE — /api/v1/collecte (Migration 008 — 28 avril 2026)

### Canal 1 — OVP Bancaire
- POST /ovp/initier — Génère PDF OVP pré-rempli + stocke Cloudinary
- GET /ovp/statut — Statut OVP adhérent connecté

### Canal 2 — MoMo Annuel  
- POST /momo/initier — Initie paiement MoMo annuel (24000/48000/120000 FCFA)

### Canal 3 — Tiers Payant Familial
- POST /familial/ajouter — Ajoute bénéficiaire (bénéficiaires illimités)
- DELETE /familial/retirer/:phone — Retire bénéficiaire
- GET /familial/mes-beneficiaires — Liste bénéficiaires avec statut

### Canal 4 — SEPA Diaspora
- POST /sepa/initier — Crée dossier SEPA + retourne RIB France

### Admin collecte (requireAdmin)
- GET /admin/dashboard — Vue consolidée 4 canaux
- PATCH /admin/ovp/valider/:phone — Valide OVP + active adhérent + bénéficiaires
- PATCH /admin/sepa/valider/:phone — Valide SEPA + active adhérent + bénéficiaires
- GET /admin/ovp/fichier-mensuel — Génère CSV Ecobank mensuel

## MIGRATIONS — SESSION 29 AVRIL 2026
- migration_009 : ENUM partner_zone_type 'doctor'→'clinique' + colonne status_new dans qr.controller + bolamu_share_fcfa (ajouté puis supprimé)
- migration_010 : suppression bolamu_share_fcfa de transactions_tiers_payant
- migration_011 : ajout montant_total, montant_remise, montant_patient dans transactions_tiers_payant
- migration_012 : nettoyage transactions_tiers_payant — suppression colonnes hors modèle Health Streaming (status, source_account_*, destination_account_*, paid_at, audit_ref) — table ramenée à 16 colonnes
- migration_013 : ajout fraud_score INTEGER 0-100 DEFAULT 0 dans fraud_signals
- migration_014 : ajout 12 colonnes constantes médicales dans users
- migration_015 : suppression doublon traitement_en_cours (colonne officielle : traitements_en_cours)

## MODÈLE HEALTH STREAMING — RÈGLE ABSOLUE
- Bolamu verse un forfait mensuel aux partenaires (taux depuis platform_config × adhérents dans leur zone)
- En échange : pharmacies et laboratoires accordent une réduction sur facture adhérents (discount_rate depuis platform_config)
- AUCUN remboursement en temps réel — traçabilité pure uniquement
- Les médecins/cliniques ne font PAS de tiers payant — couverts uniquement par le forfait mensuel

## LOGS RENDER — ÉTAT PROPRE (27 mai 2026)
- Index appointments : corrigé doctor_phone → doctor_id
- Migration boot addValidatedAtColumn : supprimée de server.js
- fraud_score : colonne créée en base (migration_013)
- Fichiers temporaires racine : 27 fichiers supprimés (commit 6f98616)
- Aucun avertissement au démarrage

## ROUTES API MONTÉES (depuis server.js)
auth.routes.js — /api/v1/auth
patient.routes.js — /api/v1/patients
doctor.routes.js — /api/v1/doctors
appointment.routes.js — /api/v1/appointments
payment.routes.js — /api/v1/payments
prescription.routes.js — /api/v1/prescriptions
pharmacie.routes.js — /api/v1/pharmacies
laboratoire.routes.js — /api/v1/laboratories
admin.routes.js — /api/v1/admin
credits.routes.js — /api/v1/credits
momo.routes.js — /api/v1/payments/momo
airtel.routes.js — /api/v1/payments/airtel
telemedicine.routes.js — /api/v1/telemedicine
qr.routes.js — /api/v1/qr
report.routes.js — /api/v1/reports
lab.routes.js — /api/v1/lab
ratings.routes.js — /api/v1/ratings
payouts.routes.js — /api/v1/payouts
bank-transfer.routes.js — /api/v1/bank-transfer
clearing.routes.js — /api/v1/clearing
collecte.routes.js — /api/v1/collecte
partner-convention.routes.js — /api/v1/admin/conventions
tiers-payant.routes.js — /api/v1/tiers-payant
constantes-medicales.routes.js — /api/v1/patients/constantes-medicales, /api/v1/doctors/constantes-medicales
conflict.routes.js — /api/v1/conflicts
coupon.routes.js — /api/v1/coupons
notification.routes.js — /api/v1/notifications
secretariat.routes.js — /api/v1/secretariat
preRdv.routes.js — /api/v1/pre-rdv
articles.routes.js — /api/v1/articles
map.routes.js — /api/v1/map
smartflow.routes.js — /api/v1/smartflow
ai-consult.routes.js — /api/v1/ai-consult
push.routes.js — /api/v1/push

## SERVICES DISPONIBLES (src/services/)
airtel.service.js — Service Airtel Money
amina.service.js — Service IA Amina (Anthropic Claude)
conflict.service.js — Service gestion conflits
coupon.service.js — Service coupons
notification.service.js — Service notification unifié (WhatsApp, Push, SMS)
preRdv.service.js — Service pré-RDV complet
prorata.service.js — Service prorata abonnements
push.service.js — Service push notifications (Web Push)
renouvellement.service.js — Service renouvellement assisté
secretariat.service.js — Service secrétariat
smartflow.service.js — Service Smart Flow SSP/hors catalogue
sms.service.js — Service SMS Africa's Talking
triage.service.js — Service triage feu tricolore
whatsapp.service.js — Service WhatsApp Business API

## MIDDLEWARE DISPONIBLES (src/middleware/)
auth.middleware.js — Middleware authentification JWT (requireAdmin, requireSecretary, requireRH, requireOpsAdmin)
errorHandler.js — Gestion erreurs globale
idempotency.js — Middleware idempotence
rateLimiter.js — Rate limiting (OTP: 5/15min, login: 20/hour)
requestLogger.js — Logger requêtes
validateAirtelWebhook.js — Validation webhook Airtel
validateMtnWebhook.js — Validation webhook MTN MoMo

## MIGRATIONS EXÉCUTÉES (database/migrations/)
migration_001_doctors_subscriptions.sql
migration_002_commands.sql
migration_003_update_pricing.sql
migration_004_doctor_payouts.sql
migration_005_financial_tracing.sql
migration_006_bank_transfers.sql
migration_007_partner_clearing.sql
migration_008_collecte_4canaux.sql
migration_009_fix_enum_and_qr.sql
migration_010_cleanup_tiers_payant.sql
migration_011_transactions_colonnes.sql
migration_012_cleanup_transactions.sql
migration_013_fraud_score.sql
migration_014_constantes_medicales.sql
migration_015_remove_traitement_en_cours.sql
migration_016_subscriptions_unique_constraint.sql
migration_017_refresh_tokens.sql
migration_018_time_slots.sql
migration_019_lab_orders_priority.sql
migration_020_conflicts.sql
migration_021_coupons.sql
migration_022_production_optimizations.sql
migration_023_notifications.sql
migration_024_secretariat.sql
migration_025_pre_rdv.sql
migration_026_smart_flow.sql
migration_027_symptoms.sql

## ACTIONS HUMAINES RESTANTES
- Domaine bolamu.co — achat + DNS Cloudflare → Render
- VAPID keys — npx web-push generate-vapid-keys → Render
- ANTHROPIC_API_KEY — console.anthropic.com → Render
- Africa's Talking Live — activer avec crédit
- Test MTN MoMo réel
- Test SMS réel

## MIGRATIONS AJOUTÉES — 28 MAI 2026
- migration_026_smart_flow.sql : tables hors_catalogue_transactions, medicaments_catalogue, export_paie_mensuel
- migration_027_symptoms.sql : table appointment_symptoms

## NOUVELLES TABLES — 28 MAI 2026
- hors_catalogue_transactions : trace chaque acte hors SSP (patient, prestataire, libelle, prix_plein, company_contract_id, statut)
- medicaments_catalogue : 52 médicaments SSP OMS 2023 (nom_generique, categorie, is_ssp, source_oms)
- export_paie_mensuel : exports paie mensuel par grand compte (company_contract_id, mois, nb_actes_ssp, montant_hors_catalogue, details_json, statut)
- appointment_symptoms : symptômes pre-RDV patient (appointment_id, motif, symptomes JSONB, duree_symptomes, intensite, traitements_en_cours, remarques_patient)
- secretary_assignments : assignation secrétaires aux partenaires
- agenda_blocks : blocages créneaux médecin
- queue_entries : file d'attente temps réel (waiting/in_consultation/completed/absent)

## NOUVEAUX RÔLES — 28 MAI 2026
- secretaire : dashboard secrétariat (agenda, file d'attente, blocages, stats)
- company_rh : dashboard RH Grand Compte (employés, SSP, hors catalogue, export paie CSV)
Total rôles : 9 (patient, doctor, pharmacie, laboratoire, admin, content_admin, secretaire, company_rh + ancien rôle entreprise)

## NOUVEAUX SERVICES — 28 MAI 2026
- src/services/smartflow.service.js : isSSP(), enregistrerHorsCatalogue(), getStatsPartenaire(), genererExportPaie(), getStatsAdmin()
- src/services/ai-consult.service.js : generateBriefing(), analyzeTricolor(), generateRenewal()
- src/services/push.service.js : subscribe(), unsubscribe(), sendPush(), sendPushBulk()

## NOUVELLES ROUTES MONTÉES — 28 MAI 2026
- /api/v1/smartflow/* : Smart Flow prestataires + RH + admin
- /api/v1/ai-consult/* : briefing IA, feu tricolore, renouvellement assisté
- /api/v1/appointments/:id/symptoms : symptômes pre-RDV
- /api/v1/push/* : notifications push web
- /api/v1/secretary/* : dashboard secrétariat
- /api/v1/admin/secretaries : gestion équipe secrétaires
- /api/v1/conflicts/* : module conflits patient + admin
- /api/v1/coupons/* : coupons et réductions
- /api/v1/admin/smartflow/* : stats Smart Flow admin

## NOUVEAUX DASHBOARDS — 28 MAI 2026
- public/secretaire/dashboard.html : agenda, file d'attente, blocages, stats
- public/rh/dashboard.html : vue d'ensemble, détail employés, export paie CSV, configuration mode

## MODULES COMPLÉTÉS — 28 MAI 2026
- Smart Flow Grands Comptes : tagging SSP/hors catalogue dans dashboards médecin + pharmacie + labo + RH
- AI Consult Amina : briefing pre-consultation + feu tricolore + renouvellement assisté
- Module Conflits : cycle complet Created→Resolved, dashboard patient + admin
- Notifications Push : Service Worker sw.js + BullMQ worker + routes subscribe/unsubscribe
- Dashboard Secrétariat : 7ème rôle complet
- Coupons + Prorata + Idempotence : middleware idempotency sur tous les endpoints paiement critiques

## INFRASTRUCTURE — 28 MAI 2026
- BullMQ installé : queues + workers (sms-worker.js, notification-worker.js)
- src/queues/bolamu-queue.js : queue principale + addNotificationJob()
- src/workers/sms-worker.js : SMS batch
- src/workers/notification-worker.js : push + SMS
- public/sw.js : Service Worker notifications push
- database/seeds/seed_medicaments_ssp.sql : 52 médicaments SSP OMS 2023

## SÉCURITÉ CORRIGÉE (Sprint 1) — 28 MAI 2026
- CRIT-001 : SELECT FOR UPDATE sur flux paiement
- CRIT-002 : bcrypt dans transaction inscription
- CRIT-003 : HMAC-SHA256 webhooks (déjà conforme)
- CRIT-004 : JWT_SECRET synchronisé, fallback supprimé
- CRIT-005 : BullMQ batch remplace boucles SMS/SQL
- CRIT-006 : validated_at NOW() SQL (déjà conforme)

## BUGS CORRIGÉS (Sprint 2) — 28 MAI 2026
- TC-014 : QR Code patient dans dashboard médecin
- TC-015 : Flux abonnement dashboard patient connecté
- TC-022 : Icône afficher/cacher mot de passe
- TC-024 : Module créneaux médecin
- TC-033 : RBAC pharmacie — suppression accès dossier médical
- TC-039 : Réhabilitation médecin dans admin
- TC-044 : Gestion multi-admin avec rôles par équipe

## LOCALSTORAGE KEYS AJOUTÉES — 28 MAI 2026
- bolamu_secretaire_token / bolamu_secretaire_phone
- bolamu_rh_token / bolamu_rh_phone

## SKILLS WINDSURF AJOUTÉS — 28 MAI 2026
- .windsurf/rules/bolamu-smartflow.md
- .windsurf/rules/bolamu-cron.md (BullMQ, batch SQL)
