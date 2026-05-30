CREATE TABLE IF NOT EXISTS health_records (
  id                SERIAL PRIMARY KEY,
  patient_id        INTEGER NOT NULL REFERENCES users(id),
  record_type       VARCHAR(50) NOT NULL,
  -- Types : consultation | teleconsultation | ordonnance | 
  --         prescription_labo | resultat_labo | 
  --         constante_medicale | antecedent
  title             VARCHAR(255) NOT NULL,
  content           JSONB NOT NULL,
  source_role       VARCHAR(50) NOT NULL,
  source_user_id    INTEGER NOT NULL REFERENCES users(id),
  company_id        INTEGER REFERENCES companies(id),
  consent_granted   BOOLEAN NOT NULL DEFAULT false,
  consent_date      TIMESTAMPTZ,
  is_deleted        BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_patient     
  ON health_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_hr_type        
  ON health_records(record_type);
CREATE INDEX IF NOT EXISTS idx_hr_company     
  ON health_records(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_not_deleted 
  ON health_records(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_hr_company_type
  ON health_records(company_id, record_type) 
  WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_hr_patient_date
  ON health_records(patient_id, created_at DESC) 
  WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_hr_purge
  ON health_records(updated_at) WHERE is_deleted = true;
