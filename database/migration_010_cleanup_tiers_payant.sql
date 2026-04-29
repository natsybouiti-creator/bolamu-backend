-- ============================================================
-- BOLAMU — Migration 010 : Nettoyage transactions_tiers_payant
-- Date : 29 avril 2026
-- Objectif : Supprimer bolamu_share_fcfa (erreur conceptuelle)
-- ============================================================

-- Supprimer la colonne bolamu_share_fcfa (erreur conceptuelle)
ALTER TABLE transactions_tiers_payant 
DROP COLUMN IF EXISTS bolamu_share_fcfa;
