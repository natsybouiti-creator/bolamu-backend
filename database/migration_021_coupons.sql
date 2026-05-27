-- Migration 021 : Coupons + Prorata + Idempotence (Sprint 4)
-- Créée le 20 mai 2026 pour NBA Gestion SARLU

-- Table coupons
CREATE TABLE coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('pourcentage','fixe')),
  valeur NUMERIC(10,2) NOT NULL CHECK (valeur > 0),
  quota_total INTEGER, -- NULL = illimité
  quota_utilise INTEGER DEFAULT 0,
  date_expiration TIMESTAMP,
  user_type_restriction VARCHAR(20) CHECK (user_type_restriction IN 
    ('patient','partner', NULL)),
  usage_unique_par_user BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR(20) REFERENCES users(phone),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table coupon_usages
CREATE TABLE coupon_usages (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES coupons(id),
  user_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  subscription_id INTEGER,
  montant_remise NUMERIC(10,2) NOT NULL,
  used_at TIMESTAMP DEFAULT NOW()
);

-- Table idempotency_keys
CREATE TABLE idempotency_keys (
  id SERIAL PRIMARY KEY,
  idempotency_key VARCHAR(100) UNIQUE NOT NULL,
  endpoint VARCHAR(100) NOT NULL,
  user_phone VARCHAR(20) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
);

-- Index
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupon_usages_user ON coupon_usages(user_phone);
CREATE INDEX idx_idempotency_key ON idempotency_keys(idempotency_key);

-- Commentaires
COMMENT ON TABLE coupons IS 'Coupons de réduction pour abonnements';
COMMENT ON TABLE coupon_usages IS 'Historique d\'utilisation des coupons';
COMMENT ON TABLE idempotency_keys IS 'Clés d\'idempotence pour éviter les doubles paiements';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'Expiration de la clé (24h par défaut)';
