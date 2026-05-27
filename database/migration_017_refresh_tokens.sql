-- Migration 017 : Table refresh_tokens pour la rotation des tokens JWT
-- Date : 20 mai 2026
-- Vulnérabilité corrigée : CVSS 8.5 - Tokens JWT sans expiration

-- Création de la table refresh_tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour optimiser les recherches par phone
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_phone ON refresh_tokens(phone);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_is_revoked ON refresh_tokens(is_revoked);

-- Contrainte pour éviter les doublons de refresh token par utilisateur
ALTER TABLE refresh_tokens
ADD CONSTRAINT refresh_tokens_phone_unique UNIQUE (phone);

-- Commentaire
COMMENT ON TABLE refresh_tokens IS 'Stocke les refresh tokens JWT pour la rotation des tokens (access token 15min, refresh token 7d)';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'Hash bcrypt du refresh token (jamais stocké en clair)';
COMMENT ON COLUMN refresh_tokens.is_revoked IS 'Soft delete du refresh token (jamais de DELETE)';
