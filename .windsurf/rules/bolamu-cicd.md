---
description: CI/CD + Docker + Tests + Monitoring (Sprint 5)
---

# BOLAMU — RÈGLES CI/CD

## ARCHITECTURE DOCKER

### Dockerfile Multi-Stage
- Stage 1 (Builder) : Node 20 Alpine, npm ci --only=production
- Stage 2 (Production) : Node 20 Alpine, utilisateur non-root (bolamu:1001)
- Healthcheck : GET /api/v1/test toutes les 30s (3 retries, timeout 10s)
- Port exposé : 3000
- Commande : node src/server.js

### .dockerignore
Exclure du build Docker :
- node_modules
- .env, .env.*
- *.log
- .git
- coverage
- docs
- scripts
- database/migrations

### docker-compose.yml (environnement de test local)
Services :
- api : build ., ports 3000:3000, volumes ./src:/app/src
- postgres : postgres:16-alpine, ports 5433:5432
- redis : redis:7-alpine, ports 6379:6379

Commandes utiles :
```bash
docker build -t bolamu-backend .
docker-compose up
docker-compose down
docker-compose logs -f api
```

---

## PIPELINE GITHUB ACTIONS

### Structure du pipeline (.github/workflows/bolamu-ci.yml)

**Jobs :**
1. **lint** : Lint & Format Check
   - npm ci
   - npm run lint
   - npm run format:check

2. **test** : Tests & Coverage
   - Service postgres:16-alpine
   - npm test -- --coverage --coverageThreshold='{"global":{"lines":70}}'
   - Upload artifact coverage-report

3. **build** : Build Docker Image
   - Condition : github.ref == 'refs/heads/main'
   - Build & push vers ghcr.io
   - Tags : latest + SHA

4. **deploy-staging** : Deploy to Staging
   - Environment : staging
   - POST vers RENDER_DEPLOY_HOOK_STAGING

5. **smoke-test** : Smoke Tests Staging
   - Wait 30s (déploiement)
   - Health check : curl STAGING_URL/api/v1/test

6. **deploy-prod** : Deploy to Production (Manuel)
   - Environment : production
   - POST vers RENDER_DEPLOY_HOOK_PROD
   - Approbation manuelle requise

### Variables GitHub Secrets à configurer manuellement

Settings → Secrets → Actions → New repository secret :
- **RENDER_DEPLOY_HOOK_STAGING** : Obtenir dans Render → Settings → Deploy Hook
- **RENDER_DEPLOY_HOOK_PROD** : Même source (service production)
- **STAGING_URL** : URL de votre service Render staging

### Activer GitHub Actions

GitHub repo → onglet Actions → "I understand my workflows" → Enable

---

## COMMANDES UTILES

### Tests locaux
```bash
npm test                    # Lancer tous les tests
npm run test:watch          # Mode watch
npm run lint                # Linting ESLint
npm run format              # Formater avec Prettier
npm run format:check        # Vérifier le format
```

### Docker local
```bash
docker build -t bolamu-backend .
docker run -p 3000:3000 bolamu-backend
docker-compose up
docker-compose down -v      # Down + volumes
```

### Coverage
```bash
npm test -- --coverage
# Rapport généré dans coverage/
```

---

## SEUILS D'ALERTE

### Performance
- **P95 latence** : > 500ms → alerte
- **P99 latence** : > 1000ms → alerte critique

### Erreurs
- **Error rate** : > 1% → alerte
- **Error rate** : > 5% → alerte critique

### Ressources
- **CPU** : > 80% → alerte
- **Memory** : > 85% → alerte
- **DB connections** : > 80% du pool → alerte

---

## PROCÉDURE DE ROLLBACK RENDER

Si un déploiement échoue :
1. Render détecte automatiquement l'échec
2. Rollback automatique vers la version précédente (30 secondes)
3. Vérifier les logs dans Render Dashboard
4. Si rollback manuel nécessaire :
   - Render → Services → bolamu-backend → Deployments
   - Sélectionner la version précédente → "Redeploy"

---

## MONITORING

### Prometheus Metrics
- GET /metrics (accès restreint IP interne uniquement)
- Métriques exposées :
  - bolamu_http_requests_total (par route/méthode/status)
  - bolamu_http_request_duration_seconds (histogram P95/P99)
  - bolamu_db_connections_active (gauge)

### Winston Logger
- 3 transports :
  1. Console (développement uniquement)
  2. Fichier logs/error.log (erreurs uniquement)
  3. BetterStack (si BETTERSTACK_SOURCE_TOKEN présent)
- Format : JSON structuré avec timestamp, level, message, context
- Ne jamais logger : passwords, tokens JWT, numéros de carte

### Request Logger Middleware
- Logger chaque requête : method, path, status, duration_ms, user_phone, ip
- Exclut /metrics et /api/v1/test des logs (trop verbeux)

---

## VARIABLES D'ENVIRONNEMENT

### Production (Render)
- DATABASE_URL
- JWT_SECRET
- BETTERSTACK_SOURCE_TOKEN (optionnel)

### Staging (Render)
- DATABASE_URL (staging DB)
- JWT_SECRET (staging secret)
- BETTERSTACK_SOURCE_TOKEN (optionnel)

### Local (docker-compose.yml)
- DATABASE_URL=postgresql://bolamu:bolamu_test_pwd@postgres:5432/bolamu_test
- JWT_SECRET (local secret)

---

## RÈGLES DE SÉCURITÉ

- Jamais de secrets dans le code (toujours depuis process.env)
- Secrets dans GitHub Secrets (jamais commités)
- Dockerfile : utilisateur non-root (bolamu:1001)
- Healthcheck : vérifie /api/v1/test (pas de sensibles)
- Metrics endpoint : accès restreint IP interne uniquement
- Logger : ne jamais logger passwords, tokens, numéros de carte
