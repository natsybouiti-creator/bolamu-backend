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

## Rendu de police via sharp/fontconfig — signal local Windows peu fiable

**Constaté le 8 juillet 2026** (Chantier 3, carte cadeau Zora) : le rendu de texte SVG via
sharp/librsvg/fontconfig (voir `render.yaml` FONTCONFIG_FILE, `assets/fonts/`) produit des
résultats incohérents et contradictoires sur cette machine de développement Windows — des tests
avec un même fichier de police, un même poids, une même structure SVG, donnent tantôt le bon
rendu (Plus Jakarta Sans), tantôt une police de repli (serif), y compris avec des dossiers de
police fraîchement créés et jamais utilisés auparavant. Cause non identifiée malgré une
investigation poussée (cache fontconfig, police système concurrente, structure CSS vs attribut
inline, métadonnées de police — toutes ces pistes écartées par des tests directs).

**Résultat validé de façon fiable uniquement en conditions réelles sur Render** (production,
confirmé visuellement par l'utilisateur à deux reprises). **Ne jamais se fier au rendu local
seul pour valider un changement de police/rendu SVG sur cette machine** — toujours redéployer
une route de test temporaire sur Render et valider visuellement là, comme pour le reste du
Chantier 3.
