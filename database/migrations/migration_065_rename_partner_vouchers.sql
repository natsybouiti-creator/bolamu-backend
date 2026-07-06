-- Migration 065 — Renommage partner_vouchers → partner_bons_zora
-- Terminologie : 'voucher' remplacé par 'bon Zora' (décision produit, sprint dette technique)
-- Approche additive : nouvelle table, copie données, suppression ancienne

BEGIN;

-- 1. Créer la nouvelle table partner_bons_zora
CREATE TABLE IF NOT EXISTS partner_bons_zora (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  patient_phone VARCHAR(20) NOT NULL,
  program_id INTEGER NOT NULL,
  qr_payload JSONB,
  fcfa_value INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMP,
  partner_phone VARCHAR(20),
  FOREIGN KEY (patient_phone) REFERENCES users(phone),
  FOREIGN KEY (program_id) REFERENCES partner_programs(id)
);

-- 2. Copier les données de partner_vouchers vers partner_bons_zora
INSERT INTO partner_bons_zora (
  id, code, patient_phone, program_id, qr_payload, fcfa_value,
  status, expires_at, created_at, validated_at, partner_phone
)
SELECT
  id, code, patient_phone, program_id, qr_payload, fcfa_value,
  status, expires_at, created_at, validated_at, partner_phone
FROM partner_vouchers;

-- 3. Recréer les indexes sur la nouvelle table
CREATE INDEX IF NOT EXISTS idx_partner_bons_zora_patient ON partner_bons_zora(patient_phone);
CREATE INDEX IF NOT EXISTS idx_partner_bons_zora_code ON partner_bons_zora(code);
CREATE INDEX IF NOT EXISTS idx_partner_bons_zora_status ON partner_bons_zora(status, expires_at);

-- 4. Mettre à jour la table partner_validations pour référencer la nouvelle table
ALTER TABLE partner_validations
DROP CONSTRAINT IF EXISTS partner_validations_voucher_id_fkey,
ADD CONSTRAINT partner_validations_bon_id_fkey
FOREIGN KEY (voucher_id) REFERENCES partner_bons_zora(id);

-- 5. Supprimer l'ancienne table
DROP TABLE IF EXISTS partner_vouchers CASCADE;

COMMIT;
