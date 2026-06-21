# Migrations Bolamu

## Convention de nommage

```
migration_NNN_description.sql
```

`NNN` = numéro séquentiel à 3 chiffres, incrémenté de 1 à chaque nouvelle migration.

**Prochaine migration : `migration_037_...sql`**

Le runner auto (`src/server.js`) exécute les fichiers de ce dossier dans l'ordre
alphabétique et enregistre chaque application dans `migrations_applied`.

## Historique des numéros

| Fichier | Statut |
|---------|--------|
| migration_001 → migration_027 | Appliquées avant la mise en place du tracking (exécutées manuellement) |
| migration_028 → migration_033 | Appliquées via runner auto |
| migration_034_leaderboard_streak.sql | Appliquée — **doublon de numéro** (voir note ci-dessous) |
| migration_034_sport_groups_chat.sql  | Appliquée — **doublon de numéro** (voir note ci-dessous) |
| migration_035_refresh_tokens.sql | Appliquée |
| migration_036_missing_indexes.sql | Appliquée |

> **Note doublon 034** : deux migrations ont reçu le numéro 034 par erreur.
> Le runner les traite correctement (tracking par `filename`, pas par numéro),
> mais pour éviter toute confusion future, la numérotation repart de 037.
> Ne pas réutiliser les numéros 034a/034b — laisser l'historique tel quel.

## Règles

- Toujours `CREATE TABLE IF NOT EXISTS` et `CREATE INDEX IF NOT EXISTS`
- Jamais de `DROP TABLE` ou `DROP COLUMN` sans validation explicite
- Un fichier = une feature / un périmètre fonctionnel
- Tester sur Neon dev avant de pousser en prod
