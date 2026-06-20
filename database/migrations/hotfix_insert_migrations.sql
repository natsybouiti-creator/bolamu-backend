-- HOTFIX : Marquer les migrations Zora comme appliquées
-- Pour résoudre "relation already exists" au démarrage du serveur

INSERT INTO migrations_applied (filename, applied_at)
VALUES 
  ('migration_030_zora_points.sql', NOW()),
  ('migration_031_zora_marketplace.sql', NOW()),
  ('migration_032_zora_games.sql', NOW())
ON CONFLICT (filename) DO NOTHING;
