-- Migration 052: Profil social des patients
-- Ajout de champs pour la page profil enrichie (Point 8)

ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS interets TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS statut_disponibilite VARCHAR(50);

-- Note: La colonne city existe déjà et sera réutilisée pour la ville
