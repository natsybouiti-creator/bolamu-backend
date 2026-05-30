CREATE TABLE IF NOT EXISTS patient_consents (
  id              SERIAL PRIMARY KEY,
  patient_id      INTEGER NOT NULL REFERENCES users(id),
  consent_type    VARCHAR(50) NOT NULL,
  -- Types : ordonnances | prescriptions_labo | historique_medecin
  --         stats_employeur
  granted         BOOLEAN NOT NULL DEFAULT false,
  granted_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(patient_id, consent_type)
);
