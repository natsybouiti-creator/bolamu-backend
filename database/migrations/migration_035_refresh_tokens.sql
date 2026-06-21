-- Migration 035 : Table refresh_tokens pour la rotation des tokens JWT
-- Corrige P0-DB-01 : la table était référencée dans auth.controller.js
-- mais n'avait jamais été créée en prod (migration_017 égarée hors du dossier migrations/)

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          SERIAL PRIMARY KEY,
    phone       VARCHAR(20) NOT NULL,
    token_hash  VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- UNIQUE sur token_hash : clé de recherche pour SELECT et UPDATE
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash
    ON refresh_tokens(token_hash);

-- UNIQUE sur phone : ON CONFLICT (phone) DO UPDATE dans auth.controller.js:135
ALTER TABLE refresh_tokens
    DROP CONSTRAINT IF EXISTS refresh_tokens_phone_unique;
ALTER TABLE refresh_tokens
    ADD CONSTRAINT refresh_tokens_phone_unique UNIQUE (phone);

-- Index pour le cleanup des tokens expirés
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
    ON refresh_tokens(expires_at);
