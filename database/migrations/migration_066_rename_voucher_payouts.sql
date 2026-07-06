-- Migration 066 — Renommage voucher_payouts → bon_zora_reglements
-- Terminologie : 'voucher' remplacé par 'bon Zora' (décision produit, sprint dette technique)
-- Renommage colonne voucher_uuid → bon_uuid
-- Approche additive : nouvelle table, copie données, suppression ancienne
-- Basé sur le schéma réel de voucher_payouts sur Neon

BEGIN;

-- 1. Créer la nouvelle table bon_zora_reglements (schéma réel de voucher_payouts)
CREATE TABLE IF NOT EXISTS bon_zora_reglements (
  id SERIAL PRIMARY KEY,
  partner_phone VARCHAR(20) NOT NULL,
  partner_type VARCHAR(50) NOT NULL,
  bon_uuid UUID NOT NULL,
  amount_fcfa INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reference_virement VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (partner_phone) REFERENCES users(phone)
);

-- 2. Copier les données de voucher_payouts vers bon_zora_reglements
INSERT INTO bon_zora_reglements (
  id, partner_phone, partner_type, bon_uuid, amount_fcfa, status,
  reference_virement, created_at, paid_at
)
SELECT
  id, partner_phone, partner_type, voucher_uuid, amount_fcfa, status,
  reference_virement, created_at, paid_at
FROM voucher_payouts;

-- 3. Recréer les indexes sur la nouvelle table
CREATE INDEX IF NOT EXISTS idx_bon_zora_reglements_status ON bon_zora_reglements(status);
CREATE INDEX IF NOT EXISTS idx_bon_zora_reglements_partner_phone ON bon_zora_reglements(partner_phone);
CREATE INDEX IF NOT EXISTS idx_bon_zora_reglements_bon_uuid ON bon_zora_reglements(bon_uuid);

-- 4. Supprimer l'ancienne table
DROP TABLE IF EXISTS voucher_payouts CASCADE;

COMMIT;
