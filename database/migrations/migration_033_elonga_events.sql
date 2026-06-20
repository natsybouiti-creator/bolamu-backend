-- Sprint 5 : Événements Elonga + Check-in QR terrain
-- Tables : elonga_events, elonga_registrations, elonga_checkin_tokens

CREATE TABLE IF NOT EXISTS elonga_events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  description TEXT,
  pillar VARCHAR(30) NOT NULL,
  location_name VARCHAR(120) NOT NULL,
  location_address TEXT NOT NULL,
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  city VARCHAR(60) NOT NULL,
  cover_image_path VARCHAR(255),
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  max_participants INTEGER,
  zora_reward INTEGER NOT NULL DEFAULT 50,
  proof_class VARCHAR(30) NOT NULL DEFAULT 'ground_truth',
  status VARCHAR(20) NOT NULL DEFAULT 'published',
  organizer_phone VARCHAR(20) REFERENCES users(phone),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS elonga_registrations (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES elonga_events(id),
  phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'registered',
  checkin_at TIMESTAMP,
  checkin_by VARCHAR(20),
  zora_awarded BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(event_id, phone)
);

CREATE TABLE IF NOT EXISTS elonga_checkin_tokens (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES elonga_events(id),
  phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(token)
);

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_events_starts ON elonga_events (starts_at, status);
CREATE INDEX IF NOT EXISTS idx_events_city ON elonga_events (city, status);
CREATE INDEX IF NOT EXISTS idx_registrations_event ON elonga_registrations (event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_phone ON elonga_registrations (phone);
CREATE INDEX IF NOT EXISTS idx_checkin_tokens_token ON elonga_checkin_tokens (token);
