-- Migration 029 : colonnes établissement partenaires
-- Exécutée sur Neon le 12 juin 2026
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS etablissement_nom VARCHAR(255),
ADD COLUMN IF NOT EXISTS etablissement_adresse TEXT,
ADD COLUMN IF NOT EXISTS etablissement_ville VARCHAR(100),
ADD COLUMN IF NOT EXISTS etablissement_lat DECIMAL(10,7),
ADD COLUMN IF NOT EXISTS etablissement_lng DECIMAL(10,7);
