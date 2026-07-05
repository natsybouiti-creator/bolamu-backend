-- Migration 059 : branchement du catalogue SSP (ssp_catalog, migration_034)
-- sur le parcours de soins general (ordonnances, prescriptions, lab_prescriptions).
-- Chaque ligne recoit un flag is_ssp calcule UNE FOIS a la creation (lookup dans
-- ssp_catalog), jamais recalcule apres coup — jamais de DROP ni de perte de donnees.

ALTER TABLE ordonnance_items ADD COLUMN IF NOT EXISTS is_ssp BOOLEAN;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS is_ssp BOOLEAN;
ALTER TABLE lab_prescriptions ADD COLUMN IF NOT EXISTS is_ssp BOOLEAN;
