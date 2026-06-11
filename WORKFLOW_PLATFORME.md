# BOLAMU — WORKFLOW COMPLET DE LA PLATEFORME
*Document généré automatiquement le 20 mai 2026*

---

## 1. WORKFLOW D'INSCRIPTION

### 1.1 Patient
```
1. Formulaire inscription (index.html)
   - Téléphone (+2420XXXXXXXX)
   - Nom, prénom, genre, âge
   - Ville, quartier
   - Carte d'identité (upload Cloudinary)
   - NIU (optionnel)

2. Vérification OTP
   - OTP envoyé via Africa's Talking
   - Validation du numéro

3. Création compte
   - INSERT users (is_active = true)
   - Mot de passe généré automatiquement
   - SMS avec mot de passe
   - Member code BLM-XXXXX

4. Accès dashboard patient
```

### 1.2 Partenaire (Médecin / Pharmacie / Laboratoire)
```
1. Formulaire inscription spécifique
   - Téléphone (+2420XXXXXXXX)
   - Informations professionnelles
   - Documents (upload Cloudinary)

2. Vérification OTP
   - OTP envoyé via Africa's Talking
   - Validation du numéro

3. Création compte (transaction)
   - INSERT users (is_active = false)
   - INSERT table spécifique (doctors/pharmacies/laboratories)
   - is_active = false (validation admin requise)
   - Mot de passe généré automatiquement
   - SMS avec mot de passe
   - Member code MED/PHM/LAB-XXXXX

4. En attente validation admin
```

---

## 2. WORKFLOW D'AUTHENTIFICATION

### 2.1 Connexion
```
1. Formulaire login (téléphone + mot de passe)
   - POST /api/v1/auth/login
   - Validation bcrypt
   - Génération JWT

2. Stockage localStorage
   - bolamu_{role}_token
   - bolamu_{role}_phone

3. Redirection dashboard
   - Patient → patient-dashboard.html
   - Médecin → doctor-dashboard.html
   - Pharmacie → pharmacy-dashboard.html
   - Laboratoire → lab-dashboard.html
   - Admin → dashboard.html
   - Content Admin → content.html
```

### 2.2 Mot de passe oublié
```
1. Formulaire (téléphone)
   - POST /api/v1/auth/forgot-password

2. Génération nouveau mot de passe
   - SMS avec nouveau mot de passe

3. Connexion avec nouveau mot de passe
```

### 2.3 Changement mot de passe
```
1. Depuis profil dashboard
   - POST /api/v1/{role}/change-password
   - Ancien mot de passe + nouveau mot de passe

2. Mise à jour password_hash
```

---

## 3. WORKFLOW VALIDATION ADMIN

### 3.1 Validation partenaire
```
1. Dashboard admin
   - Liste comptes en attente (status = pending)

2. Modal profil partenaire
   - Visualisation documents
   - Vérification informations

3. Validation
   - POST /api/v1/admin/validate-user
   - is_active = true dans table spécifique
   - validated_at dans users
   - Audit log

4. Notification partenaire
   - SMS confirmation
```

---

## 4. WORKFLOW CONSULTATION MÉDECIN

### 4.1 Prise de rendez-vous
```
1. Patient dashboard
   - Sélection médecin (carte Leaflet)
   - Choix date/heure

2. Création rendez-vous
   - POST /api/v1/appointments
   - INSERT appointments
   - Status = pending

3. Confirmation patient
```

### 4.2 Téléconsultation
```
1. Médecin dashboard
   - Liste rendez-vous
   - Démarrage consultation

2. Génération session JaaS
   - Création room 8x8.vc
   - Lien patient + médecin

3. Consultation
   - Vidéo/audio
   - Chat intégré

4. Fin consultation
   - Rapport consultation
   - INSERT consultation_reports
   - Status appointment = completed
```

### 4.3 Prescription médicale
```
1. Médecin dashboard
   - Création prescription
   - POST /api/v1/prescriptions

2. Envoi pharmacie/labo
   - Notification pharmacie
   - Notification laboratoire

3. Suivi patient
   - Timeline patient
```

---

## 5. WORKFLOW PHARMACIE

### 5.1 Réception prescription
```
1. Dashboard pharmacie
   - Liste prescriptions en attente

2. Validation prescription
   - Vérification authentique

3. Préparation médicaments
```

### 5.2 Tiers payant
```
1. Scan QR code patient
   - Vérification adhérent actif

2. Calcul remise
   - Montant total × discount_rate (15%)
   - Montant patient = total - remise

3. Transaction tiers payant
   - POST /api/v1/tiers-payant
   - INSERT transactions_tiers_payant
   - Montant remise, montant patient

4. Délivrance médicaments
   - Confirmation patient
```

---

## 6. WORKFLOW LABORATOIRE

### 6.1 Réception prescription
```
1. Dashboard laboratoire
   - Liste prescriptions labo

2. Validation prescription
   - Vérification authentique
```

### 6.2 Dépôt résultats
```
1. Scan QR code patient
   - Vérification adhérent actif

2. Upload résultats
   - Cloudinary
   - INSERT lab_results

3. Notification patient
   - SMS disponibilité résultats

4. Accès patient
   - Timeline patient
   - Téléchargement résultats
```

### 6.3 Tiers payant
```
1. Scan QR code patient
   - Vérification adhérent actif

2. Calcul remise
   - Montant total × discount_rate (10%)
   - Montant patient = total - remise

3. Transaction tiers payant
   - POST /api/v1/tiers-payant
   - INSERT transactions_tiers_payant

4. Délivrance résultats
```

---

## 7. WORKFLOW ABONNEMENTS PATIENT

### 7.1 Plans d'abonnement
```
- Essentiel : 1 personne — 2 000 FCFA/mois — 24 000 FCFA/an
- Standard : 2 personnes — 4 000 FCFA/mois — 48 000 FCFA/an
- Premium : 5 personnes — 10 000 FCFA/mois — 120 000 FCFA/an
```

### 7.2 Paiement MTN MoMo
```
1. Patient dashboard
   - Sélection plan
   - Formulaire paiement

2. Initiation paiement
   - POST /api/v1/payments/momo/initiate
   - Callback MTN MoMo

3. Validation paiement
   - handlePaymentSuccess
   - INSERT subscriptions
   - INSERT payments
   - Audit log
   - Validation montant vs platform_config

4. Activation abonnement
   - Status = active
   - Expiration (1 mois ou 1 an)
```

### 7.3 Système collecte 4 canaux
```
Canal 1 - OVP Bancaire
- POST /api/v1/collecte/ovp/initier
- Génération PDF OVP
- Validation admin
- Virement Ecobank

Canal 2 - MoMo Annuel
- POST /api/v1/collecte/momo/initier
- Paiement annuel (24000/48000/120000 FCFA)
- Callback MTN/Airtel

Canal 3 - Tiers Payant Familial
- POST /api/v1/collecte/familial/ajouter
- Bénéficiaires illimités
- Payeur bancaire

Canal 4 - SEPA Diaspora
- POST /api/v1/collecte/sepa/initier
- Prélèvement SEPA
- Compte France NBA Gestion
```

### 7.4 Job cron abonnements
```
Exécution : 02h00 Brazzaville

1. Expiration abonnements MoMo annuel
   - Status = expired

2. Rappels SMS J-30
   - Patients concernés

3. Suspension cascade bénéficiaires
   - Tiers payant familial
```

---

## 8. WORKFLOW CLEARING MENSUEL PARTENAIRES

### 8.1 Calcul forfaits
```
1. Comptage adhérents par zone
   - partner_zones (clinique/pharmacie/laboratoire)
   - Zone géographique

2. Calcul forfait partenaire
   - Adhérents × price_essentiel × partner_rate
   - Taux depuis platform_config :
     * clinique : 30%
     * pharmacie : 12.5%
     * laboratoire : 7.5%
     * Bolamu : 50%
```

### 8.2 Versements partenaires
```
1. Génération partner_payouts
   - INSERT partner_payouts
   - Montant calculé

2. Détection opérateur
   - MTN MoMo ou Airtel Money
   - Depuis momo_number partenaire

3. Versement automatique
   - MTN MoMo Disbursement API
   - Airtel Money API

4. Réconciliation
   - Status = paid
   - Audit log
```

---

## 9. WORKFLOW ADMIN

### 9.1 Dashboard admin
```
1. Vue d'ensemble
   - Statistiques globales
   - Comptes en attente
   - Dernières activités

2. Validation partenaires
   - Liste pending
   - Modal profil + documents

3. Gestion contenu
   - Articles blog santé
   - Pages CGU/Confidentialité

4. Suivi financier
   - Paiements
   - Abonnements
   - Clearing partenaires

5. Audit
   - audit_log
   - fraud_signals
```

### 9.2 Content admin
```
1. Gestion articles
   - Création/édition/suppression
   - Publication

2. Blog santé
   - Accès patient dashboard
```

---

## 10. WORKFLOW SÉCURITÉ

### 10.1 Rate limiting
```
- OTP : 5 tentatives / 15 minutes
- Login : 20 tentatives / heure
```

### 10.2 Audit logging
```
- Toutes les actions critiques
- INSERT audit_log (insert-only)
- event_type, actor_phone, target_table, target_id, payload
```

### 10.3 Fraud detection
```
- fraud_signals
- fraud_score 0-100
- Alertes automatiques
```

---

## 11. WORKFLOW NOTIFICATIONS

### 11.1 SMS (Africa's Talking)
```
- OTP inscription
- Mot de passe généré
- Validation compte
- Rendez-vous
- Résultats labo
- Rappels abonnements
```

### 11.2 Notifications système (roadmap)
```
- Push notifications
- Email notifications
```

---

## 12. WORKFLOW DOSSIER MÉDICAL

### 12.1 Constantes médicales
```
1. Patient dashboard
   - Modal édition constantes
   - Groupe sanguin, allergies, maladies chroniques
   - Antécédents, traitements
   - Poids, taille
   - Contact urgence

2. Mise à jour
   - PATCH /api/v1/patients/medical-constants
   - UPDATE users

3. Consultation médecin
   - Accès constantes
   - Mise à jour si nécessaire
```

### 12.2 Rapports consultation
```
1. Médecin dashboard
   - Création rapport post-consultation
   - INSERT consultation_reports

2. Accès patient
   - Timeline patient
   - Téléchargement PDF

3. Traçabilité
   - INSERT dossier_access_log
```

---

## 13. WORKFLOW GÉOLOCALISATION

### 13.1 Partenaires
```
1. Dashboard partenaire
   - GPS automatique (latitude, longitude)
   - Address manuelle

2. Stockage
   - UPDATE table spécifique
   - latitude, longitude, address
```

### 13.2 Carte patient
```
1. Patient dashboard
   - Carte Leaflet
   - Marqueurs partenaires par zone
   - Filtrage type partenaire
```

---

## 14. WORKFLOW QR CODE

### 14.1 Génération
```
1. Patient inscription
   - QR code unique
   - INSERT qr_tokens

2. Rotation automatique
   - Nouveau token chaque consultation
```

### 14.2 Utilisation
```
1. Pharmacie/Labo
   - Scan QR code
   - Vérification adhérent
   - Tiers payant

2. Authentification
   - Validation token
   - Vérification abonnement actif
```

---

## 15. WORKFLOW RATING

### 15.1 Notation patient
```
1. Après consultation
   - Étoiles 1-5
   - Adjectif qualificatif
   - Commentaire optionnel

2. Stockage
   - INSERT ratings

3. Calcul moyenne
   - Par médecin
   - Affichage dashboard patient
```

### 15.2 Admin
```
1. Panel admin
   - Liste ratings
   - Modération commentaires
```

---

## 16. WORKFLOW CREDITS BOLAMU

### 16.1 Crédits
```
1. Système crédits
   - INSERT credits
   - Solde patient

2. Transactions
   - INSERT credit_transactions
   - Crédit/débit
```

### 16.2 Partenaires
```
1. Crédits partenaires
   - INSERT credit_partners
   - Solde partenaire
```

---

## RÉSUMÉ DES ROUTES API PRINCIPALES

### Auth
- POST /api/v1/auth/request-otp
- POST /api/v1/auth/verify-otp
- POST /api/v1/auth/login
- POST /api/v1/auth/forgot-password

### Patients
- POST /api/v1/patients/register
- GET /api/v1/patients/profile/:phone
- PATCH /api/v1/patients/profile
- POST /api/v1/patients/change-password
- PATCH /api/v1/patients/medical-constants

### Médecins
- POST /api/v1/doctors/register
- GET /api/v1/doctors/profile/:phone
- PATCH /api/v1/doctors/profile
- POST /api/v1/doctors/change-password
- PATCH /api/v1/doctors/location

### Pharmacies
- POST /api/v1/pharmacies/register
- GET /api/v1/pharmacies/profile/:phone
- PATCH /api/v1/pharmacies/profile
- POST /api/v1/pharmacies/change-password
- PATCH /api/v1/pharmacies/location

### Laboratoires
- POST /api/v1/laboratories/register
- GET /api/v1/laboratories/profile/:phone
- PATCH /api/v1/laboratories/profile
- POST /api/v1/laboratories/change-password
- PATCH /api/v1/laboratories/location

### Appointments
- POST /api/v1/appointments
- GET /api/v1/appointments/patient/:phone
- GET /api/v1/appointments/doctor/:phone
- PATCH /api/v1/appointments/:id

### Prescriptions
- POST /api/v1/prescriptions
- GET /api/v1/prescriptions/patient/:phone

### Paiements
- POST /api/v1/payments/momo/initiate
- POST /api/v1/payments/callback

### Abonnements
- GET /api/v1/subscriptions/:phone
- POST /api/v1/subscriptions/upgrade

### Tiers payant
- POST /api/v1/tiers-payant
- GET /api/v1/tiers-payant/:phone

### Admin
- GET /api/v1/admin/dashboard
- POST /api/v1/admin/validate-user
- GET /api/v1/admin/conventions
- POST /api/v1/admin/conventions
- PATCH /api/v1/admin/conventions/:id

### Collecte
- POST /api/v1/collecte/ovp/initier
- GET /api/v1/collecte/ovp/statut
- POST /api/v1/collecte/momo/initier
- POST /api/v1/collecte/familial/ajouter
- DELETE /api/v1/collecte/familial/retirer/:phone
- GET /api/v1/collecte/familial/mes-beneficiaires
- POST /api/v1/collecte/sepa/initier
- GET /api/v1/collecte/admin/dashboard
- PATCH /api/v1/collecte/admin/ovp/valider/:phone
- PATCH /api/v1/collecte/admin/sepa/valider/:phone
- GET /api/v1/collecte/admin/ovp/fichier-mensuel

---

## INFRASTRUCTURE TECHNIQUE

### Backend
- Node.js + Express
- PostgreSQL Neon (Frankfurt)
- Cloudinary (dpxefz80w)
- Africa's Talking (sandbox)
- JWT auth
- Sentry monitoring
- JaaS 8x8.vc (téléconsultation)

### Frontend
- HTML/CSS/JS vanilla
- Design system : navy #0A2463 + turquoise #00C9A7
- Fonts : Plus Jakarta Sans + Fraunces
- Leaflet (cartes)
- LocalStorage (tokens)

### Déploiement
- Render (api.bolamu.co)
- Free plan (dort après inactivité)
- Ping /api/v1/test avant démo
- Repo GitHub : natsybouiti-creator/bolamu-backend

---

## COMPTES DE TEST

- Patient : +242069735418
- Médecin : +242060000001 (Dr. Mbemba Jean)
- Pharmacie : +242066226116
- Laboratoire : +242068582563
- Admin : +242060000099

---

*Fin du document*
