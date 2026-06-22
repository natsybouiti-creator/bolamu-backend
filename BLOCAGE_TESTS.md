# BLOCAGE_TESTS.md — Problèmes dépassant 5 tentatives

> Créé le 2026-06-22. Issues identifiées après analyse complète de la suite Playwright (104 tests).
> Ces blocages nécessitent une intervention humaine ou une refonte partielle des tests.

---

## BLOCAGE 1 — Rate limiter systémique (strictLimiter 5 req/15 min)

**Fichiers concernés :** marketplace.spec.js (tests 2-7), critical-flows.spec.js (tous), events.spec.js (admin login)

**Symptôme :** HTTP 429 sur `/auth/login` dans les tests chromium après que les tests api-e2e aient épuisé le quota.

**Quota consommé dans un run complet :**
- auth.setup.js : 1 call (patient login)
- 01-inscription : 3 calls (request-otp, verify-otp, register/patient)
- 02-paiement : 1 call (admin-login)
- 04-prescription : 1 call (médecin login)
= **6 calls → quota de 5 dépassé avant les tests chromium**

**Pourquoi non fixable ici :**
- `marketplace.spec.js` fait 14 appels `/auth/login` répartis sur 7 tests (chaque test relogue patient + partenaire)
- `critical-flows.spec.js` fait 6+ logins (patient, pharmacie, admin, médecin)
- Réécrire ces fichiers pour partager un seul token par rôle est une refonte majeure

**Solution proposée (hors scope session) :**
- Créer un fichier `playwright/.auth/` par rôle (patient déjà fait, ajouter pharmacie/admin/médecin)
- Modifier `playwright.config.js` pour dépendre de ces setups multi-rôles
- OU augmenter `strictLimiter` max à 20 en mode test (via env var `NODE_ENV=test`)

---

## BLOCAGE 2 — marketplace tests 2-7 (endpoints admin-only + solde insuffisant)

**Fichier :** `tests/e2e/marketplace.spec.js`

**Tests bloqués :** 2, 3, 4, 5, 6, 7

**Erreurs :**
- `/zora/award` : endpoint admin-only → 403 avec token patient (tests 2, 4, 5, 6, 7)
- `/zora/reset` : endpoint admin-only → 403 avec token patient (test 3)
- `/zora/redeem` : balance patient = 50 points, récompense = 300 points → `insufficient_balance`

**Pourquoi non fixable ici :**
- Ces tests supposent que le patient peut s'auto-attribuer des points → conception incorrecte
- Les endpoints `/zora/award` et `/zora/reset` sont intentionnellement admin-only (sécurité)
- Solde réel patient `+242069735418` = 50 points (confirmé SQL)

**Solution proposée :**
- Utiliser un token admin pour `/zora/award` dans les tests (nécessite auth admin stocké)
- OU créer un endpoint dédié test (`/zora/test/seed-balance`) accessible uniquement en `NODE_ENV=test`
- OU créer directement des lignes en `zora_ledger` via pool.query dans beforeAll

---

## BLOCAGE 3 — games tests 5 et 6 (quiz backend 500)

**Fichier :** `tests/e2e/games.spec.js`

**Tests bloqués :** 5 (Quiz complet), 6 (Correct_answer jamais exposée)

**Erreur probable :** HTTP 500 sur `POST /zora/games/play` avec `game_type: 'quiz'`

**Cause probable :**
- Pas de questions de quiz en base (`zora_quiz_questions` table vide)
- OU bug dans `zora.service.js` pour le type 'quiz' (case non géré correctement)

**Pourquoi non fixable ici :**
- Nécessite soit d'insérer des questions de quiz en base, soit de déboguer le service quiz
- Non bloquant pour la production (les autres jeux scratch/wheel/chest fonctionnent)

**Solution proposée :**
- Vérifier `SELECT COUNT(*) FROM zora_quiz_questions`
- Si vide : insérer des questions de test via migration
- Si bug service : déboguer `zora.service.js` type='quiz'

---

## BLOCAGE 4 — Mots de passe incorrects (médecin et admin)

**Fichiers :** `tests/e2e/04-flux-prescription.spec.js`, `tests/e2e/events.spec.js`, `tests/e2e/critical-flows.spec.js`

**Comptes bloqués :**
- Médecin `+242060000001` / `bolamu2026` → **401** (mauvais mot de passe)
- Admin `+242060000099` / `bolamu2026` → **statut inconnu** (mot de passe pas confirmé)

**Impact :**
- 04-prescription : échec complet (medecin login fails en beforeAll → throw Error → tous les tests du fichier échouent)
- events tests 6, 7, 9, 10 : adminToken = null → 401 sur les routes admin
- critical-flows FLUX 3, 4, 5 : doctorToken et adminToken null

**Solution proposée :**
- Réinitialiser le mot de passe du compte médecin `+242060000001` en base :
  ```sql
  UPDATE users SET password_hash = crypt('bolamu2026', gen_salt('bf')) WHERE phone = '+242060000001';
  ```
- Confirmer ou définir le mot de passe admin `+242060000099`
- OU créer des comptes dédiés aux tests avec mots de passe connus

---

## BLOCAGE 5 — patient-dashboard.spec.js (tests UI browser)

**Fichier :** `tests/patient-dashboard.spec.js`

**Symptôme :** Locators qui ne trouvent pas les éléments (éléments cachés, timing)

**Cause probable :**
- Dashboard charge les données via API (fetch async) → éléments absents au moment de la recherche
- `storageState` injecte bien le token, mais les `data-testid` ne sont pas encore dans le DOM

**Pourquoi non fixable ici :**
- Nécessite d'ajouter des `page.waitForSelector()` ou `expect(locator).toBeVisible()` avec timeout
- OU ajouter des attributs `data-testid` manquants dans les pages HTML
- Travail de synchronisation UI non trivial sans accès à la page réelle

**Solution proposée :**
- Ajouter `await page.waitForLoadState('networkidle')` après navigation
- Wrapper chaque interaction avec `await expect(locator).toBeVisible({ timeout: 10000 })`
- Vérifier que les `data-testid` correspondent aux vrais IDs des éléments dans le HTML

---

## Récapitulatif

| Blocage | Fichier(s) | Tests | Effort fix |
|---------|-----------|-------|-----------|
| Rate limiter systémique | marketplace, critical-flows, events | 14+ | Moyen (refonte token management) |
| Endpoints admin-only (Zora) | marketplace tests 2-7 | 6 | Faible (seed balance en beforeAll) |
| Quiz backend 500 | games tests 5-6 | 2 | Faible (insérer questions en DB) |
| Mots de passe incorrects | 04-prescription, events, critical-flows | 10+ | Faible (reset passwords en DB) |
| Patient dashboard UI | patient-dashboard | 4+ | Moyen (waitFor + data-testid) |
