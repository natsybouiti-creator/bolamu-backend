-- Migration 054: Renommage tiers-payant → remise-partenaire
-- Décision produit : ce mécanisme n'est pas un tiers-payant réglementaire
-- (le patient paie toujours un reste à charge), c'est un barème de remise
-- partenaire conventionné. Renommage pour éliminer toute confusion
-- réglementaire. Jamais de DROP — RENAME uniquement, aucune perte de données.

ALTER TABLE IF EXISTS transactions_tiers_payant
  RENAME TO transactions_remise_partenaire;
