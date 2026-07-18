-- Migration 092 — Colonnes préférences profil patient + table demandes de suppression
-- Vague 2/3 Partie 5 STUB 2 : câblage réel du menu profil patient (Notifications,
-- Confidentialité & données, Langue). Aucune de ces préférences n'existait en base.

ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_notif_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_notif_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) NOT NULL DEFAULT 'fr';

-- File d'attente des demandes de suppression de compte (BHP / droit à l'effacement).
-- Insert-only côté patient ; le traitement effectif (soft delete + anonymisation)
-- reste une action admin manuelle -- cohérent avec la règle "soft delete uniquement,
-- jamais de DELETE sur users" (CLAUDE.md /tech-lead).
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMP,
  processed_by VARCHAR(20)
);
