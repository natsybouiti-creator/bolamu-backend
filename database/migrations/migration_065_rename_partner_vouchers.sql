-- Migration 065 — Renommage partner_vouchers → partner_bons_zora
-- Terminologie : 'voucher' remplacé par 'bon Zora' (décision produit, sprint dette technique)
-- Approche additive : nouvelle table, copie données, suppression ancienne
-- Basé sur le schéma réel de partner_vouchers sur Neon

BEGIN;

-- 1. Créer la nouvelle table partner_bons_zora (schéma réel de partner_vouchers)
CREATE TABLE IF NOT EXISTS partner_bons_zora (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  patient_phone VARCHAR(20),
  partner_id INTEGER,
  zora_cost INTEGER NOT NULL,
  fcfa_value INTEGER,
  status VARCHAR(20),
  generated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  used_at TIMESTAMP,
  used_by VARCHAR(20),
  qr_payload TEXT,
  FOREIGN KEY (patient_phone) REFERENCES users(phone)
);

-- 2. Copier les données de partner_vouchers vers partner_bons_zora
INSERT INTO partner_bons_zora (
  id, code, patient_phone, partner_id, zora_cost, fcfa_value,
  status, generated_at, expires_at, used_at, used_by, qr_payload
)
SELECT
  id, code, patient_phone, partner_id, zora_cost, fcfa_value,
  status, generated_at, expires_at, used_at, used_by, qr_payload
FROM partner_vouchers;

-- 3. Recréer les indexes sur la nouvelle table
CREATE INDEX IF NOT EXISTS idx_partner_bons_zora_patient ON partner_bons_zora(patient_phone);
CREATE INDEX IF NOT EXISTS idx_partner_bons_zora_code ON partner_bons_zora(code);
CREATE INDEX IF NOT EXISTS idx_partner_bons_zora_status ON partner_bons_zora(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_partner_bons_zora_partner ON partner_bons_zora(partner_id);

-- 4. Mettre à jour la table partner_validations pour référencer la nouvelle table
ALTER TABLE partner_validations
DROP CONSTRAINT IF EXISTS partner_validations_voucher_id_fkey,
ADD CONSTRAINT partner_validations_bon_id_fkey
FOREIGN KEY (voucher_id) REFERENCES partner_bons_zora(id);

-- 5. Supprimer l'ancienne table
DROP TABLE IF EXISTS partner_vouchers CASCADE;

COMMIT;
