-- ============================================================
-- BOLAMU — Migration 027 : Symptômes pre-RDV (Sprint 9)
-- ============================================================

CREATE TABLE IF NOT EXISTS appointment_symptoms (
  id SERIAL PRIMARY KEY,
  appointment_id INT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  motif TEXT NOT NULL,
  symptomes JSONB DEFAULT '[]',
  duree_symptomes VARCHAR(50),
  intensite VARCHAR(20),
  traitements_en_cours TEXT,
  remarques_patient TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_symptoms_appointment ON appointment_symptoms(appointment_id);

-- Commentaires
COMMENT ON TABLE appointment_symptoms IS 'Symptômes déclarés par les patients avant RDV';
