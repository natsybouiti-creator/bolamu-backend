-- Migration 072 : Ajoute une contrainte CHECK (balance >= 0) sur zora_points
-- Date : 10 juillet 2026
-- Description : Aucune contrainte au niveau base n'empêchait un solde Zora
--              négatif — seule une vérification applicative en amont
--              protégeait contre ça (ex. generateBonZora() dans
--              bon-zora.service.js). Un incident réel a déjà eu lieu
--              (migration_043_fix_zora_balance.sql, solde négatif corrigé
--              manuellement a posteriori). Vérifié avant application :
--              SELECT phone, balance FROM zora_points WHERE balance < 0
--              → 0 ligne, aucune violation actuelle des données.

ALTER TABLE zora_points ADD CONSTRAINT zora_points_balance_check
  CHECK (balance >= 0);
