-- Migration 049: Boucle 5 - Réseau Partenaires Santé
-- Table clearing_transactions (dette Bolamu envers partenaires)

CREATE TABLE IF NOT EXISTS clearing_transactions (
  id SERIAL PRIMARY KEY,
  partner_phone VARCHAR(20) NOT NULL,
  partner_type VARCHAR(20) NOT NULL,
  reference_id INTEGER NOT NULL,
  reference_type VARCHAR(30) NOT NULL,
  amount_fcfa NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_fcfa > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  cleared_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_clearing_status CHECK (
    status IN ('pending','cleared','disputed','cancelled')
  ),
  CONSTRAINT chk_partner_type CHECK (
    partner_type IN ('pharmacie','laboratoire','partenaire')
  )
);
CREATE INDEX IF NOT EXISTS idx_clearing_partner
ON clearing_transactions(partner_phone, status);
