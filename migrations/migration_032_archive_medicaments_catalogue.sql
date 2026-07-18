-- Migration 032 : archivage de la table morte medicaments_catalogue
-- Décision (18 juillet 2026) : le code utilise exclusivement ssp_catalog
-- (migration_034 — 121 lignes, lookups isSSP/isSSPFreeText, routes ssp/smartflow).
-- medicaments_catalogue (54 lignes) n'est référencée par aucune requête SQL
-- (uniquement citée en commentaire dans smartflow.service.js).
-- On la renomme en _archive_ au lieu de la supprimer (réversible).

ALTER TABLE IF EXISTS medicaments_catalogue
  RENAME TO _archive_medicaments_catalogue;
