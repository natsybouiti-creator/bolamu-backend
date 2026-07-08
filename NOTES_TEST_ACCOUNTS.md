# Notes — comptes de test (état connu, à lire avant réutilisation)

## +242099999999 (Test Zora, ID 62) — ledger décorrélé du solde

**Constaté le 7 juillet 2026** : `zora_points.balance` pour ce compte a été modifié directement
plusieurs fois via des scripts de test (`set-zora-balance` dans `scripts/verify_private_accounts.js`)
sans passer par `zora_ledger` (le point d'entrée normal, `awardZora()`/`generateBonZora()`,
maintient toujours `balance = SUM(zora_ledger.points)`).

Résultat : `SUM(zora_ledger.points)` pour ce compte ne correspond plus à `zora_points.balance`
affiché (écart constaté : somme ledger = -300, balance affichée = 50 à un instant donné).

**Ne pas utiliser ce compte pour un test qui vérifie l'intégrité `balance = SUM(ledger)`**
(ex. audit de cohérence du solde Zora, test de `recalculateBalance()`). Pour ce type de test,
utiliser un compte dont l'historique n'a jamais été modifié hors du flux normal (`awardZora`),
ou repartir d'un compte fraîchement seedé.

Le ledger lui-même n'a pas été touché (append-only respecté) — seule la colonne `balance` en
cache a été court-circuitée à plusieurs reprises pour accélérer des tests d'échange Zora.
