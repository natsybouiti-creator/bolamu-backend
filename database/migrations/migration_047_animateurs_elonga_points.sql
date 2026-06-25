-- Migration 047 : Tables animateurs et elonga_points pour Boucle 3
-- Auteur : Master Loop Bolamu
-- Date : 2026-06-25

-- Table animateurs (lien users → rôle animateur avec clubs assignés)
CREATE TABLE IF NOT EXISTS animateurs (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(100),
  specialite VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_animateurs_phone ON animateurs(phone);
CREATE INDEX IF NOT EXISTS idx_animateurs_active ON animateurs(is_active);

-- Table animateur_clubs (clubs assignés à un animateur)
CREATE TABLE IF NOT EXISTS animateur_clubs (
  id SERIAL PRIMARY KEY,
  animateur_phone VARCHAR(20) NOT NULL,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(animateur_phone, club_id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_animateur_clubs_phone ON animateur_clubs(animateur_phone);
CREATE INDEX IF NOT EXISTS idx_animateur_clubs_club ON animateur_clubs(club_id);

-- Table elonga_points (points Elonga distincts des Zora — preuve de participation réelle)
CREATE TABLE IF NOT EXISTS elonga_points (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  event_id INTEGER REFERENCES elonga_events(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  source VARCHAR(50) NOT NULL DEFAULT 'checkin',
  awarded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_elonga_points_phone ON elonga_points(phone);
CREATE INDEX IF NOT EXISTS idx_elonga_points_event ON elonga_points(event_id);
CREATE INDEX IF NOT EXISTS idx_elonga_points_awarded ON elonga_points(awarded_at);
