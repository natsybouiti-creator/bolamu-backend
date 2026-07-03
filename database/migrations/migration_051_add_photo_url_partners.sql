-- Migration 051 : Ajouter photo_url aux tables partenaires et animateurs
-- Permet aux médecins, pharmacies, laboratoires et animateurs d'avoir une photo de profil

-- Ajouter photo_url à doctors
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Ajouter photo_url à pharmacies
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Ajouter photo_url à laboratories
ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Ajouter photo_url à animateurs
ALTER TABLE animateurs ADD COLUMN IF NOT EXISTS photo_url TEXT;
