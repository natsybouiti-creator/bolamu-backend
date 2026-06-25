-- Migration 046: Tables sociales pour le classement
-- Permet d'ajouter des encouragements et commentaires sur le leaderboard

CREATE TABLE IF NOT EXISTS leaderboard_encouragements (
  id SERIAL PRIMARY KEY,
  from_phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  target_phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leaderboard_comments (
  id SERIAL PRIMARY KEY,
  from_phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  target_phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  comment VARCHAR(140) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_leaderboard_encouragements_target 
ON leaderboard_encouragements(target_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_encouragements_from 
ON leaderboard_encouragements(from_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_comments_target 
ON leaderboard_comments(target_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_comments_from 
ON leaderboard_comments(from_phone, created_at DESC);
