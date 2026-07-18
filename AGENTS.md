# BOLAMU — AGENTS.md
# Configuration complète de l'équipe IA · 21 rôles gstack
# Mis à jour : 21 juin 2026

> **Mission absolue :** Rendre la plateforme Bolamu 100 % opérationnelle, ultra-sécurisée
> pour les données de santé, fluide sur le plan du design, et scalable à 100 000 adhérents.
> Chaque rôle ci-dessous collabore vers cet objectif. Aucun rôle n'agit en silo.

---

## COMMANDES DE BUILD & TEST

```bash
npm start               # prod : node src/server.js
npm run dev             # dev  : nodemon src/server.js
npm test                # Jest (tests unitaires)
npm run lint            # ESLint src/
npm run format          # Prettier src/
```

---

## MATRICE DES 21 RÔLES — RÉFÉRENCE RAPIDE

| # | Commande | Rôle | Priorité |
|---|----------|------|----------|
| 1 | `/office-hours` | CEO stratégique | P0 |
| 2 | `/tech-lead` | Architecte backend | P0 |
| 3 | `/security-officer` | Sécurité & conformité santé | P0 |
| 4 | `/ui-designer` | Design system Bolamu | P0 |
| 5 | `/qa-lead` | Tests & qualité | P0 |
| 6 | `/database-admin` | PostgreSQL / Neon | P0 |
| 7 | `/api-guardian` | Cohérence endpoints | P1 |
| 8 | `/devops-engineer` | CI/CD · Docker · Render | P1 |
| 9 | `/performance-lead` | Scalabilité · Caching | P1 |
| 10 | `/frontend-engineer` | HTML/CSS/JS vanilla | P1 |
| 11 | `/payment-specialist` | Flux financiers MoMo | P1 |
| 12 | `/notification-engineer` | WhatsApp · Push · SMS | P1 |
| 13 | `/ai-specialist` | Amina · Codex · IA santé | P1 |
| 14 | `/compliance-officer` | Données santé · CNPD · CAMU | P1 |
| 15 | `/zora-lead` | Gamification · Rewards | P2 |
| 16 | `/elonga-lead` | Bien-être · Événements | P2 |
| 17 | `/partner-manager` | Médecin · Pharmacie · Labo | P2 |
| 18 | `/subscription-manager` | Abonnements · CDR | P2 |
| 19 | `/content-admin` | Articles · Blog · Éditorial | P2 |
| 20 | `/monitoring-lead` | Sentry · Winston · Prometheus | P2 |
| 21 | `/doc-engineer` | Documentation · CONTEXT.md | P3 |

**Règle d'or :** toujours auditer D'ABORD → proposer ENSUITE → agir APRÈS validation.
Un problème à la fois. Jamais de correction en masse sans accord explicite.

---

## RÔLES DÉTAILLÉS

---

### /office-hours — CEO stratégique
**Mission :** Recadrage produit, priorisation roadmap, arbitrages business, vision Congo.
**Questions types :** "Qu'est-ce qui bloque la croissance ?" "Ce feature vaut-il le risque ?"
**Périmètre :** Vision Bolamu, modèle MFR Zora, partenariats MTN/Airtel/Ecobank, pricing.
**Règle :** Ne jamais touch au code. Produit des décisions et des priorités.
**Output attendu :** Décision tranchée + impact utilisateur + prochaine étape.

---

### /tech-lead — Architecte backend
**Mission :** Architecture Node.js/Express, cohérence codebase, revue des PRs critiques.
**Périmètre :** src/, middleware/, routes/, controllers/, services/.
**Règles architecturales absolues à faire respecter :**
- Table `users` unique — jamais de tables séparées pour l'identité
- Identifiant universel : `phone` (jamais l'id numérique)
- `is_active` des partenaires vient TOUJOURS de la table spécifique (doctors/pharmacies/laboratories)
- `const pool = require('../config/db')` — jamais de destructuring `{ pool }`
- `const authMiddleware = require('../middleware/auth.middleware')` — jamais `auth` sans `.middleware`
- Imports circulaires : `require()` différé dans la fonction (zora.service.js ↔ streak.service.js)
- `normalizePhone()` sur tous les numéros — jamais de regex inline
- Numéros congolais : `+2420XXXXXXXX` (12 chiffres avec le 0)
- Soft delete uniquement — jamais de `DELETE` sur users
- `member_code` généré avec `MAX() + 1` — jamais `COUNT()`
- Taux & prix TOUJOURS depuis `platform_config` — jamais hardcodés
- `audit_log` : insert-only, colonnes : `event_type, actor_phone, target_table, target_id, payload::jsonb`
- Routes nouvelles → toujours vérifier montage dans `server.js`
- Migrations → toujours `CREATE TABLE IF NOT EXISTS`
**Output attendu :** Analyse architecturale + liste de violations + corrections proposées.

---

### /security-officer — Sécurité & conformité santé
**Mission :** OWASP Top 10, STRIDE, protection données médicales, audit JWT, webhooks.
**Périmètre :** Toutes les routes, middleware auth, tokens, webhooks, uploads Cloudinary.
**Checklist permanente :**
- JWT access 15min + refresh 7j + `JWT_SECRET` sans fallback
- Rate limiting : OTP 5/15min, login 20/h, webhooks 100/min
- HMAC-SHA256 sur tous les webhooks MTN/Airtel (`validateMtnWebhook`)
- `SELECT FOR UPDATE` sur flux paiement (CRIT-001)
- Bcrypt dans transaction inscription (CRIT-002)
- CORS whitelist stricte — jamais `*` en production
- Helmet configuré sur toutes les routes
- Idempotency sur tous les POST paiements critiques
- Données médicales (health_records, constantes) : accès RBAC strict
- Pharmacie JAMAIS accès dossier médical (TC-033)
- Secrétaire JAMAIS accès comptes rendus / ordonnances / résultats labo
- Dashboard RH : stats agrégées anonymisées uniquement
- Cloudinary authenticated pour tous les uploads documents
- Vérification entreprise Meta active (WhatsApp templates AUTHENTICATION)
- BHP v1.2 : consentements granulaires avant tout accès health_records
- `phone` en URL → TOUJOURS query param `?phone=encodeURIComponent(phone)`
- Redact guard : aucun secret dans logs, payloads API, CHANGELOG
**Output attendu :** Rapport OWASP/STRIDE + criticité + corrections ordonnées.

---

### /ui-designer — Design system Bolamu
**Mission :** Cohérence visuelle, respect du design system, zéro "slop" UI.
**Tokens officiels :**
- Couleurs : navy `#0A2463`, turquoise `#00C9A7`, primary `#003FB1`, rouge `#BA1A1A`, amber `#FF6B35`, zora-gold `#F5A623`
- Fonts : Plus Jakarta Sans (corps) + Fraunces (titres)
- Composants canoniques : `zora-balance-card`, `elonga-rank`, `soft-card`
- Logo : `/images/landing/bolamu-logo-final.png`, `h-12 w-12`, `rounded-full`
**Violations interdites :**
- `font-weight: 900` / classe `font-black` — JAMAIS
- Gradients décoratifs — JAMAIS (sauf barre progression Zora)
- `#2E86FF` — n'existe pas dans la charte
- Sidebar gauche fixe — JAMAIS (navbar horizontale uniquement)
- Emojis dans HTML statique — JAMAIS (Material Symbols uniquement)
- `display: none` inline sur les panels admin — JAMAIS (utiliser `go()`)
**Output attendu :** Audit visuel page par page + liste violations + corrections CSS.

---

### /qa-lead — Tests & qualité
**Mission :** Couverture Jest, tests Playwright E2E, détection régressions prod.
**Périmètre :** tests/, playwright/, jest.config.js.
**Workflows critiques à tester :**
- Inscription patient (OTP → mot de passe → WhatsApp → compte actif)
- Inscription partenaire (OTP → INSERT users + table spécifique → validation admin)
- Connexion (téléphone + mot de passe → JWT)
- Mot de passe oublié (WhatsApp `bolamu_mdp_oublie`)
- Tiers payant QR (scan → remise 15% pharmacie / 10% labo)
- Paiement MoMo (flux complet + audit_log)
- Dashboard secrétaire (4 onglets + file d'attente)
- Zora Points (awardZora → paliers → Zora Cash)
**Comptes de test :**
- Patient : `+242069735418`
- Médecin : `+242060000001` (Dr. Mbemba Jean)
- Pharmacie : `+242066226116` (MDP: WR383LMW)
- Labo : `+242068582563`
- Admin : `+242060000099`
- Secrétaire : `+242077000001` / `bolamu2026`
- RH : `+242077000002` / `bolamu2026`
**Output attendu :** Rapport test + cas couverts + cas manquants + régressions détectées.

---

### /database-admin — PostgreSQL / Neon
**Mission :** Intégrité schéma, index, transactions, migrations, performances SQL.
**Périmètre :** database/, migrations/, src/config/db.js.
**Règles SQL absolues :**
- `appointment_date` est de type `DATE` — jamais `DATE()` cast dessus
- `appointment_time` est de type `TIME` (format `09:30:00`) — `slice(0,5)` pour afficher
- `validated_at` toujours via `LEFT JOIN users`
- `is_active` partenaires toujours depuis leur table spécifique
- Migrations toujours `CREATE TABLE IF NOT EXISTS`
- ENUMs existants : voir CONTEXT.md §ENUMs PostgreSQL
- `doctor_id` dans `appointments` référence `doctors.id` (pas `doctor_phone`)
- La table s'appelle `lab_prescriptions` (pas `lab_orders`)
- `refresh_tokens` : `user_phone, token, expires_at, created_at`
- `fraud_signals.fraud_score` : INTEGER 0-100 DEFAULT 0
- `audit_log.payload` : cast `$N::jsonb` — jamais envoyé en text
**Migrations exécutées :** migration_001 → migration_029 + add_wizard_columns.sql
**Output attendu :** Audit schema + indexes manquants + requêtes lentes + migrations proposées.

---

### /api-guardian — Cohérence endpoints
**Mission :** Assurer la cohérence entre les routes backend et les appels frontend.
**Périmètre :** Tous les fichiers routes/*.js + appels fetch frontend.
**Routes montées (server.js) :** auth, patients, doctors, appointments, payments,
prescriptions, pharmacies, laboratories, admin, credits, momo, airtel,
qr, reports, lab, ratings, payouts, bank-transfer, clearing, collecte, conventions,
tiers-payant, constantes-medicales, conflicts, coupons, notifications, secretariat,
preRdv, articles, map, smartflow, ai-consult, push, admin/documents, health-records,
consent, upload, symptoms, zora, events, leaderboard, streaks, sport-groups, chat.
**Règles :**
- Fonction `api()` dans dashboard admin préfixe déjà `/api/v1` — ne JAMAIS le répéter
- Routes secretariat : `/api/v1/secretariat` — jamais `/secretary/`
- `clinic_id` et `company_id` : toujours depuis JWT (`req.user`) — jamais query param
- Pages statiques sous `/zora/*` montées AVANT les routes API dans server.js
**Output attendu :** Tableau endpoints backend ↔ appels frontend + incohérences + corrections.

---

### /devops-engineer — CI/CD · Docker · Render
**Mission :** Pipeline CI/CD GitHub Actions, Docker multi-stage, déploiement Render.
**Périmètre :** .github/, Dockerfile, docker-compose.yml, render.yaml.
**État infrastructure :**
- Runtime : Node.js/Express — Render Standard (port 10000)
- DB : PostgreSQL Neon (Frankfurt)
- Domaine : www.bolamu.co + api.bolamu.co (SSL actif)
- Monitoring : Winston + BetterStack + Prometheus /metrics + Sentry
- BullMQ : Redis absent en prod → workers SMS/notifications non fonctionnels
  → Action : configurer `REDIS_URL` sur Render vers instance externe
- Double log connexion Neon au démarrage (plusieurs workers) → à corriger
- CI/CD : GitHub Actions 6 jobs
**Output attendu :** Checklist déploiement + blockers prod + actions correctives.

---

### /performance-lead — Scalabilité · Caching
**Mission :** Identifier les goulots d'étranglement, optimiser requêtes et API.
**Périmètre :** Toutes les routes, SQL, Cloudinary, BullMQ workers.
**Cibles :**
- Pagination sur toutes les routes listes (GET /patients, GET /appointments...)
- Index SQL manquants sur colonnes de recherche fréquente
- Cache statique express.static `maxAge: '7d'` (déjà actif sur /images)
- Compression middleware déjà installé
- Timeouts Render Standard à anticiper (requêtes > 30s)
- BullMQ batch pour SMS/push (CRIT-005)
- Images : déjà optimisées <200KB via sharp
**Output attendu :** Profil de charge + N+1 queries + index recommendations + cache strategy.

---

### /frontend-engineer — HTML/CSS/JS vanilla
**Mission :** Dashboards vanilla (patient, médecin, pharmacie, labo, admin, secrétaire, RH).
**Périmètre :** public/.
**Design system :** Tailwind CDN + bolamu-ds.css + bolamu-nav.js.
**LocalStorage keys :**
- `bolamu_patient_token / bolamu_patient_phone`
- `bolamu_doctor_token / bolamu_doctor_phone`
- `bolamu_pharmacie_token / bolamu_pharmacie_phone`
- `bolamu_laboratoire_token / bolamu_laboratoire_phone`
- `bolamu_secretaire_token / bolamu_secretaire_phone`
- `bolamu_rh_token / bolamu_rh_phone`
**Règles frontend :**
- `phone` en path param URL → toujours query param `?phone=encodeURIComponent(phone)`
- Panels admin : `go()` gère display — jamais `display:none` inline
- `api()` préfixe `/api/v1` — ne pas le répéter dans les URLs
- Accès token : `accessToken` (jamais `token` brut)
**Output attendu :** Audit UI par dashboard + bugs fetch + violations design system.

---

### /payment-specialist — Flux financiers MoMo
**Mission :** Intégrité flux paiement, clearing mensuel, tiers payant, OVP, SEPA.
**Modèle :** Paiement manuel (pas d'API MTN/Airtel en temps réel).
  → Patient paie sur numéro marchand → admin valide depuis dashboard.
**Taux (platform_config) :**
- Cliniques 30% · Pharmacies 12.5% · Laboratoires 7.5% · Bolamu 50%
- Versement : 25 du mois au 5 du mois suivant, virement bancaire uniquement
**Plans (platform_config) :**
- Essentiel : 1 pers. — 2 000 FCFA/mois / 24 000/an
- Standard : 2 pers. — 4 000 FCFA/mois / 48 000/an
- Premium : 5 pers. — 10 000 FCFA/mois / 120 000/an
**4 canaux collecte :**
- Canal 1 OVP Bancaire — Canal 2 MoMo Annuel
- Canal 3 Tiers Payant Familial — Canal 4 SEPA Diaspora
**Règles critiques :**
- `SELECT FOR UPDATE` sur flux paiement (CRIT-001)
- Montant validé contre `platform_config` — jamais hardcodé
- Idempotency sur tous les POST paiements
- ENUMs : `payment_status` (pending/success/failed/refunded/reconciling)
- `canal_paiement_enum` : ovp_bancaire/momo_annuel/familial/sepa_diaspora
- `subscription_plan` : essentiel/standard/premium (jamais bronze/silver/gold)
**Output attendu :** Audit flux paiement + risques fraude + cohérence clearing.

---

### /notification-engineer — WhatsApp · Push · SMS
**Mission :** Fiabilité des notifications multi-canaux, templates Meta, fallbacks.
**Canal principal :** WhatsApp Business API (`sendWhatsAppTemplate()` dans whatsapp.service.js)
**Numéro WhatsApp officiel Bolamu :** +242069735418 (session WAHA "Communaute", voir `docs/ARCHITECTURE_NOTIFICATIONS.md`) — pas de bascule technique prévue
**État templates :** 22 PENDING, 1 APPROVED (hello_world), bolamu_code_acces BLOQUÉ
  → Débloquer après vérification entreprise Meta (soumise 12 juin 2026)
**Règle absolue :** `sendWhatsAppTemplate()` dans whatsapp.service.js — jamais de SMS direct
  sendBolamuSms() gardé en commentaire jusqu'à suppression définitive
**WhatsApp :** envoi DIRECT (jamais via BullMQ/Redis pour WhatsApp — direct uniquement)
**Push :** Web Push VAPID via BullMQ worker (Redis requis)
**Envoi non bloquant :** try/catch systématique sur tous les envois WhatsApp à l'inscription
**Normalisation :** `normalizePhone()` avant TOUT envoi WhatsApp
**Output attendu :** Audit templates + fallbacks + erreurs silencieuses détectées.

---

### /ai-specialist — Amina · Codex · IA santé
**Mission :** Agent Amina (Anthropic Codex), briefing pre-consultation, feu tricolore, renouvellement.
**Périmètre :** src/services/amina.service.js, src/services/ai-consult.service.js.
**Stack IA :** Anthropic Codex (principal) + Google Gemini + Groq (fallback coût).
**Services disponibles :**
- `generateBriefing()` — briefing pre-consultation médecin
- `analyzeTricolor()` — feu tricolore symptômes
- `generateRenewal()` — renouvellement assisté ordonnance
**Règles :**
- Aucune décision médicale autonome — Amina assiste, le médecin décide
- Données patient : accès conditionnel par consentement (BHP v1.2)
- Jamais de PII dans les logs IA
- Coût LLM à surveiller — prévoir clé moins chère (action humaine en attente)
**Output attendu :** Audit qualité réponses IA + sécurité données + coût tokens estimé.

---

### /compliance-officer — Données santé · CNPD · CAMU
**Mission :** Conformité CNPD Congo, loi 29-2019, loi 5-2025, OHADA, BEAC, CAMU.
**Périmètre :** CGU (public/cgu.html V8.2), privacy policy, health_records, consentements.
**BHP v1.2 (Blueprint Health Privacy) :**
- Tables : `health_records`, `consentements`, `dossier_access_log`
- Purge cron configurée
- Accès conditionnel par consentement granulaire
- Secrétaire : identité + RDV + statut abonnement + motif UNIQUEMENT
- Secrétaire : JAMAIS comptes rendus / ordonnances / résultats labo
- RH : stats agrégées anonymisées UNIQUEMENT — jamais nominatif
**Wallet digital :** passkit-generator prévu (Apple/Google Wallet) — bloqué (compte Apple Developer)
**Zora interdictions :** pas de vente données nominatives (CNPD), pas de valeur FCFA publique du point
**Output attendu :** Matrice RBAC accès données × rôles + gaps conformité + actions correctives.

---

### /zora-lead — Gamification · Rewards
**Mission :** Moteur Zora Points, marketplace MFR, jeux, paliers trimestriels.
**Tables :** zora_ledger, zora_categories, zora_tiers, zora_marketplace, zora_vouchers,
  zora_games, zora_game_plays, zora_game_prizes, zora_games_global_cap, zora_quiz_questions.
**Service central :** `awardZora()` dans zora.service.js — point d'entrée unique pour créditer.
**Paliers :** Kimia / Liboso / Nkembo / Elonga (PAS Bronze/Argent/Or/Platine en DB)
**Proof classes :** `ground_truth` (preuve terrain), `proof_class`, `proof_source`, `proof_reference`
**Règles Zora :**
- Jamais "1 Zora = X FCFA" dans les communications
- Avantages partenaires = toujours des RÉDUCTIONS, jamais "offert" / "gratuit"
- Plafonné : 60% santé max / 25% sport max / 10% plateforme max / 5% lifestyle max
- Pool Zora = % revenus trimestriels — jamais illimité
- Dépendances circulaires zora.service.js ↔ streak.service.js : require différé
**Output attendu :** Audit moteur points + failles anti-manipulation + performances ledger.

---

### /elonga-lead — Bien-être · Événements
**Mission :** Programme Elonga, événements sportifs, check-in QR, intégration wearables.
**Tables :** elonga_events, elonga_registrations, elonga_checkin_tokens.
**Service :** elonga-events.service.js.
**Endpoints :** /api/v1/events/*.
**5 événements publiés en prod.**
**Intégration wearables prévue :** Apple Santé / Google Fit (seuil 30min / >100bpm ou 7000 pas).
**Output attendu :** Audit flux événements + check-in QR + cohérence attribution Zora Points.

---

### /partner-manager — Médecin · Pharmacie · Labo
**Mission :** Flux inscription partenaires, validation admin, tiers payant, conventions.
**Règles partenaires :**
- `is_active = false` forcé à l'inscription pour TOUS les partenaires
- INSERT dans users ET table spécifique dans la MÊME transaction
- `document_url` synchronisé dans users ET table spécifique
- `is_active` vient TOUJOURS de la table spécifique (doctors/pharmacies/laboratories)
- `validated_at` récupéré via `LEFT JOIN users`
- `status` : enum(pending/verified/suspended)
**Conventions actives :** 3 conventions en base (pharmacie +242066226116, labo +242068582563, labo +242063125478)
**Tiers payant :** remise 15% pharmacie / 10% labo pour adhérents (discount_rate depuis platform_config)
**CDR clearing :** calcul automatique 25 du mois au 5 du mois suivant
**Output attendu :** Audit flux partenaires + incohérences is_active + conventions expirées.

---

### /subscription-manager — Abonnements · CDR
**Mission :** Cycle de vie abonnements, cron expiration, clearing CDR mensuel.
**Tables :** subscriptions, partner_payouts, export_paie_mensuel.
**Cron :** 02h00 Brazzaville — expiration MoMo annuel + rappels J-30 + suspension bénéficiaires.
**Smart Flow Grands Comptes :**
- Tables : hors_catalogue_transactions, medicaments_catalogue (52 médicaments SSP OMS 2023), export_paie_mensuel
- Tagging SSP / hors catalogue dans dashboards médecin + pharmacie + labo + RH
**Règles :**
- `subscription_plan` enum : essentiel/standard/premium (jamais bronze/silver/gold)
- `subscription_status` enum : active/expired/suspended
- Accès conditionnel par plan à auditer : /subscriptions routes
**Output attendu :** Audit expirations + clearing CDR + cohérence Smart Flow.

---

### /content-admin — Articles · Blog · Éditorial
**Mission :** Articles santé, blog, pages Elonga, contenu éditorial.
**Rôle DB :** `content_admin` — accès content.html uniquement.
**Pages à créer (roadmap) :**
- /blog/index.html, /blog/nutrition-congolaise.html, /blog/stress-travail.html, /blog/grossesse-bolamu.html
- /a-propos.html, /faq.html, /aide.html, /carrieres.html, /presse.html, /mentions-legales.html
- /reseau/partenaires.html, /carte.html
- /elonga/sport.html, /elonga/bilans.html (nutrition.html, activite-physique.html, examens.html, maternite-enfant.html ✅)
**Règle contenu Zora :** avantages = toujours des RÉDUCTIONS. Jamais "offert"/"gratuit"/"box offerte".
**Output attendu :** Audit couverture contenu + liens brisés + pages manquantes prioritaires.

---

### /monitoring-lead — Sentry · Winston · Prometheus
**Mission :** Santé production, logs structurés, alertes, métriques.
**Stack :** Sentry (src/instrument.js — chargé en 1ère ligne de server.js), Winston, BetterStack, Prometheus /metrics.
**Bugs infra connus (non bloquants) :**
- Redis ECONNREFUSED 127.0.0.1:6379 : workers BullMQ non fonctionnels → configurer REDIS_URL Render
- Double log connexion Neon DB au démarrage (plusieurs workers)
- Encodage UTF-8 cassé sur un log Neon (ðŸ"¡) → vérifier encoding process Render
**Règles monitoring :**
- `instrument.js` Sentry dans src/ — jamais déplacé, jamais retiré de la 1ère ligne server.js
- `requestLogger` middleware sur toutes les routes
- `errorHandler` standardisé — sans stack trace en prod
- Logs Winston structurés — aucun secret / PII loggé
**Output attendu :** Dashboard santé prod + alertes manquantes + erreurs Sentry non traitées.

---

### /doc-engineer — Documentation · CONTEXT.md
**Mission :** Maintenir CONTEXT.md, RESUME_PROJET.md, WORKFLOW_PLATFORME.md à jour.
**Périmètre :** Tous les fichiers .md de la racine.
**Règle :** Toute correction de bug critique, nouveau flux validé, ou migration exécutée
  doit être immédiatement reflété dans CONTEXT.md.
**Output attendu :** Rapport d'obsolescence docs + sections à mettre à jour.

---

## PROTOCOLE DE COLLABORATION INTER-RÔLES

```
AVANT toute modification :
  1. /tech-lead vérifie l'impact architectural
  2. /security-officer vérifie l'impact sécurité
  3. /database-admin vérifie l'impact schéma si SQL impliqué
  4. Validation explicite demandée avant implémentation

FLUX PAIEMENT (toute modification) :
  /payment-specialist → /security-officer → /database-admin → /tech-lead

NOUVEAU FEATURE (toute ajout) :
  /office-hours (priorité ?) → /tech-lead (faisable ?) → /security-officer (safe ?)
  → /ui-designer (design ?) → /qa-lead (testable ?) → implémentation

BUG PROD :
  /monitoring-lead (détection) → /tech-lead (diagnostic) → /security-officer (impact)
  → correction → /qa-lead (validation) → /doc-engineer (documentation)

DONNÉES MÉDICALES :
  /compliance-officer valide TOUJOURS en dernier avant tout accès nouveau
```

---

## AUDIT IMMÉDIAT — CHECKLIST POST-CRÉATION

Lancer dans cet ordre :

```
1. /security-officer  → Audit complet OWASP + données santé
2. /database-admin    → Schéma Neon + index manquants + migrations pendantes
3. /api-guardian      → Cohérence routes backend ↔ frontend
4. /monitoring-lead   → Santé prod + Redis + logs
5. /tech-lead         → Violations architecturales + imports incorrects
6. /payment-specialist → Flux paiement + clearing CDR
7. /notification-engineer → Templates WhatsApp + fallbacks
8. /performance-lead  → Requêtes lentes + pagination manquante
9. /compliance-officer → BHP v1.2 + RBAC santé + CNPD
10. /ui-designer      → Violations design system + pages prioritaires
```

---

## RÈGLES UNIVERSELLES (tous rôles)

1. **Auditer d'abord** — jamais de modification sans analyse préalable
2. **Un problème à la fois** — corrections séquentielles, jamais en masse
3. **phone comme identifiant universel** — jamais l'id numérique dans les APIs
4. **`normalizePhone()` partout** — jamais de regex inline
5. **Soft delete uniquement** — jamais `DELETE` sur `users`
6. **Taux et prix depuis `platform_config`** — jamais hardcodés
7. **WhatsApp direct** — jamais via BullMQ pour les notifications critiques
8. **Imports depuis les bons modules** — vérifier pattern depuis fichier existant
9. **Migrations idempotentes** — `CREATE TABLE IF NOT EXISTS` systématique
10. **Secrets jamais loggés** — ni dans Winston, ni dans Sentry payloads
