-- ============================================================
-- BOLAMU — Migration 012 : Nettoyage transactions_tiers_payant
-- Date : 29 avril 2026
-- Objectif : Conformité modèle Health Streaming (traçabilité pure)
-- ============================================================

-- 1. Renommer les anciennes colonnes pour aligner avec le contrôleur
ALTER TABLE transactions_tiers_payant 
RENAME COLUMN total_amount_fcfa TO montant_total_old;

ALTER TABLE transactions_tiers_payant 
RENAME COLUMN patient_share_fcfa TO montant_patient_old;

-- 2. Migrer les données existantes vers les nouvelles colonnes
UPDATE transactions_tiers_payant 
SET montant_total = COALESCE(montant_total_old, 0),
    montant_patient = COALESCE(montant_patient_old, 0)
WHERE montant_total = 0;

-- 3. Supprimer les colonnes dupliquées et hors modèle
ALTER TABLE transactions_tiers_payant 
DROP COLUMN IF EXISTS montant_total_old,
DROP COLUMN IF EXISTS montant_patient_old,
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS source_account_id,
DROP COLUMN IF EXISTS source_account_type,
DROP COLUMN IF EXISTS source_account_reference,
DROP COLUMN IF EXISTS destination_account_id,
DROP COLUMN IF EXISTS destination_account_type,
DROP COLUMN IF EXISTS destination_account_reference,
DROP COLUMN IF EXISTS paid_at,
DROP COLUMN IF EXISTS audit_ref;
