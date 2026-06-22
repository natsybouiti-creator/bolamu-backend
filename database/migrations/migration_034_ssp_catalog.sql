-- ============================================================
-- BOLAMU — Migration 034 : Référentiel SSP Catalog
-- Table servant de référentiel pour les médicaments et actes du catalogue SSP
-- Smart Flow : SSP gratuit couvert CDR, hors catalogue prix plein
-- ============================================================

-- Création de la table ssp_catalog
CREATE TABLE IF NOT EXISTS ssp_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(255) NOT NULL,
  categorie VARCHAR(100),
  type VARCHAR(50),
  est_ssp BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les recherches par nom (ILIKE)
CREATE INDEX IF NOT EXISTS idx_ssp_catalog_nom ON ssp_catalog(nom);
CREATE INDEX IF NOT EXISTS idx_ssp_catalog_est_ssp ON ssp_catalog(est_ssp);
CREATE INDEX IF NOT EXISTS idx_ssp_catalog_categorie ON ssp_catalog(categorie);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_ssp_catalog_updated_at()
RETURNS TRIGGER AS '
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
' LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ssp_catalog_updated_at
BEFORE UPDATE ON ssp_catalog
FOR EACH ROW
EXECUTE FUNCTION update_ssp_catalog_updated_at();

-- Commentaire sur la table
COMMENT ON TABLE ssp_catalog IS 'Référentiel des médicaments et actes SSP (Soins de Santé Primaires) - Smart Flow';
COMMENT ON COLUMN ssp_catalog.nom IS 'Nom de la prestation (médicament, examen, acte)';
COMMENT ON COLUMN ssp_catalog.categorie IS 'Catégorie (ex: médicament, laboratoire, imagerie, acte)';
COMMENT ON COLUMN ssp_catalog.type IS 'Type détaillé (ex: antibiotique, analyse sanguine, radio)';
COMMENT ON COLUMN ssp_catalog.est_ssp IS 'True = couvert CDR (gratuit), False = hors catalogue (prix plein)';
