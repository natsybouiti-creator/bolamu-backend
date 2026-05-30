-- Table unifiée pour tous les documents de la plateforme
-- (remplace l'ancienne logique uploads fragmentée)
CREATE TABLE IF NOT EXISTS documents (
  id              SERIAL PRIMARY KEY,
  owner_id        INTEGER REFERENCES users(id),
  -- Propriétaire du document (patient, médecin, etc.)
  -- NULL pour les uploads pré-inscription (mis à jour après création compte)
  uploaded_by     VARCHAR(20) NOT NULL,
  -- Qui a uploadé : phone (pré-inscription) ou id (après création)
  document_type   VARCHAR(50) NOT NULL,
  -- Types : identite | diplome | autorisation |
  --         ordonnance_pdf | resultat_labo_pdf | autre
  filename        VARCHAR(255) NOT NULL,
  -- Nom du fichier sur le Persistent Disk
  original_name   VARCHAR(255),
  mimetype        VARCHAR(100),
  file_size       INTEGER,
  storage_path    VARCHAR(500) NOT NULL,
  -- Chemin complet sur /var/data/uploads/
  is_verified     BOOLEAN DEFAULT false,
  -- Vérifié par admin (pour documents d'identité)
  verified_by     INTEGER REFERENCES users(id),
  verified_at     TIMESTAMPTZ,
  is_deleted      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_owner
  ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_docs_type
  ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_docs_active
  ON documents(is_deleted) WHERE is_deleted = false;
