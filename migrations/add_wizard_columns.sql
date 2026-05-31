-- Migration : Ajouter les colonnes manquantes pour le wizard souscription agent
-- Exécuter ce fichier sur PostgreSQL si les colonnes n'existent pas déjà

-- Colonnes pour le wizard souscription complet
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS doc_type VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS doc_numero VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS niu VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS rib VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS cgu_accepted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
