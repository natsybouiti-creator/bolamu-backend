-- ============================================================
-- Migration 090 : Création de la table follows (réseau social)
-- Description : Table manquante pour le système d'abonnements
--               utilisée par feed.controller.js, follows.controller.js,
--               stories.controller.js, reels.controller.js
-- ============================================================

CREATE TABLE IF NOT EXISTS follows (
  follower_phone  VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  following_phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_phone, following_phone),
  CHECK (follower_phone <> following_phone)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_phone);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_phone);
