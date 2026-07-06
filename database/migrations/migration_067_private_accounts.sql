-- Migration 067 : Compte privé/public + demandes de suivi
-- Date : 6 juillet 2026
-- Description : Ajoute is_private sur users et table follow_requests pour gérer les comptes privés

-- 1. Statut du compte
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- 2. Table des demandes de suivi (miroir de club_join_requests)
CREATE TABLE IF NOT EXISTS follow_requests (
  id SERIAL PRIMARY KEY,
  requester_phone VARCHAR(20) NOT NULL,
  target_phone VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE(requester_phone, target_phone)
);

CREATE INDEX IF NOT EXISTS idx_follow_requests_target
  ON follow_requests(target_phone, status);
CREATE INDEX IF NOT EXISTS idx_follow_requests_requester
  ON follow_requests(requester_phone, status);
