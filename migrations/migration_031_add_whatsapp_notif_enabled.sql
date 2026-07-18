-- Migration 031 : préférence de notification WhatsApp par utilisateur
-- Ajoutée pour permettre aux utilisateurs de désactiver les notifications
-- WhatsApp non critiques. Les templates critiques (mot de passe, code d'accès,
-- magic link, identifiant, alerte urgence) ne sont JAMAIS skippés
-- (whitelist CRITICAL_TEMPLATES dans src/services/whatsapp.service.js).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS whatsapp_notif_enabled BOOLEAN DEFAULT true;
