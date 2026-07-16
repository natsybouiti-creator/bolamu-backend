# Carte Vaccination — Scoping technique

> Document de cadrage uniquement. Aucun code modifié, aucune migration exécutée.
> Constats basés sur l'état réel de la base (Neon) au 16 juillet 2026.

## Stockage DMN

- **Table** : `health_records` (extension de `record_type`)
- **Type de `record_type`** : `character varying` (varchar libre), **pas un enum PostgreSQL** — confirmé via `information_schema.columns` et `pg_enum` (aucune entrée trouvée pour ce type). Seule valeur actuellement en usage en base : `'consultation'`.
- **Migration requise** : **non**. Ajouter `record_type = 'vaccination'` ne nécessite aucun `ALTER TYPE`, aucune contrainte à modifier — c'est une simple valeur de chaîne insérée par l'application, comme `'consultation'` aujourd'hui.
- **Champs minimaux proposés** (à stocker dans `content` JSONB, déjà `NOT NULL`) :
  - `vaccin` (nom du vaccin, ex. "Fièvre jaune")
  - `date_administration`
  - `dose` / `numero_dose`
  - `lot_number` (numéro de lot, traçabilité)
  - `etablissement` ou `professionnel_id` (qui a administré)
- **Champ existant réutilisable pour métadonnées** : `content` (JSONB, `NOT NULL`) — déjà conçu pour ce cas d'usage, aucune nouvelle colonne nécessaire.

## Qui peut enregistrer

- **Rôles actuellement autorisés à écrire dans `health_records`** : **`doctor` uniquement**, confirmé dans `healthRecords.routes.js:8-11` :
  ```js
  // Rôles : doctor uniquement (TC-033 : pharmacie/laboratoire interdits)
  router.post('/', authMiddleware, bhpAccessMiddleware(['doctor']), ...)
  ```
- **Contrainte absolue existante (CLAUDE.md)** : *"Pharmacie JAMAIS accès dossier médical (TC-033)"*. Cette règle est déjà appliquée à `health_records` — **un vaccin administré en pharmacie ne pourrait pas être écrit directement dans cette table par un compte pharmacie sans violer TC-033**. Point ouvert ci-dessous.
- **Middleware BHP à appliquer** : `bhpAccessMiddleware(['doctor'])`, identique à la route existante.
- **Route** : la route `POST /api/v1/health-records` existe déjà et fonctionne génériquement (accepte n'importe quel `record_type`) — **aucune nouvelle route nécessaire**, juste envoyer `record_type: 'vaccination'` avec le `content` approprié.

## Déclenchement crédit Zora

- **Règle existante** : `action_type='vaccination'`, id **4** en base (`zora_earn_rules`), 100 pts, catégorie `sante`, `required_proof_class='ground_truth'`, pas de plafond journalier, active — mais **jamais déclenchée par aucun code actuellement** (confirmé lors de l'audit précédent).
- **`proof_reference` proposé** : `health_records.id` (l'id du record fraîchement inséré) — cohérent avec le pattern d'idempotence Zora (`action_type` + `proof_reference` uniques), garantit qu'un même acte vaccinal ne peut créditer qu'une fois.
- **`proof_source` proposé** : `'doctor'` uniquement, pour rester cohérent avec la seule écriture autorisée dans `health_records` aujourd'hui (voir TC-033 ci-dessus).
- **Point de déclenchement** : appel **explicite** à `awardZora()` dans le contrôleur, juste après l'`INSERT INTO health_records` réussi (même pattern que les autres actions `sante` déjà en place) — **pas de trigger SQL**, cohérent avec l'architecture actuelle où `awardZora()` est le point d'entrée unique documenté dans `zora.service.js`.

## Carte "Gagner > Santé"

- **Comportement côté patient** : vitrine uniquement — lecture seule des données DMN, **jamais point d'écriture**, cohérent avec le pattern déjà en place pour `consultation`/`analyse_labo`/`bilan_annuel`.
- **Affichage proposé** : dernière vaccination enregistrée (nom du vaccin + date) tirée de `health_records` (filtrée `record_type='vaccination'`, `consent_granted=true`), + statut du crédit Zora associé (déjà crédité / en attente si le professionnel n'a pas encore validé).

## Risques / points ouverts (à trancher avant tout code)

1. **Vaccins administrés en pharmacie** : TC-033 interdit à la pharmacie tout accès à `health_records`. Si Bolamu veut créditer des vaccins administrés en officine, il faudra soit (a) faire valider l'acte a posteriori par un médecin référent, soit (b) créer un mécanisme d'attestation dédié hors `health_records` (hors périmètre de ce scoping) — **décision produit à prendre, pas technique**.
2. **`patient_id`/`source_user_id` sont des entiers**, pas des `phone` — `health_records` ne suit pas la convention "phone comme identifiant universel" du reste du backend. C'est déjà le cas pour `consultation` aujourd'hui (pas une régression introduite par la vaccination), mais à garder en tête si un jour cette table est refactorée.
3. Aucune contrainte d'unicité en base n'empêche d'insérer deux fois le même acte vaccinal (le seul garde-fou serait l'idempotence Zora côté `proof_reference`, pas une contrainte SQL sur `health_records` elle-même) — à évaluer si c'est suffisant ou si un index unique applicatif est souhaitable plus tard.
