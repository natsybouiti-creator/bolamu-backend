-- Migration 020 : Module Conflits (Sprint 3)
-- Créée le 20 mai 2026 pour NBA Gestion SARLU

-- Table conflicts
CREATE TABLE conflicts (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(20) UNIQUE NOT NULL, -- format : CONF-YYYYMMDD-XXXX
  patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  partner_phone VARCHAR(20) REFERENCES users(phone),
  partner_type VARCHAR(20) CHECK (partner_type IN 
    ('doctor','pharmacy','lab','clinic')),
  sujet VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  statut VARCHAR(30) NOT NULL DEFAULT 'created' CHECK (statut IN (
    'created','pending_review','assigned','investigating',
    'waiting_response','resolved','closed','rejected','archived'
  )),
  priorite VARCHAR(20) DEFAULT 'normale' CHECK (priorite IN 
    ('normale','haute','critique')),
  agent_phone VARCHAR(20) REFERENCES users(phone),
  resolution TEXT,
  escalade_sup_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP
);

-- Table conflict_messages
CREATE TABLE conflict_messages (
  id SERIAL PRIMARY KEY,
  conflict_id INTEGER NOT NULL REFERENCES conflicts(id),
  sender_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  sender_role VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  pieces_jointes JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table conflict_actions
CREATE TABLE conflict_actions (
  id SERIAL PRIMARY KEY,
  conflict_id INTEGER NOT NULL REFERENCES conflicts(id),
  action VARCHAR(50) NOT NULL,
  ancien_statut VARCHAR(30),
  nouveau_statut VARCHAR(30),
  acteur_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  acteur_role VARCHAR(20) NOT NULL,
  commentaire TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX idx_conflicts_patient ON conflicts(patient_phone);
CREATE INDEX idx_conflicts_statut ON conflicts(statut);
CREATE INDEX idx_conflicts_agent ON conflicts(agent_phone);
CREATE INDEX idx_conflict_messages_conflict ON conflict_messages(conflict_id);
CREATE INDEX idx_conflict_actions_conflict ON conflict_actions(conflict_id);

-- Commentaires
COMMENT ON TABLE conflicts IS 'Conflits entre patients et partenaires de santé';
COMMENT ON TABLE conflict_messages IS 'Messages échangés sur un conflit';
COMMENT ON TABLE conflict_actions IS 'Historique des actions sur un conflit';
COMMENT ON COLUMN conflicts.escalade_sup_admin IS 'Indique si le conflit a été escaladé au super admin';
