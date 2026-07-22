-- Migration 052 : Table dossier_access_requests pour gestion accès dossier médical patient
CREATE TABLE IF NOT EXISTS dossier_access_requests (
  id               SERIAL PRIMARY KEY,
  doctor_user_id   INTEGER NOT NULL REFERENCES users(id),
  patient_phone    VARCHAR(20) NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  requested_at     TIMESTAMPTZ DEFAULT NOW(),
  responded_at     TIMESTAMPTZ,
  UNIQUE(doctor_user_id, patient_phone)
);

CREATE INDEX IF NOT EXISTS idx_dar_patient ON dossier_access_requests(patient_phone);
CREATE INDEX IF NOT EXISTS idx_dar_doctor  ON dossier_access_requests(doctor_user_id);
