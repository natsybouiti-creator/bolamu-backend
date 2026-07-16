-- Migration 083 : Carnet de vaccination — attestations pharmacie/laboratoire
-- Date : 17 juillet 2026
-- Description : TC-033 interdit à pharmacie/laboratoire tout accès à
--              health_records (doctor uniquement). Cette table dédiée porte
--              les vaccinations administrées hors cabinet médecin, sans
--              toucher à health_records ni à sa restriction d'accès. Le DMN
--              agrège les deux sources en lecture (health_records +
--              vaccination_attestations) pour reconstituer le carnet complet.
--              Un médecin continue d'écrire ses propres vaccinations
--              directement dans health_records (record_type='vaccination'),
--              inchangé.

CREATE TABLE IF NOT EXISTS vaccination_attestations (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(20) NOT NULL,
  professionnel_phone VARCHAR(20) NOT NULL,
  etablissement_type VARCHAR(20) NOT NULL CHECK (etablissement_type IN ('pharmacie', 'laboratoire')),
  vaccin_nom VARCHAR(255) NOT NULL,
  dose_numero INTEGER,
  date_administration DATE NOT NULL,
  lot_vaccin VARCHAR(100),
  prochain_rappel_prevu DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vaccination_attestations_patient_phone ON vaccination_attestations(patient_phone);
