# BOLAMU — CONTEXTE PROJET — v1.0.0
Mis à jour : 27 mai 2026
Statut : EN PRODUCTION — https://api.bolamu.co
Score Ayokai : 21/23 (91.3%)

## STACK TECHNIQUE
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

## 7 RÔLES UTILISATEURS
patient, doctor, pharmacie, laboratoire,
admin, content_admin, secretaire

## RÈGLES ABSOLUES — NE JAMAIS VIOLER
1. phone = identifiant universel (jamais l'id numérique)
2. Soft delete uniquement — is_active = false (jamais DELETE)
3. audit_log = insert-only, jamais UPDATE ni DELETE
4. BEGIN/COMMIT/ROLLBACK sur toutes les opérations financières
5. Montants depuis platform_config uniquement — jamais hardcodés
6. Validation montants côté serveur uniquement
7. Jamais de secrets dans le code — toujours process.env
8. Jamais de stack trace exposée en production
9. notify() après chaque action impactant un patient
10. Amina : disclaimer médical obligatoire, max 300 tokens
11. RBAC strict sur tous les endpoints
12. member_code : MAX() + 1 — jamais COUNT()
13. is_active partenaires TOUJOURS depuis table spécifique
14. normalizePhone() pour tous les numéros
15. SMS TOUJOURS via src/services/sms.service.js
16. La table prescriptions labo s'appelle lab_prescriptions

## MIGRATIONS EXÉCUTÉES
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

## NOUVELLES TABLES (Sprints 1-9)
refresh_tokens, time_slots, lab_orders_priority,
conflicts, conflict_messages, conflict_actions,
coupons, coupon_usages, idempotency_keys,
push_subscriptions, notifications,
secretaires, file_attente, agenda_blocs,
pre_rdv_formulaires, ai_consult_sessions,
renouvellement_demandes

## SERVICES DISPONIBLES
airtel.service.js
amina.service.js
conflict.service.js
coupon.service.js
notification.service.js
preRdv.service.js
prorata.service.js
push.service.js
renouvellement.service.js
secretariat.service.js
sms.service.js
triage.service.js
whatsapp.service.js

## MIDDLEWARE DISPONIBLES
auth.middleware.js
errorHandler.js
idempotency.js
rateLimiter.js
requestLogger.js
validateAirtelWebhook.js
validateMtnWebhook.js

Middleware clés ajoutés :
- rateLimiter.js : strict(5/15min), standard(30/min), webhook(100/min)
- idempotency.js : sur POST paiements
- validateMtnWebhook.js : HMAC-SHA256
- requestLogger.js : logs structurés Winston
- errorHandler.js : erreurs standardisées sans stack trace

## ROUTES API MONTÉES
auth.routes.js
patient.routes.js
doctor.routes.js
appointment.routes.js
payment.routes.js
prescription.routes.js
pharmacie.routes.js
laboratoire.routes.js
admin.routes.js
credits.routes.js
momo.routes.js
airtel.routes.js
qr.routes.js
report.routes.js
lab.routes.js
ratings.routes.js
payouts.routes.js
bank-transfer.routes.js
clearing.routes.js
collecte.routes.js
partner-convention.routes.js
tiers-payant.routes.js
constantes-medicales.routes.js
conflict.routes.js
coupon.routes.js
notification.routes.js
secretariat.routes.js
preRdv.routes.js
articles.routes.js
map.routes.js

## SKILLS WINDSURF DISPONIBLES
bolamu-ai-consult.md
bolamu-cicd.md
bolamu-conflits.md
bolamu-notifications.md
bolamu-secretariat.md

## VARIABLES D'ENVIRONNEMENT
### Critiques (fail-fast production)
DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET,
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET,
AT_API_KEY, AT_USERNAME, RESEND_API_KEY

### Optionnelles (warning seulement)
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
ANTHROPIC_API_KEY
MTN_MOMO_PRIMARY_KEY, MTN_WEBHOOK_SECRET
AIRTEL_CLIENT_ID, AIRTEL_CLIENT_SECRET, AIRTEL_WEBHOOK_SECRET
BETTERSTACK_SOURCE_TOKEN

## COMPTES DE TEST
- Patient : +242069735418
- Médecin : +242060000001 (Dr. Mbemba Jean)
- Pharmacie : +242066226116 (WR383LMW)
- Laboratoire : +242068582563
- Admin : +242060000099

## ACTIONS HUMAINES RESTANTES
- Domaine bolamu.co — achat + DNS Cloudflare → Render
- VAPID keys — npx web-push generate-vapid-keys → Render
- ANTHROPIC_API_KEY — console.anthropic.com → Render
- Africa's Talking Live — activer avec crédit
- Test MTN MoMo réel
- Test SMS réel
