-- ============================================================
-- Sprint 6B : Groupes de sport + Chat communauté/médecins
-- ============================================================

-- Table des groupes de sport
CREATE TABLE IF NOT EXISTS sport_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  sport_type VARCHAR(30) NOT NULL,
  icon_name VARCHAR(50) NOT NULL,
  color_token VARCHAR(30) NOT NULL DEFAULT 'turquoise',
  description TEXT,
  city VARCHAR(60) NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  weekly_score INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table des membres des groupes de sport
CREATE TABLE IF NOT EXISTS sport_group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES sport_groups(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  weekly_contribution INTEGER NOT NULL DEFAULT 0,
  UNIQUE(group_id, phone)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_group_members ON sport_group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_member_groups ON sport_group_members (phone);

-- Table des messages de chat
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(30) NOT NULL,
  sender_phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR(20) NOT NULL DEFAULT 'text',
  achievement_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Table des réactions aux messages
CREATE TABLE IF NOT EXISTS chat_reactions (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  reaction VARCHAR(20) NOT NULL DEFAULT 'encourage',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, phone, reaction)
);

-- Index pour les performances chat
CREATE INDEX IF NOT EXISTS idx_chat_channel ON chat_messages (channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_reactions ON chat_reactions (message_id);
