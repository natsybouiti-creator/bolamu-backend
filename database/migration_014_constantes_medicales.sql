-- Migration 014 : constantes médicales patient dans users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS groupe_sanguin VARCHAR(5),
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS maladies_chroniques TEXT,
ADD COLUMN IF NOT EXISTS antecedents_medicaux TEXT,
ADD COLUMN IF NOT EXISTS traitements_en_cours TEXT,
ADD COLUMN IF NOT EXISTS poids DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS taille INTEGER,
ADD COLUMN IF NOT EXISTS contact_urgence_nom VARCHAR(100),
ADD COLUMN IF NOT EXISTS contact_urgence_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS contact_urgence_lien VARCHAR(50),
ADD COLUMN IF NOT EXISTS constantes_remplies_par VARCHAR(20) DEFAULT 'patient',
ADD COLUMN IF NOT EXISTS constantes_updated_at TIMESTAMPTZ;
