-- Migration 015 : suppression colonne dupliquée traitement_en_cours
-- La colonne traitements_en_cours (avec 's') est la référence officielle
-- Aucune donnée à migrer (COUNT = 0 vérifié)
ALTER TABLE users DROP COLUMN IF EXISTS traitement_en_cours;
