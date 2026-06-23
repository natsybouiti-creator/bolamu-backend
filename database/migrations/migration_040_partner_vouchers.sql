-- ============================================================
-- BOLAMU — Migration 040 : Vouchers partenaires (code BOL-XXXX)
-- Système parallèle au marketplace Zora (zora_vouchers reste intact)
-- ============================================================

-- 1. Programmes de fidélité proposés par les partenaires
CREATE TABLE IF NOT EXISTS partner_programs (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER,
  name VARCHAR(100),
  description TEXT,
  zora_cost INTEGER NOT NULL,
  fcfa_value INTEGER,
  category VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  stock INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Vouchers générés par les patients (code BOL-XXXX-XXXX)
CREATE TABLE IF NOT EXISTS partner_vouchers (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  patient_phone VARCHAR(20) REFERENCES users(phone),
  partner_id INTEGER,
  zora_cost INTEGER NOT NULL,
  fcfa_value INTEGER,
  status VARCHAR(20) CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  generated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  used_at TIMESTAMP,
  used_by VARCHAR(20),
  qr_payload TEXT
);

-- 3. Journal des validations partenaires
CREATE TABLE IF NOT EXISTS partner_validations (
  id SERIAL PRIMARY KEY,
  voucher_id INTEGER REFERENCES partner_vouchers(id),
  partner_phone VARCHAR(20),
  validated_at TIMESTAMP DEFAULT NOW(),
  method VARCHAR(20) CHECK (method IN ('qr_scan', 'code_manual'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_partner_vouchers_patient ON partner_vouchers (patient_phone);
CREATE INDEX IF NOT EXISTS idx_partner_vouchers_code ON partner_vouchers (code);
CREATE INDEX IF NOT EXISTS idx_partner_vouchers_status ON partner_vouchers (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_partner_programs_active ON partner_programs (is_active, category);
CREATE INDEX IF NOT EXISTS idx_partner_validations_voucher ON partner_validations (voucher_id);
CREATE INDEX IF NOT EXISTS idx_partner_validations_partner ON partner_validations (partner_phone);
