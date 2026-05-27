# BOLAMU — RUNBOOK DE DÉPLOIEMENT
**Date :** 20 mai 2026  
**Sprint :** 6 (Go-live production)

---

## 1. DÉPLOIEMENT STANDARD

### Pré-requis
- GitHub Actions activé dans le repo
- GitHub Secrets configurés (RENDER_DEPLOY_HOOK_STAGING, RENDER_DEPLOY_HOOK_PROD, STAGING_URL)
- Branch main protégée (requiert PR + review)

### Procédure
1. **Merger PR → main**
   - Créer une PR depuis develop vers main
   - Passer les tests CI/CD (lint → test → build)
   - Review du code par un autre développeur
   - Merger la PR

2. **Pipeline GitHub Actions se déclenche automatiquement**
   - **Lint** : ESLint + Prettier check
   - **Test** : Jest avec coverage 70%
   - **Build** : Docker image build + push vers ghcr.io
   - **Deploy Staging** : POST vers RENDER_DEPLOY_HOOK_STAGING

3. **Vérifier pipeline vert**
   - GitHub repo → onglet Actions
   - Vérifier que tous les jobs sont verts
   - En cas d'échec : investiguer et corriger

4. **Valider smoke tests staging**
   - Wait 30s (déploiement staging)
   - Health check : curl STAGING_URL/api/v1/test
   - Vérifier que status = "ok"
   - Tester manuellement quelques endpoints critiques

5. **Approuver deploy-prod manuellement**
   - GitHub Actions → job deploy-prod
   - "Approve" pour déclencher le déploiement production
   - Wait 30s (déploiement production)

6. **Vérifier health check production**
   - curl https://bolamu-backend.onrender.com/api/v1/test
   - Vérifier que status = "ok"
   - Vérifier que checks.database = "ok"

7. **Vérifier UptimeRobot**
   - UptimeRobot dashboard → moniteur Bolamu
   - Vérifier statut vert
   - Vérifier que le ping est OK

---

## 2. ROLLBACK D'URGENCE (30 secondes)

### Procédure
1. **Render dashboard → votre service → "Deploys"**
2. **Cliquer sur le dernier déploiement stable**
3. **"Rollback to this deploy"**
4. **Wait 30s** (Render déploie automatiquement)
5. **Vérifier health check après rollback**
   - curl https://bolamu-backend.onrender.com/api/v1/test
   - Vérifier que status = "ok"

### Notes
- Render garde les 10 derniers déploiements
- Rollback est instantané (30 secondes)
- Aucune donnée n'est perdue (rollback du code uniquement)

---

## 3. PROCÉDURE INCIDENT

### Niveau 1 — Dégradé (monitoring alerte)
- **Symptômes** : P95 > 500ms, error rate > 1%, CPU > 80%
- **Action** : logger warn, surveiller 15 min
- **Échelle** : Équipe ops informée, pas d'action immédiate

### Niveau 2 — Partiel (service dégradé)
- **Symptômes** : Error rate > 5%, CPU > 90%, database timeout
- **Action** : alerter via BetterStack, investiguer
- **Échelle** : Équipe ops + dev informée, investigation en cours

### Niveau 3 — Critique (service down)
- **Symptômes** : Service down, database down, error rate > 20%
- **Action** : rollback immédiat + SMS équipe
- **Échelle** : Rollback immédiat, investigation prioritaire

### Communication Incident
- **Interne** : Slack channel #incidents
- **Externe** : Status page (status.bolamu.co)
- **Post-mortem** : Documenter dans docs/INCIDENTS/

---

## 4. CHECKLIST GO-LIVE JOUR J

### Pré-déploiement
☐ Variables d'environnement production configurées dans Render
☐ Domaine bolamu.co pointé vers Render
☐ SSL actif (Cloudflare)
☐ Health check vert
☐ UptimeRobot actif
☐ BetterStack actif

### Tests réels
☐ Test paiement MTN MoMo réel (1 FCFA)
☐ Test paiement Airtel Money réel (1 FCFA)
☐ Test SMS Africa's Talking réel
☐ Test OTP fonctionnel
☐ Test inscription patient test réelle

### Base de données
☐ Backup Neon effectué
☐ Migration 022 exécutée
☐ Index vérifiés

### Monitoring
☐ Prometheus metrics exposées (/metrics)
☐ Winston logger actif
☐ Sentry actif
☐ BetterStack logs actifs

### Sécurité
☐ JWT_SECRET configuré
☐ MTN_WEBHOOK_SECRET configuré
☐ AIRTEL_WEBHOOK_SECRET configuré
☐ Rate limiting actif
☐ RBAC vérifié

### Documentation
☐ RUNBOOK-DEPLOY.md à jour
☐ SPRINT6-RAPPORT.md généré
☐ Équipe formée aux procédures

---

## 5. COMMANDES UTILES

### Docker local
```bash
docker build -t bolamu-backend .
docker run -p 3000:3000 bolamu-backend
docker-compose up
docker-compose down
```

### Tests locaux
```bash
npm test
npm run lint
npm run format:check
```

### Health check
```bash
curl https://bolamu-backend.onrender.com/api/v1/test
```

### Logs Render
```bash
# Via CLI Render
render logs --service bolamu-backend

# Via dashboard
Render → Services → bolamu-backend → Logs
```

---

## 6. CONTACTS URGENCE

### Équipe Ops
- **Ops Lead** : +242 06 000 000 01
- **Dev Lead** : +242 06 000 000 02
- **DBA** : +242 06 000 000 03

### Services tiers
- **Render Support** : support@render.com
- **Neon Support** : support@neon.tech
- **Africa's Talking** : support@africastalking.com
- **MTN MoMo** : support@mtn.com
- **Airtel Money** : support@airtel.com

---

## 7. POST-MORTEM INCIDENT

### Template
1. **Résumé** : Ce qui s'est passé ?
2. **Impact** : Combien d'utilisateurs touchés ? Durée ?
3. **Cause racine** : Pourquoi cela s'est-il produit ?
4. **Timeline** : Chronologie de l'incident
5. **Actions correctives** : Ce qui a été fait pour résoudre
6. **Actions préventives** : Ce qui sera fait pour éviter la récidive
7. **Leçons apprises** : Ce que nous avons appris

### Stockage
- Documenter dans docs/INCIDENTS/
- Nommer avec date : INCIDENT-YYYY-MM-DD.md
- Partager avec l'équipe via Slack

---

## 8. MAINTENANCE PLANIFIÉE

### Quotidien
- Vérifier health check (automatisé via UptimeRobot)
- Vérifier logs BetterStack (automatisé)
- Vérifier metrics Prometheus (automatisé)

### Hebdomadaire
- Vérifier backups Neon
- Vérifier erreurs Sentry
- Review incidents de la semaine

### Mensuel
- Review performance metrics
- Review sécurité (vulnérabilités)
- Review coûts Render

---

## 9. DÉPLOIEMENT CANARY (optionnel)

### Procédure
1. Déployer sur staging
2. Router 10% du traffic vers staging
3. Surveiller metrics pendant 1 heure
4. Si OK : augmenter à 50%
5. Si OK : router 100% vers staging
6. Si OK : déployer sur production

### Outils
- Cloudflare Load Balancer
- Render Preview Deployments
- Feature flags (via platform_config)

---

## 10. CHECKLIST POST-DÉPLOIEMENT

### Immédiat (après déploiement)
☐ Health check vert
☐ UptimeRobot vert
☐ Aucune erreur dans logs
☐ Aucune alerte Sentry
☐ Aucune alerte BetterStack

### Court terme (1 heure)
☐ Monitoring stable
☐ Aucune réclamation utilisateur
☐ Performance stable (P95 < 500ms)
☐ Error rate < 1%

### Long terme (24 heures)
☐ Aucune régression détectée
☐ Metrics stables
☐ Aucun incident majeur
☐ Documentation mise à jour

---

**Statut :** ✅ PRÊT POUR GO-LIVE  
**Dernière mise à jour :** 20 mai 2026
