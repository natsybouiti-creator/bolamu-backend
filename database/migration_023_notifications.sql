-- ============================================================
-- BOLAMU — Migration 023 : Notifications Push + WhatsApp (Sprint 7)
-- ============================================================

-- Table push_subscriptions (Web Push API)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_type VARCHAR(20) DEFAULT 'web',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_phone, endpoint)
);

-- Table notifications (historique des notifications)
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'rdv_confirme','rdv_rappel','rdv_annule',
    'paiement_recu','abonnement_expire','abonnement_renouvele',
    'conflit_update','message_recu','alerte_systeme',
    'whatsapp_message'
  )),
  titre VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  canal VARCHAR(20) DEFAULT 'push' CHECK (canal IN 
    ('push','whatsapp','sms','email')),
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMP,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour optimiser les requêtes notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user 
  ON notifications(user_phone);
CREATE INDEX IF NOT EXISTS idx_notifications_read 
  ON notifications(user_phone, is_read);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user 
  ON push_subscriptions(user_phone);

-- Commentaires
COMMENT ON TABLE push_subscriptions IS 'Abonnements Web Push API pour notifications push';
COMMENT ON TABLE notifications IS 'Historique des notifications envoyées (push, WhatsApp, SMS, email)';
