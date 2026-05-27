-- ============================================================
-- BOLAMU — Migration 025 : Pré-RDV + AI Consult (Sprint 9)
-- ============================================================

-- Table pre_rdv_formulaires
CREATE TABLE IF NOT EXISTS pre_rdv_formulaires (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(id),
  patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  doctor_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  symptomes TEXT[] DEFAULT '{}',
  symptomes_libres TEXT,
  duree_symptomes VARCHAR(50),
  intensite INTEGER CHECK (intensite BETWEEN 1 AND 10),
  antecedents TEXT,
  medicaments_actuels TEXT,
  allergies TEXT,
  triage_couleur VARCHAR(10) DEFAULT 'vert' CHECK (triage_couleur IN 
    ('vert','orange','rouge')),
  triage_score INTEGER DEFAULT 0,
  triage_recommandation TEXT,
  ia_analyse TEXT,
  ia_questions_suggerees TEXT[],
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table ai_consult_sessions
CREATE TABLE IF NOT EXISTS ai_consult_sessions (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  session_type VARCHAR(20) DEFAULT 'symptomes' CHECK (session_type IN (
    'symptomes','suivi','information','renouvellement'
  )),
  messages JSONB DEFAULT '[]',
  triage_final VARCHAR(10),
  recommandation_finale TEXT,
  rdv_suggere BOOLEAN DEFAULT false,
  renouvellement_suggere BOOLEAN DEFAULT false,
  tokens_utilises INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table renouvellement_demandes
CREATE TABLE IF NOT EXISTS renouvellement_demandes (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  prescription_id INTEGER NOT NULL,
  session_id_amina INTEGER REFERENCES ai_consult_sessions(id),
  statut VARCHAR(20) DEFAULT 'en_attente' CHECK (statut IN (
    'en_attente','valide','refuse'
  )),
  motif_refus TEXT,
  doctor_phone VARCHAR(20) REFERENCES users(phone),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_pre_rdv_patient 
  ON pre_rdv_formulaires(patient_phone);
CREATE INDEX IF NOT EXISTS idx_pre_rdv_appointment 
  ON pre_rdv_formulaires(appointment_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_patient 
  ON ai_consult_sessions(patient_phone);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_date 
  ON ai_consult_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_renouvellement_patient 
  ON renouvellement_demandes(patient_phone);
CREATE INDEX IF NOT EXISTS idx_renouvellement_statut 
  ON renouvellement_demandes(statut);

-- Commentaires
COMMENT ON TABLE pre_rdv_formulaires IS 'Formulaires pré-RDV avec symptômes et triage';
COMMENT ON TABLE ai_consult_sessions IS 'Sessions IA Amina pour assistance patients';
COMMENT ON TABLE renouvellement_demandes IS 'Demandes de renouvellement d ordonnances';
