# ESCALADE BLOC 1 — FONDATIONS

---

## BUG-S02-06 — dashboard patient vanilla ne charge pas sur prod

**Scénario :** S02  
**Étape :** ÉTAPE 1 — Vérifier statut abonnement

**Couche :** Frontend

**Erreur exacte :**
```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
waiting for navigation to "**/patient/dashboard.html" until "load"
  navigated to "https://www.bolamu.co/patient/dashboard.html"
  "domcontentloaded" event fired
```

**Fichiers concernés :**
- `public/patient/dashboard.html` (version vanilla)
- `public/login.html` (redirection vers dashboard)
- `tests/helpers/bolamu-helpers.js` (ligne 55 - waitForURL)

**Tentative 1 :** Test contre prod → Résultat : Timeout dashboard patient
**Tentative 2 :** Audit code dashboard vanilla → Résultat : Aucune erreur JS évidente dans le code
**Tentative 3 :** Vérification dépendances → Résultat : Leaflet, QRCode, Socket.io chargés

**Cause probable :**
Le dashboard patient vanilla (remplacé par commit d42fbec) ne charge pas correctement sur prod. Possibles causes :
- Erreur JavaScript runtime non visible dans le code source
- Problème de routing statique Render
- Conflit avec le chargement des dépendances externes

**Solution recommandée :**
1. Restaurer la version DCLogic backup (`dashboard-dclogic-backup.html`) temporairement
2. Tester si le DCLogic charge sur prod
3. Si DCLogic fonctionne → investiguer différences entre vanilla et DCLogic
4. Si DCLogic échoue aussi → problème Render routing (indépendant du code)

**Nécessite :** Frontend (investigation prod + rollback temporaire)

---

## BUG-S01-06 — verifier-adherent retourne patient: null

**Scénario :** S01  
**Étape :** 6

**Endpoint :** GET /agence/verifier-adherent?q=PHONE

**Erreur :** patient: null même si le patient existe en DB

**Cause probable :** la requête SQL ne cherche pas dans la bonne table ou avec le bon champ

**Nécessite :** correction backend agence.routes.js

---

## BUG-S02-01 — check-subscription mauvaise colonne SQL

**Scénario :** S02  
**Étape :** ÉTAPE 1 — Vérifier statut abonnement

**Fichier :** `src/routes/patient.routes.js`  
**Ligne :** 83

**Erreur :** `WHERE phone = $1` → colonne inexistante dans table subscriptions

**Correction :** `WHERE patient_phone = $1`

**Cause :** La table subscriptions utilise la colonne `patient_phone`, pas `phone`

**Statut :** ✅ Corrigé - pushé

---

## BUG-S02-02 — window.__bolamu_test.selectionnerPlan manquant

**Scénario :** S02  
**Étape :** ÉTAPE 2 — Choisir plan essentiel

**Erreur exacte :**
```
TypeError: window.__bolamu_test.selectionnerPlan is not a function
```

**Fichiers concernés :**
- `public/patient/dashboard.html` (protocole window.__bolamu_test)
- `tests/e2e/s02-souscription-en-ligne.spec.js` (ligne 65 - appel selectionnerPlan)

**Cause :** Le dashboard patient n'a pas la fonction `selectionnerPlan` dans le protocole `window.__bolamu_test`

**Solution recommandée :**
1. Ajouter la fonction `selectionnerPlan` dans `window.__bolamu_test` du dashboard patient
2. Ou modifier le spec S02 pour utiliser l'API directe au lieu du protocole

**Nécessite :** Frontend (ajout fonction dans protocole patient)

---

## BUG-S03-01 — Login patient échoue (même bug que S02)

**Scénario :** S03  
**Étape :** ÉTAPE 1 — Voir abonnement actuel

**Erreur exacte :**
```
TimeoutError: page.waitForFunction: Timeout 30000ms exceeded.
waiting for typeof window.__bolamu_test === 'object' && window.__bolamu_test !== null
```

**Fichiers concernés :**
- `public/patient/dashboard.html` (version vanilla)
- `tests/helpers/bolamu-helpers.js` (ligne 71 - waitForProtocol)
- `tests/e2e/s03-renouvellement-abonnement.spec.js` (ligne 38 - waitForDashboard)

**Tentative 1 :** Test contre prod → Résultat : "Target page, context or browser has been closed"
**Tentative 2 :** Documentation du bug → Résultat : Même cause que BUG-S02-06
**Tentative 3 :** Lien vers BUG-S02-06 → Résultat : Escalade groupée

**Cause probable :**
Même cause que BUG-S02-06 - le dashboard patient vanilla ne charge pas sur prod.

**Solution recommandée :**
Voir BUG-S02-06.

**Nécessite :** Frontend (investigation routing statique + correction)

---

## BUG-S26-01 — Login animateur échoue (page fermée)

**Scénario :** S26  
**Étape :** ÉTAPE 1 — Stats animateur

**Erreur exacte :**
```
"beforeAll" hook timeout of 30000ms exceeded.
Error: page.waitForFunction: Target page, context or browser has been closed
```

**Fichiers concernés :**
- `public/animateur/dashboard.html` (page dashboard animateur)
- `tests/helpers/bolamu-helpers.js` (ligne 61 - waitForProtocol)
- `tests/e2e/s26-animateur-gere-clubs.spec.js` (ligne 38 - waitForDashboard)

**Tentative 1 :** Test contre prod → Résultat : "Target page, context or browser has been closed"
**Tentative 2 :** Documentation du bug → Résultat : Même cause que BUG-S02-01

**Cause probable :**
Même cause que BUG-S02-01 - les pages HTML statiques ne sont pas accessibles sur www.bolamu.co.

**Solution recommandée :**
Voir BUG-S02-01.

**Nécessite :** Frontend (investigation routing statique + correction)

---

## Bugs escaladés : 6

- BUG-S01-06 — verifier-adherent ne trouve pas le patient existant
- BUG-S02-01 — check-subscription mauvaise colonne SQL ✅ Corrigé
- BUG-S02-02 — window.__bolamu_test.selectionnerPlan manquant
- BUG-S02-06 — dashboard patient vanilla ne charge pas sur prod
- BUG-S03-01 — Login patient échoue (même bug que S02)
- BUG-S26-01 — Login animateur échoue (page fermée)
