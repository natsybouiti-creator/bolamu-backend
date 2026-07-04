-- Migration 056: Tracking agent_bolamu sur inscriptions patients et partenaires
-- Additive uniquement — aucune colonne existante modifiée ni supprimée.

ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_phone VARCHAR;
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS agent_phone VARCHAR;
ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS agent_phone VARCHAR;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS agent_phone VARCHAR;

CREATE INDEX IF NOT EXISTS idx_users_agent_phone ON users(agent_phone) WHERE agent_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pharmacies_agent_phone ON pharmacies(agent_phone) WHERE agent_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_laboratories_agent_phone ON laboratories(agent_phone) WHERE agent_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doctors_agent_phone ON doctors(agent_phone) WHERE agent_phone IS NOT NULL;
