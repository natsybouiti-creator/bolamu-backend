-- ============================================================
-- BOLAMU — Boucle 2 : Tables Clubs (manquantes)
-- ============================================================

-- Table des clubs
CREATE TABLE IF NOT EXISTS clubs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sport VARCHAR(50),
  created_by VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table des membres des clubs (existe déjà avec patient_phone)
-- La colonne phone a été renommée en patient_phone dans une version précédente
-- On s'assure que la table existe avec la bonne structure

-- Index pour performance (sur patient_phone qui existe déjà)
CREATE INDEX IF NOT EXISTS idx_club_members_club 
ON club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_patient_phone 
ON club_members(patient_phone);
