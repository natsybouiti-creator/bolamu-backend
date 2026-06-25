-- Migration 048: Boucle 4 - Parcours de Soins
-- Tables: rendez_vous, consultations, ordonnances, ordonnance_items, medical_records

-- rendez_vous (unifie appointment + agenda secrétaire)
CREATE TABLE IF NOT EXISTS rendez_vous (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(20) NOT NULL,
  doctor_phone VARCHAR(20) NOT NULL,
  secretaire_phone VARCHAR(20),
  scheduled_at TIMESTAMP NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  motif TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_rdv_status CHECK (
    status IN ('pending','confirmed','in_progress',
               'completed','cancelled','no_show')
  )
);
CREATE INDEX IF NOT EXISTS idx_rdv_doctor 
ON rendez_vous(doctor_phone, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_rdv_patient 
ON rendez_vous(patient_phone, scheduled_at);

-- consultations (enregistrement de la consultation)
CREATE TABLE IF NOT EXISTS consultations (
  id SERIAL PRIMARY KEY,
  rdv_id INTEGER REFERENCES rendez_vous(id),
  patient_phone VARCHAR(20) NOT NULL,
  doctor_phone VARCHAR(20) NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP,
  motif TEXT,
  anamnese TEXT,
  examen_clinique TEXT,
  diagnostic TEXT,
  notes_confidentielles TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_consultation_status CHECK (
    status IN ('open','completed','cancelled')
  )
);
CREATE INDEX IF NOT EXISTS idx_consultation_patient 
ON consultations(patient_phone, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultation_doctor 
ON consultations(doctor_phone, started_at DESC);

-- ordonnances
CREATE TABLE IF NOT EXISTS ordonnances (
  id SERIAL PRIMARY KEY,
  consultation_id INTEGER NOT NULL 
    REFERENCES consultations(id) ON DELETE CASCADE,
  patient_phone VARCHAR(20) NOT NULL,
  doctor_phone VARCHAR(20) NOT NULL,
  issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  encrypted_content TEXT,
  CONSTRAINT chk_ordonnance_status CHECK (
    status IN ('active','dispensed','expired','cancelled')
  )
);

-- ordonnance_items (lignes de l'ordonnance)
CREATE TABLE IF NOT EXISTS ordonnance_items (
  id SERIAL PRIMARY KEY,
  ordonnance_id INTEGER NOT NULL 
    REFERENCES ordonnances(id) ON DELETE CASCADE,
  medicament VARCHAR(200) NOT NULL,
  dosage VARCHAR(100),
  frequence VARCHAR(100),
  duree VARCHAR(100),
  instructions TEXT,
  quantite INTEGER DEFAULT 1
);

-- medical_records (vue consolidée dossier patient)
CREATE TABLE IF NOT EXISTS medical_records (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(20) NOT NULL UNIQUE,
  blood_type VARCHAR(5),
  allergies TEXT[],
  antecedents TEXT[],
  traitements_en_cours TEXT[],
  derniere_consultation_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_medical_records_phone
ON medical_records(patient_phone);
