-- ============================================================
-- BOLAMU — Migration 041 : Consentement visibilité solde Zora sur QR
-- Date : 2 juillet 2026
-- Objectif : Ajouter colonne pour consentement patient sur visibilité solde Zora lors du scan QR
-- ============================================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS zora_balance_visible_qr BOOLEAN DEFAULT false;
