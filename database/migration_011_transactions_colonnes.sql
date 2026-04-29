-- ============================================================
-- BOLAMU — Migration 011 : Colonnes transactions tiers payant
-- Date : 29 avril 2026
-- Objectif : Ajouter montant_total, montant_remise, montant_patient
-- ============================================================

-- Ajouter les colonnes pour le flux tiers payant
ALTER TABLE transactions_tiers_payant 
ADD COLUMN IF NOT EXISTS montant_total INTEGER NOT NULL DEFAULT 0;

ALTER TABLE transactions_tiers_payant 
ADD COLUMN IF NOT EXISTS montant_remise INTEGER NOT NULL DEFAULT 0;

ALTER TABLE transactions_tiers_payant 
ADD COLUMN IF NOT EXISTS montant_patient INTEGER NOT NULL DEFAULT 0;
