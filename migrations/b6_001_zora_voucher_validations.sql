-- Migration B6-001: Table zora_voucher_validations
-- Séparée de partner_validations (FK vers partner_vouchers)
-- Pour traçabilité des validations de vouchers Zora

CREATE TABLE IF NOT EXISTS zora_voucher_validations (
  id SERIAL PRIMARY KEY,
  partner_phone VARCHAR(20) NOT NULL,
  voucher_code VARCHAR(36) NOT NULL,
  validated_at TIMESTAMPTZ DEFAULT NOW(),
  amount_fcfa NUMERIC(10,2),
  method VARCHAR(20) DEFAULT 'code_manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_zora_voucher_validations_partner_phone 
  ON zora_voucher_validations(partner_phone);
CREATE INDEX IF NOT EXISTS idx_zora_voucher_validations_voucher_code 
  ON zora_voucher_validations(voucher_code);
CREATE INDEX IF NOT EXISTS idx_zora_voucher_validations_validated_at 
  ON zora_voucher_validations(validated_at DESC);
