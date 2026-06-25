-- Migration 045: Table whatsapp_sessions pour RemoteAuth
-- Permet de stocker les sessions WhatsApp dans PostgreSQL
-- pour une persistance entre les redémarrages du serveur

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  session TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour optimiser les requêtes de session
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_updated_at 
ON whatsapp_sessions(updated_at);
