# BOLAMU — CONTEXTE PROJET
Mis à jour : 25 avril 2026

## VISION PRODUIT
Plateforme de santé numérique au Congo-Brazzaville. Connecte patients, médecins, pharmacies et laboratoires. Developed by NBA Gestion SARLU.

## ARCHITECTURE TECHNIQUE
- Backend : Node.js + Express sur Render (bolamu-backend.onrender.com) — free plan, dort après inactivité, ping /api/v1/test avant démo
- Base de données : PostgreSQL Neon (Frankfurt)
- Stockage fichiers : Cloudinary (cloud_name: dpxefz80w)
- SMS : Africa's Talking (sandbox — OTPs visibles dans logs Render, activation Live en attente crédit)
- Auth : JWT
- Monitoring : Sentry
- Téléconsultation : JaaS 8x8.vc
- Frontend : HTML/CSS/JS vanilla
- Repo GitHub : natsybouiti-creator/bolamu-backend

## DESIGN SYSTEM
- Fonts : Plus Jakarta Sans + Fraunces
- Couleurs : navy #0A2463 + turquoise #00C9A7

## TABLES PRINCIPALES ET RÈGLES CRITIQUES

### users
Colonnes : id, phone, role, full_name, first_name, last_name, gender, age, city, neighborhood, is_active, validated_at, document_url, trust_score, member_code, banned, password_hash, id_card_url, id_card_public_id, niu, created_at

- Table centrale pour TOUS les utilisateurs sans exception
- Identifiant universel : phone (jamais l'id numérique)
- Roles : 'patient', 'doctor', 'pharmacie', 'laboratoire', 'admin', 'content_admin'
- is_active : boolean (jamais un champ status string dans users)
- password_hash : mot de passe bcrypt — tous les comptes en ont un depuis migration 25 avril 2026
- id_card_url : carte d'identité patient (Cloudinary)
- niu : Numéro d'Identification Unique (optionnel, patients)
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
Colonnes : id, patient_phone, doctor_phone, appointment_date, status, created_at
- status : enum('en_attente', 'confirme', 'termine', 'annule')

### prescriptions
Colonnes : id, patient_phone, doctor_phone, status, created_at

### audit_log
Colonnes : id, event_type, actor_phone, target_table, target_id, payload, created_at
- Insert-only — jamais de UPDATE ou DELETE

### Autres tables existantes
payments, subscriptions, credits, fraud_signals, platform_config, articles, qr_tokens

### Tables manquantes (roadmap)
health_records, ratings, cgu_pages, notifications

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

## COMPTES DE TEST
- Patient : +242069735418
- Médecin : +242060000001 (Dr. Mbemba Jean)
- Pharmacie : +242066226116
- Laboratoire : +242068582563
- Admin : +242060000099

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
- Timeline patient + Rapports de consultation médecin
- Credits Bolamu + Articles / blog santé + Admin content editor
- Prescriptions flux complet + Flux labo→patient complet
- Système de notation patients — ratings, étoiles + adjectifs + panel admin
- MTN MoMo — backend + frontend, valeurs réelles XAF (sandbox)
- Géolocalisation — GPS dans dashboards intervenants + carte Leaflet patient
- index.html — inscription patient complète avec NIU + CNI Cloudinary
- localStorage keys standardisées par rôle

### Partiel ⚠️
- Africa's Talking (sandbox — activation Live en attente crédit)
- Partner conventions (table existe, flux non validé)
- Transactions tiers payant (table existe, flux non validé)

### Absent ❌
- Notifications push
- Domaine custom — bolamu.co disponible, achat en attente
- Airtel Money — en attente credentials API

## TABLES EXISTANTES — LISTE COMPLÈTE
users, doctors, pharmacies, laboratories, appointments, prescriptions, payments, subscriptions, credits, credit_transactions, credit_partners, fraud_signals, audit_log, platform_config, articles, content_blocks, qr_tokens, lab_prescriptions, lab_results, consultation_reports, dossier_access_log, partner_conventions, transactions_tiers_payant, otp_codes, ratings

## COLONNES GPS AJOUTÉES — 25 AVRIL 2026
Tables users, doctors, pharmacies, laboratories — latitude DECIMAL(10,7), longitude DECIMAL(10,7), address TEXT

## ROADMAP — ÉTAT RÉEL
- Ph1 : Quick fixes ✅ TERMINÉ
- Ph2 : CGU + confidentialité ✅ TERMINÉ
- Ph3 : Dossier médical ✅ TERMINÉ
- Ph4 : Prescriptions + flux labo ✅ TERMINÉ
- Ph5 : Ratings + commentaires ✅ TERMINÉ
- Ph6 : MTN MoMo frontend ✅ TERMINÉ
- Ph7 : Géolocalisation + carte patient ✅ TERMINÉ
- Ph8 : Production — domaine custom, Africa's Talking Live, Airtel Money (en attente)
