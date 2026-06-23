-- ============================================================
-- BOLAMU — Sprint 2 : Wellness, Google Fit, Clubs
-- ============================================================
-- Chantier 1 : tables wellness_logs, wellness_rules,
-- google_fit_tokens, clubs, club_members, wellness_actions
-- + enregistrement des action_types wellness dans zora_earn_rules
--   (requis par awardZora() — voie de credit validee Option B)
-- ============================================================

-- ─── 1. wellness_logs ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wellness_logs (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(20) REFERENCES users(phone),
  source VARCHAR(20) CHECK (source IN ('google_fit','manual','bolamu')),
  metric VARCHAR(30) CHECK (metric IN ('steps','distance','calories','sleep_duration','heart_rate','activity')),
  value NUMERIC,
  unit VARCHAR(10),
  recorded_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wellness_logs_patient_recorded ON wellness_logs (patient_phone, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_wellness_logs_patient_metric ON wellness_logs (patient_phone, metric, recorded_at);

-- ─── 2. wellness_rules ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS wellness_rules (
  id SERIAL PRIMARY KEY,
  metric VARCHAR(30),
  operator VARCHAR(5) CHECK (operator IN ('gte','lte','eq')),
  threshold NUMERIC,
  zora_points INTEGER,
  label VARCHAR(100),
  max_per_day INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── 3. google_fit_tokens ────────────────────────────────────
CREATE TABLE IF NOT EXISTS google_fit_tokens (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(20) REFERENCES users(phone) UNIQUE,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMP,
  scope TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── 4. clubs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clubs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  description TEXT,
  category VARCHAR(50),
  animateur_phone VARCHAR(20) REFERENCES users(phone),
  max_members INTEGER DEFAULT 30,
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- ─── 5. club_members ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_members (
  id SERIAL PRIMARY KEY,
  club_id INTEGER REFERENCES clubs(id),
  patient_phone VARCHAR(20) REFERENCES users(phone),
  joined_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(club_id, patient_phone)
);

-- ─── 6. wellness_actions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS wellness_actions (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(20) REFERENCES users(phone),
  action_type VARCHAR(50) CHECK (action_type IN ('consultation','rdv_honore','evenement','atelier','dossier_update','labo_upload','quiz_complete','profil_complete')),
  zora_points INTEGER,
  validated_by VARCHAR(20),
  validated_at TIMESTAMP,
  reference_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wellness_actions_patient ON wellness_actions (patient_phone, created_at DESC);

-- ─── 7. Seed wellness_rules (regles initiales) ───────────────
INSERT INTO wellness_rules (metric, operator, threshold, zora_points, label, max_per_day) VALUES
  ('steps',          'gte', 8000, 15, '8 000 pas',                    1),
  ('steps',          'gte', 5000, 8,  '5 000 pas',                    1),
  ('sleep_duration', 'gte', 420,  10, '7h de sommeil',                1),
  ('activity',       'gte', 30,   12, '30 min d''activite',           1),
  ('heart_rate',     NULL,  NULL, 5,  'Frequence cardiaque',          1),
  ('consultation',   NULL,  NULL, 100,'Consultation medicale',        1),
  ('rdv_honore',     NULL,  NULL, 25, 'RDV honore',                   1),
  ('evenement',      NULL,  NULL, 50, 'Evenement sante',              1),
  ('atelier',        NULL,  NULL, 40, 'Atelier sante',                1),
  ('dossier_update', NULL,  NULL, 30, 'Dossier medical mis a jour',   1),
  ('profil_complete',NULL,  NULL, 50, 'Profil complete',              1);

-- ─── 8. zora_earn_rules — action_types wellness (Option B) ───
-- Necessaire : awardZora() lit points + required_proof_class ici.
-- ON CONFLICT DO NOTHING : ne jamais ecraser une regle existante
-- (consultation deja seedee a 50 pts / system_event — non modifiee ici).
INSERT INTO zora_earn_rules
  (action_type, label_fr, category, points, required_proof_class, daily_cap, is_active, phase) VALUES
  ('steps_8000',     '8 000 pas',                  'activite',   15, 'device_measured', 1,    TRUE, 'now'),
  ('steps_5000',     '5 000 pas',                  'activite',   8,  'device_measured', 1,    TRUE, 'now'),
  ('sleep_7h',       '7h de sommeil',              'activite',   10, 'device_measured', 1,    TRUE, 'now'),
  ('activity_30',    '30 min d''activite',         'activite',   12, 'device_measured', 1,    TRUE, 'now'),
  ('heart_rate',     'Frequence cardiaque',        'activite',   5,  'device_measured', 1,    TRUE, 'now'),
  ('rdv_honore',     'RDV honore',                 'sante',      25, 'system_event',    NULL, TRUE, 'now'),
  ('evenement',      'Evenement sante',            'activite',   50, 'ground_truth',    NULL, TRUE, 'now'),
  ('atelier',        'Atelier sante',              'activite',   40, 'ground_truth',    NULL, TRUE, 'now'),
  ('dossier_update', 'Dossier medical mis a jour', 'sante',      30, 'system_event',    1,    TRUE, 'now'),
  ('profil_complete','Profil complete',            'engagement', 50, 'system_event',    1,    TRUE, 'now')
ON CONFLICT (action_type) DO NOTHING;
