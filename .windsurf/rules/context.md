# BOLAMU — CONTEXTE PROJET — v1.0.0
Mis à jour : 27 mai 2026
Statut : EN PRODUCTION — https://bolamu-backend.onrender.com

## STACK TECHNIQUE
- Runtime : Node.js/Express — Render Standard (port 10000)
- Base de données : PostgreSQL Neon (Frankfurt)
- Auth : JWT access 15min + refresh 7j — bcrypt passwords
- Stockage : Cloudinary (cloud_name: dpxefz80w)
- SMS : Africa's Talking (sandbox — Live en attente crédit)
- Email : Resend (transactionnel)
- Push : Web Push VAPID (optionnel — désactivé si clés absentes)
- WhatsApp : Meta Business API (optionnel)
- IA : Anthropic Claude — agent Amina (optionnel — simulation si clé absente)
- Monitoring : Winston + BetterStack + Prometheus
- CI/CD : GitHub Actions + Docker multi-stage
- Frontend : HTML/CSS/JS vanilla
- Repo : natsybouiti-creator/bolamu-backend

## DESIGN SYSTEM
- Fonts : Plus Jakarta Sans + Fraunces
- Couleurs : navy #0A2463 + turquoise #00C9A7

## PAIEMENTS — MODÈLE MANUEL
Pas d'API MTN MoMo ni Airtel Money intégrée.
Raison : frais API 3% vs frais manuel 1%.
Flux : patient paie sur numéro marchand → admin valide 
l'abonnement manuellement depuis le dashboard admin.
Variables MTN_* et AIRTEL_* présentes dans .env.example 
mais marquées optionnelles.

## MODÈLE TARIFAIRE — DÉFINITIF
- Bronze/MOTO : 1 personne — 2 000 FCFA/mois
- Silver/NDEKO : 2 personnes — 5 000 FCFA/mois  
- Gold/LIBOTA : 5 personnes — 10 000 FCFA/mois
Règle : toujours depuis platform_config, jamais hardcodé

## RÉMUNÉRATION PARTENAIRES (CDR)
- Cliniques : 30% des abonnements de leur zone
- Pharmacies : 12.5%
- Laboratoires : 7.5%
- Bolamu : 50%
Versement : 25 du mois au 5 du mois suivant
Canal : virement bancaire uniquement

## RÔLES UTILISATEURS (7 rôles)
patient, doctor, pharmacie, laboratoire, 
admin, content_admin, secretaire

## RÈGLES ABSOLUES — NE JAMAIS VIOLER
1. phone = identifiant universel (jamais l'id numérique)
2. Soft delete uniquement — is_active = false (jamais DELETE)
3. audit_log = insert-only, jamais UPDATE ni DELETE
4. BEGIN/COMMIT/ROLLBACK sur toutes les opérations financières
5. Tous les montants depuis platform_config — jamais hardcodés
6. Validation montants côté serveur uniquement
7. Jamais de secrets dans le code — toujours process.env
8. Jamais de stack trace exposée en production
9. notify() après chaque action impactant un patient
10. Amina : disclaimer médical obligatoire, max 300 tokens/réponse
11. RBAC strict sur tous les endpoints
12. member_code généré avec MAX() + 1 — jamais COUNT()
13. is_active partenaires vient TOUJOURS de leur table spécifique
14. normalizePhone() pour tous les numéros — jamais regex inline
15. SMS TOUJOURS via src/services/sms.service.js

## TABLES BASE DE DONNÉES
- users (table unique pour tous les rôles)
- doctors
- patients
- pharmacies
- laboratories
- subscriptions
- appointments
- prescriptions
- lab_prescriptions
- lab_orders
- commands
- payments
- transactions
- doctor_payouts
- bank_transfers
- partner_clearing
- collecte
- coupons
- conflicts
- constantes_medicales
- time_slots
- fraud_signals
- audit_log
- refresh_tokens
- push_subscriptions
- notifications
- secretaires
- file_attente
- agenda_blocs
- pre_rdv_formulaires
- ai_consult_sessions
- renouvellement_demandes

## MIGRATIONS EXÉCUTÉES
1. migration_001_doctors_subscriptions.sql
2. migration_002_commands.sql
3. migration_003_update_pricing.sql
4. migration_004_doctor_payouts.sql
5. migration_005_financial_tracing.sql
6. migration_006_bank_transfers.sql
7. migration_007_partner_clearing.sql
8. migration_008_collecte_4canaux.sql
9. migration_009_fix_enum_and_qr.sql
10. migration_010_cleanup_tiers_payant.sql
11. migration_011_transactions_colonnes.sql
12. migration_012_cleanup_transactions.sql
13. migration_013_fraud_score.sql
14. migration_014_constantes_medicales.sql
15. migration_015_remove_traitement_en_cours.sql
16. migration_016_subscriptions_unique_constraint.sql
17. migration_017_refresh_tokens.sql
18. migration_018_time_slots.sql
19. migration_019_lab_orders_priority.sql
20. migration_020_conflicts.sql
21. migration_021_coupons.sql
22. migration_022_production_optimizations.sql
23. migration_023_notifications.sql
24. migration_024_secretariat.sql
25. migration_025_pre_rdv.sql

## ROUTES API COMPLÈTES
- admin.routes.js — /api/v1/admin (dashboard admin)
- airtel.routes.js — /api/v1/payments/airtel (Airtel Money)
- appointment.routes.js — /api/v1/appointments (créer, annuler, confirmer)
- articles.routes.js — /api/v1/articles (articles santé)
- auth.routes.js — /api/v1/auth (login, register, OTP, refresh token)
- bank-transfer.routes.js — /api/v1/bank-transfer (virements bancaires)
- clearing.routes.js — /api/v1/clearing (clearing partenaires)
- collecte.routes.js — /api/v1/collecte (collecte 4 canaux)
- conflict.routes.js — /api/v1/conflicts (signalements)
- constantes-medicales.routes.js — /api/v1/patients/constantes-medicales, /api/v1/doctors/constantes-medicales
- consultation-report.routes.js — /api/v1/reports (rapports consultation)
- coupon.routes.js — /api/v1/coupons (codes promo)
- credits.routes.js — /api/v1/credits (crédits patients)
- doctor.routes.js — /api/v1/doctors (profil, RDV, prescriptions)
- lab.routes.js — /api/v1/lab (ordres, résultats)
- laboratoire.routes.js — /api/v1/laboratories (profil, ordres)
- map.routes.js — /api/v1/map (carte santé)
- momo.routes.js — /api/v1/payments/momo (MTN MoMo)
- notification.routes.js — /api/v1/notifications (push, WhatsApp, SMS)
- partner-convention.routes.js — /api/v1/admin/conventions (conventions)
- patient.routes.js — /api/v1/patients (profil, RDV, prescriptions)
- payment.routes.js — /api/v1/payments (paiements généraux)
- payouts.routes.js — /api/v1/payouts (retraits médecins)
- pharmacie.routes.js — /api/v1/pharmacies (profil, commandes)
- preRdv.routes.js — /api/v1/pre-rdv (formulaire pré-RDV, briefing), /api/v1/ai (sessions Amina), /api/v1/renouvellement (renouvellement assisté)
- prescription.routes.js — /api/v1/prescriptions (ordonnances médecins)
- qr.routes.js — /api/v1/qr (QR codes)
- ratings.routes.js — /api/v1/ratings (évaluations)
- secretariat.routes.js — /api/v1/secretariat (file d'attente, agenda)
- telemedicine.routes.js — /api/v1/telemedicine (Jitsi)
- tiers-payant.routes.js — /api/v1/tiers-payant, /api/v1/admin/tiers-payant (tiers-payant)

## SERVICES DISPONIBLES
- airtel.service.js — Service Airtel Money
- amina.service.js — Service IA Amina (Anthropic Claude)
- conflict.service.js — Service gestion conflits
- coupon.service.js — Service coupons
- notification.service.js — Service notification unifié (WhatsApp, Push, SMS)
- preRdv.service.js — Service pré-RDV complet
- prorata.service.js — Service prorata abonnements
- push.service.js — Service push notifications (Web Push)
- renouvellement.service.js — Service renouvellement assisté
- secretariat.service.js — Service secrétariat
- sms.service.js — Service SMS Africa's Talking
- triage.service.js — Service triage feu tricolore
- whatsapp.service.js — Service WhatsApp Business API

## MIDDLEWARE DISPONIBLES  
- auth.middleware.js — Middleware authentification JWT
- errorHandler.js — Gestion erreurs globale
- idempotency.js — Middleware idempotence
- rateLimiter.js — Rate limiting (OTP: 5/15min, login: 20/hour)
- requestLogger.js — Logger requêtes
- validateAirtelWebhook.js — Validation webhook Airtel
- validateMtnWebhook.js — Validation webhook MTN MoMo

## SKILLS WINDSURF DISPONIBLES
- bolamu-ai-consult.md — Module IA Amina
- bolamu-cicd.md — Module CI/CD
- bolamu-conflits.md — Module Conflits
- bolamu-notifications.md — Module Notifications
- bolamu-secretariat.md — Module Secrétariat

## VARIABLES D'ENVIRONNEMENT
### Critiques (fail-fast si absentes en production)
DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET,
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET,
AT_API_KEY, AT_USERNAME, RESEND_API_KEY

### Optionnelles (warning si absentes)
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY — push désactivé
ANTHROPIC_API_KEY — Amina en simulation
MTN_*, AIRTEL_* — paiements manuels

## COMPTES DE TEST
- Patient : +242069735418
- Médecin : +242060000001 (Dr. Mbemba Jean)
- Pharmacie : +242066226116 (WR383LMW)
- Laboratoire : +242068582563
- Admin : +242060000099

## SCORE AYOKAI : 21/23 (91.3%)
Sécurité 8/8 — BDD 4/4 — Paiements 4/4 — Performance 5/7

## ACTIONS HUMAINES RESTANTES
- Domaine bolamu.co — achat + DNS Cloudflare → Render
- VAPID keys — npx web-push generate-vapid-keys → Render
- ANTHROPIC_API_KEY — console.anthropic.com → Render
- Africa's Talking Live — activer avec crédit
- Test MTN MoMo réel — 1 FCFA test
- Test SMS réel — 1 SMS test
