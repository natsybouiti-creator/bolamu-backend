-- ============================================================
-- BOLAMU — Migration 024 : Secrétariat (Sprint 8)
-- ============================================================

CREATE TABLE IF NOT EXISTS secretary_assignments (
  id SERIAL PRIMARY KEY,
  secretary_phone VARCHAR(15) NOT NULL REFERENCES users(phone),
  partner_type VARCHAR(20) NOT NULL CHECK (partner_type IN ('clinique','laboratoire','cms','agence_bolamu')),
  partner_id INT,
  zone VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda_blocks (
  id SERIAL PRIMARY KEY,
  doctor_id INT NOT NULL REFERENCES doctors(id),
  block_date DATE NOT NULL,
  block_start TIME NOT NULL,
  block_end TIME NOT NULL,
  reason VARCHAR(100),
  created_by VARCHAR(15),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queue_entries (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(15) NOT NULL REFERENCES users(phone),
  doctor_id INT NOT NULL REFERENCES doctors(id),
  queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','in_consultation','completed','absent')),
  arrived_at TIMESTAMP,
  in_consultation_at TIMESTAMP,
  completed_at TIMESTAMP,
  notes VARCHAR(200)
);

CREATE INDEX IF NOT EXISTS idx_queue_date ON queue_entries(doctor_id, queue_date);
CREATE INDEX IF NOT EXISTS idx_secretary_assignments_phone ON secretary_assignments(secretary_phone);

-- Commentaires
COMMENT ON TABLE secretary_assignments IS 'Assignations des secrétaires aux partenaires';
COMMENT ON TABLE agenda_blocks IS 'Blocs agenda (disponibilités, pauses, congés) pour médecins';
COMMENT ON TABLE queue_entries IS 'File d attente des patients pour consultations';
