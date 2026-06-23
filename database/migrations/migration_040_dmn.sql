-- ============================================================
-- BOLAMU — DMN : Dossier Médical Numérique
-- document_downloads + dmn_access_log
-- ============================================================

-- ─── 1. document_downloads ───────────────────────────────────
-- Trace chaque tentative de téléchargement sécurisé de document.
-- document_id est nullable pour les logs de vérification de mot de passe
-- (avant de choisir un document).
CREATE TABLE IF NOT EXISTS document_downloads (
  id           SERIAL PRIMARY KEY,
  patient_phone VARCHAR(20) REFERENCES users(phone),
  document_id  INTEGER REFERENCES documents(id),
  requested_at TIMESTAMP DEFAULT NOW(),
  verified_at  TIMESTAMP,
  ip_address   VARCHAR(45),
  status       VARCHAR(20) CHECK (status IN ('pending','verified','denied'))
);

CREATE INDEX IF NOT EXISTS idx_document_downloads_patient
  ON document_downloads (patient_phone, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_downloads_doc
  ON document_downloads (document_id, status);

-- ─── 2. dmn_access_log ───────────────────────────────────────
-- Journal BHP de tout accès au dossier médical numérique.
-- accessor_phone NULL = accès anonyme (ex: scan QR par tiers non identifié).
CREATE TABLE IF NOT EXISTS dmn_access_log (
  id             SERIAL PRIMARY KEY,
  patient_phone  VARCHAR(20) REFERENCES users(phone),
  accessor_phone VARCHAR(20),
  access_type    VARCHAR(30) CHECK (access_type IN
                   ('qr_scan','download','consultation','update')),
  accessed_at    TIMESTAMP DEFAULT NOW(),
  ip_address     VARCHAR(45),
  details        JSONB
);

CREATE INDEX IF NOT EXISTS idx_dmn_access_log_patient
  ON dmn_access_log (patient_phone, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dmn_access_log_accessor
  ON dmn_access_log (accessor_phone, accessed_at DESC);
