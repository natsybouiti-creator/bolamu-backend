-- ============================================================
-- BOLAMU — Migration 098 : resource_type du fichier labo
-- Date : 25 juillet 2026
-- Objectif : stocker le vrai resource_type Cloudinary (image, raw,
--            video...) déterminé à l'upload, pour générer les URLs
--            signées de téléchargement avec le bon type.
-- ============================================================

ALTER TABLE lab_results
ADD COLUMN IF NOT EXISTS fichier_resource_type VARCHAR(20);

COMMENT ON COLUMN lab_results.fichier_resource_type IS 'Resource type Cloudinary du fichier upload (image, raw, video, ...)';
