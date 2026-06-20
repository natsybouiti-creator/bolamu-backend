-- ============================================================
-- BOLAMU — Sprint 2 : Moteur Zora Points + Ledger
-- ============================================================

-- Table zora_points : solde et palier par utilisateur
CREATE TABLE IF NOT EXISTS zora_points (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  balance INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  tier VARCHAR(20) NOT NULL DEFAULT 'kimia',
  last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(phone)
);

-- Table zora_ledger : historique complet des gains avec taxonomie de preuve
CREATE TABLE IF NOT EXISTS zora_ledger (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  points INTEGER NOT NULL,
  category VARCHAR(30) NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  proof_class VARCHAR(30) NOT NULL,
  proof_source VARCHAR(120),
  recording_method VARCHAR(30),
  proof_reference VARCHAR(255) NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  earned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- Index pour performances
CREATE INDEX idx_zora_ledger_phone ON zora_ledger (phone);
CREATE INDEX idx_zora_ledger_expires ON zora_ledger (expires_at);
CREATE INDEX idx_zora_ledger_proof ON zora_ledger (proof_class, proof_reference);

-- Index unique pour idempotence : un même justificatif ne crédite qu'UNE fois
CREATE UNIQUE INDEX uq_zora_ledger_credit ON zora_ledger 
  (action_type, proof_reference) WHERE points > 0;

-- Table zora_tiers_config : configuration des paliers
CREATE TABLE IF NOT EXISTS zora_tiers_config (
  id SERIAL PRIMARY KEY,
  tier_name VARCHAR(20) UNIQUE NOT NULL,
  label_fr VARCHAR(40) NOT NULL,
  min_points INTEGER NOT NULL,
  max_points INTEGER,
  color_token VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Table zora_earn_rules : règles de gain par action
CREATE TABLE IF NOT EXISTS zora_earn_rules (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(100) UNIQUE NOT NULL,
  label_fr VARCHAR(120) NOT NULL,
  category VARCHAR(30) NOT NULL,
  points INTEGER NOT NULL,
  required_proof_class VARCHAR(30) NOT NULL,
  daily_cap INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  phase VARCHAR(10) NOT NULL DEFAULT 'now'
);

-- Table zora_category_caps : plafonds par catégorie
CREATE TABLE IF NOT EXISTS zora_category_caps (
  id SERIAL PRIMARY KEY,
  category VARCHAR(30) UNIQUE NOT NULL,
  cap_percent INTEGER NOT NULL
);
