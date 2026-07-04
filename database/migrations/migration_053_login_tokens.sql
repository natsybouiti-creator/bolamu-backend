-- Migration 053: Magic link mot de passe oublié
-- Table des tokens de connexion à usage unique générés par forgot-password

CREATE TABLE IF NOT EXISTS login_tokens (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  token VARCHAR(64) NOT NULL UNIQUE,
  password_snapshot VARCHAR(255) NOT NULL,
  used_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_tokens_token ON login_tokens(token);
