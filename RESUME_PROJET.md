# BOLAMU — RÉSUMÉ COMPLET DU PROJET
Mis à jour : 25 avril 2026

---

## 1. VISION PRODUIT

**Bolamu** est une plateforme de santé numérique au Congo-Brazzaville développée par NBA Gestion SARLU. Elle connecte :
- **Patients** : Accès aux soins, consultations, ordonnances, laboratoires
- **Médecins** : Gestion des RDV, téléconsultations, prescriptions
- **Pharmacies** : Vérification QR tiers payant, remises conventionnées
- **Laboratoires** : Dépôt de résultats, prescriptions médicales
- **Admins** : Validation des comptes, surveillance, gestion éditoriale

---

## 2. ARCHITECTURE TECHNIQUE

### Backend
- **Framework** : Node.js + Express
- **Hébergement** : Render (bolamu-backend.onrender.com) — Free plan
- **Base de données** : PostgreSQL Neon (Frankfurt)
- **Stockage fichiers** : Cloudinary (cloud_name: dpxefz80w)
- **SMS** : Africa's Talking (sandbox — OTPs visibles dans logs Render)
- **Auth** : JWT (tokens stockés en localStorage)
- **Monitoring** : Sentry (instrument.js dans src/)
- **Téléconsultation** : JaaS 8x8.vc
- **Repo GitHub** : natsybouiti-creator/bolamu-backend

### Frontend
- **Technologie** : HTML/CSS/JS vanilla
- **Design System** :
  - Fonts : Plus Jakarta Sans + Fraunces
  - Couleurs : navy #0A2463 + turquoise #00C9A7
  - Style : Moderne, responsive, mobile-first

---

## 3. BASE DE DONNÉES

### Tables principales

#### users (Table centrale)
**Colonnes** : id, phone, role, full_name, first_name, last_name, gender, age, city, neighborhood, is_active, validated_at, document_url, trust_score, member_code, banned, password_hash, id_card_url, id_card_public_id, niu, created_at

**Règles** :
- Identifiant universel : phone (jamais l'id numérique)
- Roles : 'patient', 'doctor', 'pharmacie', 'laboratoire', 'admin', 'content_admin'
- is_active : boolean (jamais un champ status string)
- password_hash : mot de passe bcrypt (tous les comptes)
- id_card_url : carte d'identité patient (Cloudinary)
- niu : Numéro d'Identification Unique (optionnel, patients)
- Soft delete uniquement — jamais de DELETE

#### doctors
**Colonnes** : id, phone, user_id, full_name, specialty, registration_number, city, neighborhood, status, is_active, member_code, document_url, trust_score, momo_number, created_at

**Règles** :
- is_active vient TOUJOURS de cette table, jamais de users
- status : enum('pending', 'verified', 'suspended')
- JOIN users obligatoire pour récupérer validated_at

#### pharmacies
**Colonnes** : id, phone, user_id, name, responsible_name, rccm_number, city, neighborhood, status, is_active, member_code, document_url, trust_score, momo_number, created_at

**Règles** :
- is_active vient TOUJOURS de cette table, jamais de users
- status : enum('pending', 'verified', 'suspended')

#### laboratories
**Colonnes** : id, phone, user_id, name, director_name, agrement_number, rccm_number, city, neighborhood, status, is_active, member_code, document_url, trust_score, momo_number, created_at

**Règles** :
- is_active vient TOUJOURS de cette table, jamais de users
- status : enum('pending', 'verified', 'suspended')

#### appointments
**Colonnes** : id, patient_phone, doctor_phone, appointment_date, status, created_at
**status** : enum('en_attente', 'confirme', 'termine', 'annule')

#### prescriptions
**Colonnes** : id, patient_phone, doctor_phone, status, created_at

#### audit_log
**Colonnes** : id, event_type, actor_phone, target_table, target_id, payload, created_at
**Règle** : Insert-only — jamais de UPDATE ou DELETE

### Tables secondaires existantes
- **payments** : Paiements MTN MoMo
- **subscriptions** : Abonnements patients (plans)
- **credits** : Crédits Bolamu
- **fraud_signals** : Détection de fraude
- **platform_config** : Configuration plateforme
- **articles** : Blog/articles santé
- **qr_tokens** : Tokens QR rotatifs
- **content_blocks** : Blocs de contenu éditorial
- **commands** : Commandes (migration_002)
- **lab_prescriptions** : Prescriptions labo
- **lab_results** : Résultats labo
- **consultation_reports** : Rapports de consultation
- **dossier_access_log** : Logs d'accès dossier
- **credit_transactions** : Transactions de crédits
- **partner_conventions** : Conventions partenaires
- **transactions_tiers_payant** : Transactions tiers payant

### Tables manquantes (roadmap)
- health_records
- ratings
- cgu_pages
- notifications

---

## 4. AUTHENTIFICATION

### Système actuel (depuis 25 avril 2026)
- **Connexion** : téléphone + mot de passe permanent (bcrypt)
- **Inscription** : OTP envoyé pour vérification → mot de passe généré automatiquement → SMS
- **Mot de passe oublié** : nouveau mot de passe généré et envoyé par SMS
- **Changement de mot de passe** : disponible depuis le profil pour tous les rôles

### Routes d'auth
- POST /api/v1/auth/request-otp : Demande OTP
- POST /api/v1/auth/verify-otp : Vérification OTP
- POST /api/v1/auth/login : Connexion (téléphone + mot de passe)
- POST /api/v1/auth/forgot-password : Mot de passe oublié
- POST /api/v1/patients/change-password : Patient
- POST /api/v1/doctors/change-password : Médecin
- POST /api/v1/pharmacies/change-password : Pharmacie
- POST /api/v1/laboratories/change-password : Laboratoire

### Admin
- Auth séparée — rôles 'admin' et 'content_admin' acceptés
- Redirection vers dashboard.html ou content.html selon le rôle

---

## 5. MEMBER CODES

Format des codes membres :
- Patients : BLM-XXXXX
- Médecins : MED-XXXXX
- Pharmacies : PHM-XXXXX
- Laboratoires : LAB-XXXXX

**Génération** : MAX(numéro existant) + 1 — jamais COUNT (risque de doublons)

---

## 6. DASHBOARDS — PANELS PAR RÔLE

### Admin (dashboard.html)
1. **panel-overview** : Vue d'ensemble (KPIs, graphiques)
2. **panel-activity** : Journal d'activité
3. **panel-pending** : Comptes en attente de validation
4. **panel-doctors** : Liste des médecins
5. **panel-pharmacies** : Liste des pharmacies
6. **panel-laboratories** : Liste des laboratoires
7. **panel-patients** : Liste des patients
8. **panel-appointments** : Liste des RDV
9. **panel-prescriptions** : Liste des ordonnances
10. **panel-payments** : Liste des paiements
11. **panel-fraud** : Signaux de fraude
12. **panel-audit** : Logs d'audit
13. **panel-config** : Configuration plateforme
14. **panel-credits** : Gestion des crédits

### Admin (content.html)
1. **panel-articles** : Gestion articles blog
2. **panel-vitrine** : Contenu vitrine
3. **panel-plans** : Plans d'abonnement
4. **panel-textes** : Textes statiques
5. **panel-reseaux** : Réseaux sociaux

### Patient (dashboard.html)
1. **panel-accueil** : Accueil (QR code, statistiques, RDV)
2. **panel-medecins** : Liste des médecins disponibles
3. **panel-dossier** : Dossier médical
4. **panel-carte** : Carte des partenaires
5. **panel-credits** : Crédits Bolamu
6. **panel-profil** : Profil patient

### Médecin (dashboard.html)
1. **panel-accueil** : Accueil (statistiques, RDV)
2. **panel-rdv** : Gestion des RDV
3. **panel-patients** : Liste des patients
4. **panel-telemedicine** : Téléconsultation
5. **panel-profil** : Profil médecin

### Pharmacie (dashboard.html)
1. **panel-accueil** : Accueil (statistiques)
2. **panel-scanner** : Scanner QR tiers payant
3. **panel-qr** : Génération QR
4. **panel-historique** : Historique des scans
5. **panel-abonnement** : Abonnement
6. **panel-profil** : Profil pharmacie

### Laboratoire (dashboard.html)
1. **panel-accueil** : Accueil (statistiques)
2. **panel-historique** : Historique des analyses
3. **panel-qr** : Scanner QR
4. **panel-profil** : Profil laboratoire

---

## 7. ROUTES API PRINCIPALES

### Auth (/api/v1/auth)
- POST /request-otp
- POST /verify-otp
- POST /login
- POST /forgot-password

### Patients (/api/v1/patients)
- POST /register
- GET /profil
- POST /change-password
- GET /appointments/:phone

### Médecins (/api/v1/doctors)
- POST /register
- GET /profil
- POST /change-password
- GET /list (filtres spécialité, ville)

### Pharmacies (/api/v1/pharmacies)
- POST /register
- GET /profil
- POST /change-password
- GET /list

### Laboratoires (/api/v1/laboratories)
- POST /register
- GET /profil
- POST /change-password
- GET /list

### Appointments (/api/v1/appointments)
- POST /create
- GET /doctor/:phone
- GET /patient/:phone
- PATCH /:id/status

### Prescriptions (/api/v1/prescriptions)
- POST /create
- GET /patient/:phone
- GET /doctor/:phone

### Lab (/api/v1/lab)
- POST /prescriptions
- GET /prescriptions
- POST /results
- GET /results/:id

### QR (/api/v1/qr)
- POST /verify
- GET /token

### Admin (/api/v1/admin)
- GET /stats
- GET /pending
- PATCH /validate
- GET /users/:phone
- POST /credits/add
- GET /config
- PATCH /config

### Articles (/api/v1/articles)
- GET / (public)
- POST / (admin)
- PATCH /:id (admin)
- DELETE /:id (admin)

### Payments (/api/v1/payments)
- POST /momo/callback
- GET /:reference

---

## 8. RÈGLES ARCHITECTURALES ABSOLUES

1. **Table users unique** — jamais de tables séparées pour l'identité
2. **Identifiant universel : phone** — jamais l'id numérique
3. **is_active des partenaires** vient TOUJOURS de la table spécifique (doctors/pharmacies/laboratories)
4. **validated_at** se récupère TOUJOURS via LEFT JOIN users
5. **is_active = false forcé** à l'inscription pour tous les partenaires
6. **Cloudinary centralisé** via src/utils/cloudinary.js — jamais de config locale
7. **Normalisation téléphone** passe par normalizePhone() — jamais de regex inline
8. **Numéros congolais** : format +2420XXXXXXXX (12 chiffres avec le 0)
9. **Sentry instrument.js** dans src/ — chargé en première ligne de src/server.js
10. **audit_log** : insert-only — colonnes event_type, actor_phone, target_table, target_id, payload
11. **Soft delete uniquement** — jamais de DELETE sur users
12. **member_code** généré avec MAX() + 1 — jamais COUNT()
13. **Toute route /api/v1 protégée** a authMiddleware en premier
14. **Toute route partenaire** a le middleware de rôle (doctorOnly, labOnly, etc.)
15. **Jamais de données sensibles** dans les logs en production
16. **Validation des inputs** sur toutes les routes POST et PUT
17. **Toute INSERT/UPDATE critique** dans une transaction avec ROLLBACK
18. **Vérifier colonnes SELECT** existent dans la table avant d'écrire la requête
19. **JOIN sur phone** utilisent le numéro normalisé
20. **Jamais de SELECT *** en production — toujours lister les colonnes explicitement

---

## 9. LOCALSTORAGE KEYS

- bolamu_patient_token / bolamu_patient_phone
- bolamu_doctor_token / bolamu_doctor_phone
- bolamu_pharmacie_token / bolamu_pharmacie_phone
- bolamu_laboratoire_token / bolamu_laboratoire_phone

---

## 10. FLUX VALIDÉS EN PRODUCTION

✅ Inscription patient (OTP vérification → mot de passe généré → SMS → compte actif)
✅ Inscription partenaire (OTP → INSERT users + table spécifique → validation admin)
✅ Connexion (téléphone + mot de passe → JWT)
✅ Mot de passe oublié (SMS nouveau mot de passe)
✅ Changement mot de passe depuis profil (tous les rôles)
✅ Validation admin (PATCH /api/v1/admin/validate → is_active=true + validated_at)
✅ Dashboard admin : comptes en attente, modal profil avec documents + carte identité patient
✅ Consultation médecin (appointment → dashboard patient)
✅ Prescription médicale (création → pharmacie/labo)
✅ Résultats labo (QR code scan → dépôt résultats)
✅ Pharmacie délivrance (QR code scan → remise tiers payant)
✅ Timeline patient (RDV, prescriptions, résultats)
✅ QR code authentification
✅ Téléconsultation JaaS 8x8.vc
✅ RDV patient : GET /api/v1/appointments/patient/:phone
✅ Sentry monitoring

---

## 11. BUGS CORRIGÉS

- Double insertion users à l'inscription partenaire
- is_active calculé sur trust_score
- Incohérence localStorage keys
- validated_at manquant dans getProfile
- normalizePhone non utilisée dans requestOtp/login
- Double format numéros congolais
- Route GET /appointments/patient/:phone manquante
- Jitsi meet.jit.si bloqué → migré vers JaaS 8x8.vc
- instrument.js Sentry mal placé
- member_code doublon (COUNT au lieu de MAX)
- Dashboard admin panel En attente crashait (catch(err) variable shadowing)
- Badge is_active non mappé sur strings

---

## 12. COMPTES DE TEST

- Patient : +242069735418
- Médecin : +242060000001 (Dr. Mbemba Jean)
- Pharmacie : +242066226116
- Laboratoire : +242068582563
- Admin : +242060000099

---

## 13. ÉTAT ACTUEL — 25 AVRIL 2026

### Fonctionnel ✅
- Auth OTP+JWT + mot de passe permanent pour tous les rôles
- Inscription complète 4 rôles avec upload documents
- Dashboard admin (validation, modal profil, carte identité patient)
- Dashboard patient (RDV, profil, changement mot de passe)
- Dashboard médecin (profil, changement mot de passe)
- Dashboard pharmacie (profil, changement mot de passe)
- Dashboard laboratoire (profil, changement mot de passe)
- Rotating QR code tiers payant
- Appointment flow complet
- Jitsi JaaS téléconsultation
- Cloudinary upload documents
- TrustScore auto-validation à 80+/100
- Sentry monitoring
- Admin dual-role (admin + content_admin)

### Partiel ⚠️
- Prescriptions (non testées en production)
- Flux labo→patient (non validé end-to-end)
- MTN MoMo (route existe, non connectée au frontend)
- Africa's Talking (sandbox — OTPs dans logs Render, activation Live en attente crédit)

### Absent ❌
- Carnet santé virtuel (pas de table, route, ni interface)
- Ratings / notation
- CGU pages
- Email contact
- Notifications

---

## 14. ROADMAP 7 PHASES

- **Ph1** : Quick fixes ✅ TERMINÉ — tarif 2000 FCFA, email contact, fix pending is_active, fix emojis, member_code MAX, auth mot de passe permanent, carte identité patient
- **Ph2** : CGU + privacy pages (1 session)
- **Ph3** : Carnet santé virtuel (2-3 sessions) — tables, routes, 4 interfaces
- **Ph4** : Payment/carnet rule + admin compliance (1 session)
- **Ph5** : Star ratings + commentaires (1 session)
- **Ph6** : Tests + prescriptions + flux labo validation (1 session)
- **Ph7** : Production — Africa's Talking Live, MTN MoMo frontend, domaine custom (1 session)

---

## 15. STRUCTURE DU PROJET

```
bolamu-backend/
├── database/
│   ├── init.sql
│   ├── migration_001_doctors_subscriptions.sql
│   └── migration_002_commands.sql
├── public/
│   ├── admin/
│   │   ├── dashboard.html
│   │   └── content.html
│   ├── patient/
│   │   └── dashboard.html
│   ├── medecin/
│   │   └── dashboard.html
│   ├── pharmacie/
│   │   └── dashboard.html
│   ├── laboratoire/
│   │   └── dashboard.html
│   └── login.html
├── src/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── utils/
│   │   └── cloudinary.js
│   ├── instrument.js (Sentry)
│   └── server.js
├── CONTEXT.md
└── package.json
```

---

## 16. TECHNOLOGIES UTILISÉES

### Backend
- Node.js
- Express
- PostgreSQL (pg)
- JWT (jsonwebtoken)
- bcrypt
- Cloudinary SDK
- Sentry (@sentry/node)
- html5-qrcode (QR scanning)

### Frontend
- HTML5
- CSS3 (custom, no framework)
- JavaScript (vanilla)
- QRCode.js (génération QR)
- html5-qrcode (scan QR)

### DevOps
- Render (hébergement)
- Neon PostgreSQL (base de données)
- Cloudinary (stockage)
- Africa's Talking (SMS)
- JaaS 8x8.vc (téléconsultation)
- Sentry (monitoring)

---

## 17. NOTES IMPORTANTES

- Le backend dort après inactivité (Render free plan) → ping /api/v1/test avant démo
- Les OTPs sont visibles dans les logs Render (mode sandbox Africa's Talking)
- Activation Africa's Talking Live en attente de crédit
- MTN MoMo route existe mais frontend non connecté
- Domaine custom pas encore configuré (utilise .onrender.com)

---

**Fin du résumé — Bolamu Project**
