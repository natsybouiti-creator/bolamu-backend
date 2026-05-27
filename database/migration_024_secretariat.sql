-- ============================================================
-- BOLAMU — Migration 024 : Secrétariat (Sprint 8)
-- ============================================================

-- Ajouter rôle secrétaire si non existant
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') THEN
        CREATE TYPE role_enum AS ENUM ('patient', 'doctor', 'pharmacy', 'laboratory', 'admin');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'secretaire' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'role_enum')) THEN
        ALTER TYPE role_enum ADD VALUE 'secretaire';
    END IF;
END $$;

-- Table secretaires
CREATE TABLE IF NOT EXISTS secretaires (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL REFERENCES users(phone),
  partenaire_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  partenaire_type VARCHAR(20) NOT NULL CHECK (partenaire_type IN 
    ('clinic','doctor')),
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table file_attente
CREATE TABLE IF NOT EXISTS file_attente (
  id SERIAL PRIMARY KEY,
  partenaire_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  doctor_phone VARCHAR(20) REFERENCES users(phone),
  motif VARCHAR(255),
  priorite VARCHAR(20) DEFAULT 'normale' CHECK (priorite IN 
    ('normale','urgente','critique')),
  statut VARCHAR(20) DEFAULT 'en_attente' CHECK (statut IN (
    'en_attente','en_consultation','termine','annule'
  )),
  numero_ordre INTEGER NOT NULL,
  heure_arrivee TIMESTAMP DEFAULT NOW(),
  heure_appel TIMESTAMP,
  heure_fin TIMESTAMP,
  notes TEXT,
  created_by VARCHAR(20) REFERENCES users(phone)
);

-- Table agenda_blocs
CREATE TABLE IF NOT EXISTS agenda_blocs (
  id SERIAL PRIMARY KEY,
  doctor_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  date DATE NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL,
  type VARCHAR(20) DEFAULT 'disponible' CHECK (type IN (
    'disponible','bloque','pause','conge'
  )),
  motif_blocage VARCHAR(255),
  created_by VARCHAR(20) REFERENCES users(phone),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_secretaires_partenaire 
  ON secretaires(partenaire_phone);
CREATE INDEX IF NOT EXISTS idx_file_attente_partenaire 
  ON file_attente(partenaire_phone, statut);
CREATE INDEX IF NOT EXISTS idx_file_attente_date 
  ON file_attente(heure_arrivee);
CREATE INDEX IF NOT EXISTS idx_agenda_blocs_doctor 
  ON agenda_blocs(doctor_phone, date);

-- Commentaires
COMMENT ON TABLE secretaires IS 'Secrétaires associés aux partenaires (cliniques, médecins)';
COMMENT ON TABLE file_attente IS 'File d attente des patients pour consultations';
COMMENT ON TABLE agenda_blocs IS 'Blocs agenda (disponibilités, pauses, congés) pour médecins';
