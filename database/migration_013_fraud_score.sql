-- ============================================================
-- BOLAMU — Migration 013 : Ajout colonne fraud_score
-- Date : 29 avril 2026
-- Objectif : Ajouter fraud_score pour l'index de performance
-- ============================================================

ALTER TABLE fraud_signals 
ADD COLUMN IF NOT EXISTS fraud_score INTEGER NOT NULL DEFAULT 0 CHECK (fraud_score >= 0 AND fraud_score <= 100);
