-- ============================================================
-- BOLAMU — Migration 009 : Correction ENUM partner_zone_type + colonne bolamu_share_fcfa
-- Date : 29 avril 2026
-- Objectif : Corriger l'incohérence ENUM vs platform_config et ajouter colonne manquante
-- ============================================================

-- 1. Renommer la valeur ENUM 'doctor' en 'clinique'
ALTER TYPE partner_zone_type RENAME VALUE 'doctor' TO 'clinique';

-- 2. Supprimer la colonne fee_per_adherent (redondante avec platform_config)
ALTER TABLE partner_zones DROP COLUMN IF EXISTS fee_per_adherent;

-- 3. Ajouter bolamu_share_fcfa dans transactions_tiers_payant si absente
ALTER TABLE transactions_tiers_payant 
ADD COLUMN IF NOT EXISTS bolamu_share_fcfa INTEGER NOT NULL DEFAULT 0;
