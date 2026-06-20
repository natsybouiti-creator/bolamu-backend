-- ============================================================
-- BOLAMU — Sprint 3 : Marketplace MFR + Vouchers QR
-- ============================================================

-- Catalogue des partenaires MFR
CREATE TABLE IF NOT EXISTS zora_partners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(30) NOT NULL,
  -- sante | telecom | lifestyle | voyage | hotel
  logo_path VARCHAR(255),
  description TEXT,
  contact_email VARCHAR(120),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Catalogue des récompenses
CREATE TABLE IF NOT EXISTS zora_rewards (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES zora_partners(id),
  title VARCHAR(120) NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL,
  -- ce que l'adhérent dépense
  discount_value VARCHAR(50) NOT NULL,
  -- ex: "20%" ou "5000 FCFA" — financé par le partenaire
  discount_type VARCHAR(20) NOT NULL,
  -- percent | fixed_fcfa
  stock INTEGER,
  -- NULL = illimité
  valid_days INTEGER NOT NULL DEFAULT 2,
  -- durée de vie du voucher en jours (défaut 48h)
  min_tier VARCHAR(20) NOT NULL DEFAULT 'kimia',
  -- palier minimum requis
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Vouchers générés à l'échange
CREATE TABLE IF NOT EXISTS zora_vouchers (
  id SERIAL PRIMARY KEY,
  uuid UUID NOT NULL DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  reward_id INTEGER NOT NULL REFERENCES zora_rewards(id),
  partner_id INTEGER NOT NULL REFERENCES zora_partners(id),
  points_spent INTEGER NOT NULL,
  discount_value VARCHAR(50) NOT NULL,
  -- copie au moment de l'émission
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  -- active | consumed | expired
  issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  consumed_by VARCHAR(120),
  -- phone ou identifiant du partenaire qui a scanné
  UNIQUE(uuid)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vouchers_phone ON zora_vouchers (phone);
CREATE INDEX IF NOT EXISTS idx_vouchers_uuid ON zora_vouchers (uuid);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON zora_vouchers (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_rewards_partner ON zora_rewards (partner_id);
CREATE INDEX IF NOT EXISTS idx_rewards_active ON zora_rewards (is_active);
