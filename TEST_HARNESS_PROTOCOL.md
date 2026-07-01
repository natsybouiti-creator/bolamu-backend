# BOLAMU — PROTOCOLE DU HARNAIS DE TEST
Mis à jour : 21 juin 2026
Statut : actif à partir de B2

## 0. Pourquoi ce document existe

Sur la campagne B1 (S01-S27), plusieurs bugs (BUG-009, BUG-010, S26) ont été
masqués parce que le même agent qui appliquait le correctif jugeait aussi si
le correctif avait marché — en langage naturel, sans preuve brute. Un agent
sous pression de "terminer" choisit toujours le chemin le plus court vers un
signal vert.

Le harnais corrige ça structurellement : plus aucun agent ne se vérifie
lui-même. La vérification passe par un script déterministe qui lit des
artefacts bruts (JSON, lignes SQL), jamais par une reformulation.

## 1. Les 4 rôles

| Rôle | Qui | Ce qu'il fait | Ce qu'il n'a PAS le droit de faire |
|---|---|---|---|
| **Acteur** | Cascade / Windsurf | Écrit le code, applique le fix, lance le test | Déclarer un scénario "validé" ; élargir une assertion sans diff validé ; utiliser `waitForTimeout` |
| **Vérificateur** | `verify_scenario.js` (script, pas un LLM) | Lit le JSON Playwright + interroge la DB en lecture seule + compare au contrat | Interpréter, arrondir, ou reformuler un résultat |
| **Arbitre** | Claude (moi) | Lit les verdicts JSON, classe les échecs (a/b/c), rédige la synthèse, décide de la suite | Faire confiance à un résumé texte de Cascade sans le verdict JSON correspondant |
| **Décideur** | Toi | Tranche les cas ambigus (c), valide les commits/push, arbitre les règles métier | — |

Règle absolue : **le vérificateur ne peut jamais être le même processus que
l'acteur**, et son verdict ne transite jamais par une paraphrase de Cascade.

## 2. Le contrat de scénario

Chaque scénario (S01, S02, ... S27, ...) doit avoir un fichier
`contracts/SXX_contract.json` qui définit, AVANT le test :
- les actions attendues côté frontend (sélecteurs, assertions exactes)
- les appels API attendus (endpoint, méthode, format de réponse `{success,data}`)
- les lignes DB attendues (requête SQL exacte + résultat attendu)
- les comptes de test utilisés et leur état avant/après

Voir `scenario_contract.example.json` (basé sur S26) pour le format exact.

Un scénario sans contrat écrit à l'avance ne peut pas être marqué "✅ VALIDÉ"
par le vérificateur — au mieux "⏳ non contractualisé".

## 3. La boucle (loop)

```
1. Cascade applique le fix (diff minimal, chirurgical)
2. Cascade lance : npx playwright test SXX.spec.js --reporter=json > artifacts/SXX_run.json
3. Le script run_harness_loop.sh appelle verify_scenario.js SXX
4. verify_scenario.js :
   a. lit artifacts/SXX_run.json (résultat brut Playwright)
   b. lit contracts/SXX_contract.json (ce qui était attendu)
   c. se connecte à Postgres en lecture seule et exécute les SELECT du contrat
   d. compare les 3 couches (frontend/backend/DB) au contrat
   e. écrit artifacts/SXX_verdict.json : { status: PASS | FAIL | AMBIGUOUS, layers: {...}, details: [...] }
5. Si PASS sur les 3 couches → scénario marqué validé, Cascade peut committer
6. Si FAIL → le verdict JSON contient la couche et la ligne exactes en échec ;
   Cascade reçoit ce verdict brut (pas de résumé) pour corriger
7. Si AMBIGUOUS (ex: règle métier pas définie dans le contrat) → remonté à toi
```

Rien n'est marqué "validé" sur la base d'un texte de Cascade disant "ça marche".

## 4. Classification des échecs (a/b/c)

Quand `verify_scenario.js` retourne FAIL, l'arbitre (Claude) classe :

- **(a) Bug réel confirmé** — le contrat était correct, le comportement observé
  ne correspond pas. → ticket BUG-0XX avec preuve brute jointe.
- **(b) Contrat obsolète** — le comportement observé est correct mais le
  contrat décrit une ancienne version du produit. → mise à jour du contrat,
  pas de fix de code.
- **(c) Ambigu / règle métier non tranchée** — ni le code ni le contrat ne
  permettent de trancher seuls. → remonté à toi, jamais résolu unilatéralement
  par Cascade.

## 5. Règles de cadrage pour Cascade (à ajouter à `.windsurfrules`)

Ajouter ce bloc en fin de fichier de règles existant :

```
## HARNESS — RÈGLES NON NÉGOCIABLES

- Tu n'as JAMAIS le droit de déclarer un scénario "validé", "affiché" ou
  "confirmé" sans coller le contenu brut du verdict JSON produit par
  verify_scenario.js. Une phrase comme "le test passe" sans le JSON joint
  est un manquement au protocole.
- Tu n'as JAMAIS le droit d'élargir une assertion de test (ex: passer d'un
  sélecteur précis à un sélecteur générique, ou d'un texte exact à un
  regex large) sans montrer le diff exact et attendre validation explicite.
- Interdiction absolue de waitForTimeout — utiliser des attentes conditionnelles
  (waitForSelector, waitForResponse, networkidle avec timeout explicite).
- Un script de test jetable (non commité, non versionné dans /tests) ne
  compte pas comme preuve. Seul un run passant par run_harness_loop.sh compte.
- Si un test échoue 2 fois de suite après ton fix, tu t'arrêtes et tu
  remontes le verdict JSON brut plutôt que de tenter un 3e fix à l'aveugle.
- Commits chirurgicaux uniquement : un commit = un bug ou une feature,
  jamais un commit "corrections diverses".
```

## 6. Prochaine étape technique

1. Créer le rôle Postgres en lecture seule dédié aux tests (`bolamu_test_ro`)
2. Créer `contracts/` avec un contrat par scénario déjà "validé" en B1 (pour
   re-tester rétroactivement les 8 scénarios sans détail 3-couches)
3. Brancher `verify_scenario.js` sur ce rôle DB
4. Premier scénario à repasser dans le harnais : **BUG-007** (abonnements
   multiples actifs), qui est le plus proche structurellement de BUG-010.
