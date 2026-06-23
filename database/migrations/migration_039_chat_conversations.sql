-- ============================================================
-- Sprint 3 : Tables Conversations Chat + WhatsApp Notifications
-- ============================================================

-- Table principale des conversations (patient_medecin, communauté, club)
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('patient_medecin', 'communaute', 'club')),
  club_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Une seule conversation communauté globale
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_communaute
  ON conversations(type)
  WHERE type = 'communaute';

-- Participants aux conversations
CREATE TABLE IF NOT EXISTS conversation_participants (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  participant_phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'medecin', 'animateur')),
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMP,
  UNIQUE(conversation_id, participant_phone)
);

-- Messages des conversations (distinct de chat_messages utilisé par les groupes sport)
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'document')),
  sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Journal des notifications WhatsApp pour traçabilité
CREATE TABLE IF NOT EXISTS whatsapp_notifications (
  id SERIAL PRIMARY KEY,
  recipient_phone VARCHAR(20) NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  template_params JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
  sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index performances
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type, is_active);
CREATE INDEX IF NOT EXISTS idx_conv_participants_phone ON conversation_participants(participant_phone);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifs_phone ON whatsapp_notifications(recipient_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifs_status ON whatsapp_notifications(status, created_at DESC);
