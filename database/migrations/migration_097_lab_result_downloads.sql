-- ============================================================
-- BOLAMU — Migration 097 : traçabilité BHP des téléchargements labo
-- Date : 25 juillet 2026
-- Objectif : journaliser chaque téléchargement d'un fichier de
--            résultat de laboratoire, et étendre dmn_access_log
--            pour ce nouveau type d'accès.
-- ============================================================

-- ─── 1. lab_result_downloads ─────────────────────────────────
-- Trace BHP chaque tentative de téléchargement d'un fichier labo.
CREATE TABLE IF NOT EXISTS lab_result_downloads (
  id                SERIAL PRIMARY KEY,
  lab_result_id     INTEGER NOT NULL REFERENCES lab_results(id) ON DELETE CASCADE,
  patient_phone     VARCHAR(20) NOT NULL REFERENCES users(phone),
  accessed_by_phone VARCHAR(20) NOT NULL,
  accessed_by_role  VARCHAR(20) NOT NULL,
  ip_address        VARCHAR(45),
  status            VARCHAR(20) NOT NULL DEFAULT 'granted' CHECK (status IN ('pending','granted','denied')),
  downloaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_result_downloads_result
  ON lab_result_downloads (lab_result_id, downloaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_result_downloads_patient
  ON lab_result_downloads (patient_phone, downloaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_result_downloads_accessor
  ON lab_result_downloads (accessed_by_phone, downloaded_at DESC);

-- ─── 2. dmn_access_log : extension access_type ───────────────
-- Ajoute 'lab_result_download' aux types d'accès tracés BHP.
ALTER TABLE dmn_access_log
  DROP CONSTRAINT IF EXISTS dmn_access_log_access_type_check;

ALTER TABLE dmn_access_log
  ADD CONSTRAINT dmn_access_log_access_type_check
  CHECK (access_type IN (
    'qr_scan',
    'qr_scan_verified',
    'download',
    'consultation',
    'update',
    'lab_result_download'
  ));
