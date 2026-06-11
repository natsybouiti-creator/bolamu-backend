-- Migration 028 : Magic link onboarding (première connexion automatique)
-- Date : 12 juin 2026

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS onboarding_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS onboarding_token_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS first_login_done BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_onboarding_token 
  ON users(onboarding_token) WHERE onboarding_token IS NOT NULL;
