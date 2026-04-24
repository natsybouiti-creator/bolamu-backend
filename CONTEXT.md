BOLAMU — CONTEXTE PROJET
VISION PRODUIT
Plateforme de santé numérique au Congo-Brazzaville. Connecte patients, médecins, pharmacies et laboratoires. Developed by NBA Gestion SARLU.
ARCHITECTURE TECHNIQUE

Backend : Node.js + Express sur Render (bolamu-backend.onrender.com)
Base de données : PostgreSQL Neon
Stockage fichiers : Cloudinary (cloud_name: dpxefz80w)
SMS : Africa's Talking
Auth : JWT

TABLES PRINCIPALES ET RÈGLES CRITIQUES

users (id, phone, role, full_name, is_active, validated_at, document_url, trust_score, member_code, banned, created_at)
  - Table centrale pour tous les utilisateurs
  - validated_at : horodatage de validation admin (TIMESTAMPTZ)
  - is_active : état d'activation (boolean)
  - document_url : URL Cloudinary du document justificatif
  - trust_score : score de confiance (0-100)
  - member_code : code membre unique par rôle

doctors (id, phone, user_id, full_name, specialty, registration_number, city, neighborhood, status, is_active, member_code, document_url, trust_score, momo_number, created_at)
  - is_active : vient TOUJOURS de cette table, jamais de users
  - status : enum('pending', 'verified', 'suspended')
  - JOIN users obligatoire pour récupérer validated_at

pharmacies (id, phone, user_id, name, responsible_name, rccm_number, city, neighborhood, status, is_active, member_code, document_url, trust_score, momo_number, created_at)
  - is_active : vient TOUJOURS de cette table, jamais de users
  - status : enum('pending', 'verified', 'suspended')
  - JOIN users obligatoire pour récupérer validated_at

laboratories (id, phone, user_id, name, director_name, agrement_number, rccm_number, city, neighborhood, status, is_active, member_code, document_url, trust_score, momo_number, created_at)
  - is_active : vient TOUJOURS de cette table, jamais de users
  - status : enum('pending', 'verified', 'suspended')
  - JOIN users obligatoire pour récupérer validated_at

appointments (id, patient_phone, doctor_phone, appointment_date, status, created_at)
  - status : enum('en_attente', 'confirme', 'termine', 'annule')

prescriptions (id, patient_phone, doctor_phone, status, created_at)

audit_log (id, event_type, actor_phone, target_table, target_id, payload, created_at)
  - journal des actions sensibles (validation, login, etc.)

FLUX VALIDÉS EN PRODUCTION

Inscription patient (OTP → création compte users)
Inscription médecin (OTP → INSERT users + doctors dans transaction → validation admin)
Inscription pharmacie (OTP → INSERT users + pharmacies dans transaction → validation admin)
Inscription laboratoire (OTP → INSERT users + laboratories dans transaction → validation admin)
Validation admin (PATCH /api/v1/admin/validate-user → is_active=true + validated_at=NOW() dans users + table spécifique)
Consultation médecin (création appointment → dashboard patient)
Prescription médicale (création prescription → pharmacie/labo)
Labo résultats (QR code scan → dépose résultats)
Pharmacie délivrance (QR code scan → applique remise tiers payant)
Timeline patient (historique RDV, prescriptions, résultats)
QR code authentification (scan pour vérifier validité)
Téléconsultation JaaS 8x8.vc — médecin et patient dans la même salle
RDV patient visibles dans dashboard via GET /appointments/patient/:phone
Sentry monitoring — toutes les erreurs backend capturées en temps réel

RÈGLES ARCHITECTURALES ABSOLUES

is_active des partenaires vient TOUJOURS de la table spécifique (doctors/pharmacies/laboratories) — jamais de users
validated_at se récupère TOUJOURS via LEFT JOIN users dans getProfile
Toute inscription partenaire insère dans users ET table spécifique dans la même transaction
is_active = false par défaut à l'inscription — validation admin obligatoire
document_url synchronisé dans users ET table spécifique à l'inscription
Cloudinary centralisé via src/utils/cloudinary.js — jamais de config locale
localStorage keys : bolamu_doctor_token/phone, bolamu_pharmacie_token/phone, bolamu_laboratoire_token/phone
Toute normalisation de numéro passe par normalizePhone() — jamais de regex inline
Les numéros congolais sont au format +2420XXXXXXXX (12 chiffres avec le 0)
instrument.js doit être dans src/ et chargé en première ligne de src/server.js

COMPTES DE TEST

Patient : +24269735418
Médecin : +24260000001 (Dr. Mbemba Jean)
Pharmacie : +24266226116
Laboratoire : +24268582563
Admin : +242600000099

BUGS CORRIGÉS — NE JAMAIS REPRODUIRE

Double insertion users : registerDoctor/Pharmacie/Laboratoire inséraient dans users puis appelaient controllers spécifiques qui inséraient aussi dans users. Solution : suppression INSERT users dans auth.controller.js, laissé uniquement dans controllers spécifiques.
is_active basé sur trust_score : registerDoctor/Pharmacie/Laboratoire calculaient is_active = score >= 80, permettant activation automatique. Solution : is_active = false forcé pour tous les partenaires.
Incohérence localStorage : register.html sauvegardait bolamu_token/bolamu_phone génériques, mais dashboards lisaient bolamu_doctor_token/phone spécifiques. Solution : register.html utilise maintenant les clés spécifiques par rôle.
Missing validated_at column : getProfile ne récupérait pas validated_at depuis users. Solution : LEFT JOIN users ajouté dans toutes les requêtes getProfile.
normalizePhone non utilisée dans requestOtp et login — remplacée par appel centralisé.
Double format numéros congolais — migration complète vers +2420XXXXXXXX.
Route GET /appointments/patient/:phone manquante — créée.
Jitsi meet.jit.si bloqué par modérateur — migré vers JaaS 8x8.vc.
instrument.js Sentry à la racine au lieu de src/ — déplacé dans src/.

ÉTAT ACTUEL — SESSION 24 AVRIL 2026

✅ Sentry monitoring opérationnel
✅ Téléconsultation JaaS fonctionnelle
✅ SMS Africa's Talking configuré — activation Live en attente crédit
✅ Normalisation numéros centralisée via normalizePhone()
✅ RDV patient visibles dans dashboard

Reste à faire :
- Activation SMS Live (crédit Africa's Talking)
- Tests complets MoMo
