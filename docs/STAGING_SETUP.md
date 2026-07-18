# BOLAMU — Configuration de l'environnement STAGING

> Objectif : disposer d'un environnement de pré-production identique à la production
> (même code, même schéma de base) mais isolé (données séparées) pour tester en
> conditions réelles avant tout déploiement en production.

---

## 1. Créer la base de données staging (Neon)

1. Se connecter à la console Neon : https://console.neon.tech
2. Dans le projet Bolamu (région **Frankfurt**, comme la prod), créer une **nouvelle base** nommée :
   ```
   bolamu-staging
   ```
3. Récupérer la connection string de cette base (format `postgresql://...`), elle servira de
   `DATABASE_URL` pour le service staging.

---

## 2. Créer le service Render staging

1. Sur le dashboard Render, créer un nouveau **Web Service** :
   - **Nom** : `bolamu-backend-staging`
   - **Repo GitHub** : `natsybouiti-creator/bolamu-backend` (la même repo que la prod)
   - **Branche** : `main`
   - **Build command / Start command** : identiques au service de production
     (`npm ci` / `npm start`)
2. Copier **toutes les variables d'environnement** du service de production
   (`bolamu-backend`) vers le service staging, **SAUF** :
   - `DATABASE_URL` → pointer sur la connection string de la base **bolamu-staging** (étape 1)
   - `NODE_ENV` → mettre `staging`
3. Renseigner le deploy hook du service staging dans le secret GitHub
   `RENDER_DEPLOY_HOOK_STAGING` (utilisé par le job `deploy-staging` de la CI).

---

## 3. Synchroniser le schéma (sans les données)

Depuis un poste ayant accès aux deux bases :

```bash
pg_dump --schema-only $DATABASE_URL_PROD | psql $DATABASE_URL_STAGING
```

- `$DATABASE_URL_PROD` : connection string de la base de production Neon
- `$DATABASE_URL_STAGING` : connection string de la base `bolamu-staging`

> À relancer après chaque nouvelle migration exécutée en production, ou exécuter
> directement les fichiers `migrations/*.sql` sur la base staging (les migrations
> sont toutes en `CREATE TABLE IF NOT EXISTS`, donc rejouables).

**Note** : la table `platform_config` sera vide après un dump schema-only. Insérer
manuellement les lignes de configuration (prix, taux) nécessaires aux tests, ou copier
uniquement cette table :

```bash
pg_dump --data-only --table=platform_config $DATABASE_URL_PROD | psql $DATABASE_URL_STAGING
```

---

## 4. Variables d'environnement requises

Liste exacte des variables présentes dans `.env.example` :

| Variable | Description |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL — **base staging**, pas la prod |
| `JWT_SECRET` | Secret JWT (peut être différent de la prod) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary — cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary — API key |
| `CLOUDINARY_API_SECRET` | Cloudinary — API secret |
| `AT_USERNAME` | Africa's Talking — username |
| `AT_API_KEY` | Africa's Talking — API key |
| `MOMO_SUBSCRIPTION_KEY` | MTN MoMo (optionnel — API non activée) |
| `MOMO_API_USER` | MTN MoMo (optionnel) |
| `MOMO_API_KEY` | MTN MoMo (optionnel) |
| `MTN_WEBHOOK_SECRET` | Secret HMAC webhooks MTN |
| `MOMO_DISBURSEMENT_SUBSCRIPTION_KEY` | MTN MoMo Disbursement (versements sortants) |
| `MOMO_DISBURSEMENT_API_USER` | MTN MoMo Disbursement |
| `MOMO_DISBURSEMENT_API_KEY` | MTN MoMo Disbursement |
| `AIRTEL_CLIENT_ID` | Airtel Money (optionnel — API non activée) |
| `AIRTEL_CLIENT_SECRET` | Airtel Money (optionnel) |
| `AIRTEL_BASE_URL` | Airtel Money — base URL API |
| `AIRTEL_WEBHOOK_SECRET` | Secret HMAC webhooks Airtel |
| `SENTRY_DSN` | Sentry (recommandé : projet/environnement Sentry séparé pour staging) |
| `VAPID_PUBLIC_KEY` | Web Push VAPID — clé publique |
| `VAPID_PRIVATE_KEY` | Web Push VAPID — clé privée |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Business API — token |
| `WHATSAPP_PHONE_ID` | WhatsApp Business API — phone ID |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp Business API — verify token webhook |
| `ANTHROPIC_API_KEY` | Anthropic Claude (agent Amina, optionnel) |
| `TEST_API_BASE` | Tests E2E Playwright — pointer sur l'URL staging |
| `TEST_PATIENT_PASSWORD` | Tests E2E — mot de passe compte patient de test |
| `TEST_DOCTOR_PASSWORD` | Tests E2E — mot de passe compte médecin de test |
| `TEST_PHARMACIE_PASSWORD` | Tests E2E — mot de passe compte pharmacie de test |
| `TEST_ADMIN_PASSWORD` | Tests E2E — mot de passe compte admin de test |
| `GOOGLE_FIT_CLIENT_ID` | Google Fit OAuth (Sprint 2 Wellness) |
| `GOOGLE_FIT_CLIENT_SECRET` | Google Fit OAuth |
| `GOOGLE_FIT_REDIRECT_URI` | Google Fit OAuth — adapter à l'URL staging |
| `ENABLE_WELLNESS_CRON` | Cron wellness — laisser `false` en staging |
| `BOLAMU_WA_PHONE` | Vestige documentaire (non lu par le code actuel) |

Et en plus, spécifique au staging :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `staging` |

> ⚠️ **Ne jamais utiliser la `DATABASE_URL` de production sur le service staging.**
> C'est la seule variable qui DOIT différer (avec `NODE_ENV`).
