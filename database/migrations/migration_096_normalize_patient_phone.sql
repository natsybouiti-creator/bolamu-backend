-- ============================================================
-- Migration 096 : normalisation rétroactive de patient_phone
-- Tables concernées : appointments, consultations
-- Équivalent SQL de src/utils/phone.js :: normalizePhone()
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_phone(p TEXT)
RETURNS TEXT AS $$
DECLARE
  v TEXT := regexp_replace(trim(p), '[\s-]', '', 'g');
BEGIN
  -- déjà au format +2420XXXXXXXX
  IF v ~ '^\+2420\d{8}$' THEN
    RETURN v;
  END IF;

  -- +242XXXXXXXX (sans le 0 après +242)
  IF v ~ '^\+242[1-9]\d{8}$' THEN
    RETURN '+2420' || substring(v from 5);
  END IF;

  -- 2420XXXXXXXX (sans le +)
  IF v ~ '^2420\d{8}$' THEN
    RETURN '+242' || substring(v from 4);
  END IF;

  -- 242XXXXXXXX (sans + et sans 0)
  IF v ~ '^242[1-9]\d{8}$' THEN
    RETURN '+2420' || substring(v from 4);
  END IF;

  -- 0XXXXXXXX
  IF v ~ '^0\d{8}$' THEN
    RETURN '+242' || v;
  END IF;

  -- XXXXXXXX
  IF v ~ '^\d{8}$' THEN
    RETURN '+2420' || v;
  END IF;

  RETURN v;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Vérification : comptage avant normalisation
DO $$
DECLARE
  bad_appt INTEGER;
  bad_cons INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_appt
  FROM appointments
  WHERE normalize_phone(patient_phone) <> patient_phone;

  SELECT COUNT(*) INTO bad_cons
  FROM consultations
  WHERE normalize_phone(patient_phone) <> patient_phone;

  RAISE NOTICE 'patient_phone a normaliser - appointments: %, consultations: %', bad_appt, bad_cons;
END $$;

-- Normalisation rétroactive
UPDATE appointments
SET patient_phone = normalize_phone(patient_phone)
WHERE normalize_phone(patient_phone) <> patient_phone;

UPDATE consultations
SET patient_phone = normalize_phone(patient_phone)
WHERE normalize_phone(patient_phone) <> patient_phone;
