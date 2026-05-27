-- Migration 018 : Table time_slots pour les créneaux médecin
-- Créée le 20 mai 2026 pour TC-024

CREATE TABLE IF NOT EXISTS time_slots (
    id SERIAL PRIMARY KEY,
    doctor_phone VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    heure_debut TIME NOT NULL,
    heure_fin TIME NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_time_slots_doctor FOREIGN KEY (doctor_phone) REFERENCES doctors(phone) ON DELETE CASCADE,
    CONSTRAINT chk_time_slots_hours CHECK (heure_fin > heure_debut),
    CONSTRAINT uq_time_slots UNIQUE (doctor_phone, date, heure_debut)
);

CREATE INDEX IF NOT EXISTS idx_time_slots_doctor_date ON time_slots(doctor_phone, date);
CREATE INDEX IF NOT EXISTS idx_time_slots_available ON time_slots(is_available);

COMMENT ON TABLE time_slots IS 'Créneaux horaires disponibles pour les médecins';
