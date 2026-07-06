-- ============================================================
-- Migration 062 — Pipeline règlement vouchers partenaires récompenses
-- Les clearing_transactions de type 'partenaire' (vouchers Zora validés
-- par les partenaires récompenses) ne peuvent pas entrer dans le pipeline
-- CDR (partner_payouts.partner_type ENUM exclut 'partenaire').
-- Table dédiée voucher_payouts pour le règlement de ces vouchers.
-- ============================================================

CREATE TABLE IF NOT EXISTS voucher_payouts (
  id SERIAL PRIMARY KEY,
  partner_phone VARCHAR(20) NOT NULL,
  partner_type VARCHAR(50) NOT NULL,
  voucher_uuid UUID NOT NULL,
  amount_fcfa INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  reference_virement VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_voucher_payouts_status ON voucher_payouts(status);
CREATE INDEX IF NOT EXISTS idx_voucher_payouts_partner_phone ON voucher_payouts(partner_phone);
