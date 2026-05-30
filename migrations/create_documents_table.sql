-- Table pour stocker les métadonnées des documents uploadés
-- uploaded_by = numéro de téléphone (TEXT), SANS clé étrangère
-- car les documents sont uploadés AVANT la création du compte.
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  file_id VARCHAR(255) UNIQUE NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mimetype VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_public BOOLEAN DEFAULT FALSE
);

-- Correction pour les bases existantes
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_uploaded_by_fkey;
ALTER TABLE documents ALTER COLUMN uploaded_by TYPE TEXT;

-- Index pour la recherche par uploaded_by
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_file_id ON documents(file_id);
