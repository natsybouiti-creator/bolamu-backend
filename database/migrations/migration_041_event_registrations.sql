-- Sprint 7 : Système d'événements complet
-- Tables : event_registrations, event_checkin_log
-- ALTER TABLE elonga_events pour ajouter published_at, published_by et modifier status CHECK

-- Ajouter colonnes published_at et published_by à elonga_events
ALTER TABLE elonga_events
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS published_by VARCHAR(20) REFERENCES users(phone);

-- Modifier le CHECK constraint sur status (nécessite de recréer la contrainte)
-- PostgreSQL ne permet pas de modifier directement un CHECK constraint
-- On doit d'abord supprimer l'ancienne contrainte puis en créer une nouvelle
ALTER TABLE elonga_events
  DROP CONSTRAINT IF EXISTS elonga_events_status_check;

ALTER TABLE elonga_events
  ADD CONSTRAINT elonga_events_status_check
  CHECK (status IN ('draft', 'pending', 'published', 'cancelled'));

-- Table event_registrations
CREATE TABLE IF NOT EXISTS event_registrations (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES elonga_events(id) ON DELETE CASCADE,
  patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  session_code VARCHAR(20) UNIQUE NOT NULL,
  qr_token VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'checked_in', 'cancelled', 'no_show')),
  registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  checked_in_at TIMESTAMP,
  zora_credited INTEGER NOT NULL DEFAULT 0,
  notified_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(event_id, patient_phone)
);

-- Table event_checkin_log
CREATE TABLE IF NOT EXISTS event_checkin_log (
  id SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL REFERENCES event_registrations(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES elonga_events(id) ON DELETE CASCADE,
  patient_phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  animateur_phone VARCHAR(20) REFERENCES users(phone),
  checked_in_at TIMESTAMP NOT NULL DEFAULT NOW(),
  zora_credited INTEGER NOT NULL DEFAULT 0,
  scan_method VARCHAR(20) NOT NULL DEFAULT 'qr_scan'
    CHECK (scan_method IN ('qr_scan', 'code_manual'))
);

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations (event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_phone ON event_registrations (patient_phone);
CREATE INDEX IF NOT EXISTS idx_event_registrations_session ON event_registrations (session_code);
CREATE INDEX IF NOT EXISTS idx_event_registrations_qr_token ON event_registrations (qr_token);
CREATE INDEX IF NOT EXISTS idx_event_registrations_status ON event_registrations (status);

CREATE INDEX IF NOT EXISTS idx_event_checkin_log_registration ON event_checkin_log (registration_id);
CREATE INDEX IF NOT EXISTS idx_event_checkin_log_event ON event_checkin_log (event_id);
CREATE INDEX IF NOT EXISTS idx_event_checkin_log_patient ON event_checkin_log (patient_phone);
CREATE INDEX IF NOT EXISTS idx_event_checkin_log_animateur ON event_checkin_log (animateur_phone);
CREATE INDEX IF NOT EXISTS idx_event_checkin_log_date ON event_checkin_log (checked_in_at DESC);
