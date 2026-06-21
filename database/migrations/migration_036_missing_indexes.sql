-- Migration 036 : Index manquants sur tables à forte croissance
-- Corrige P1-DB-02 à P1-DB-06 identifiés lors de l'audit /database-admin
-- CREATE INDEX classique (pas CONCURRENTLY) — tables < 50 lignes en prod

-- P1-DB-02 : subscriptions.expires_at
-- Cron quotidien 02h00 : WHERE expires_at <= NOW() AND is_active = TRUE
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at
    ON subscriptions(expires_at);

-- P1-DB-03 : otp_codes.expires_at
-- Validation OTP : WHERE phone = $1 AND expires_at > NOW()
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at
    ON otp_codes(expires_at);

-- P1-DB-04 : payments.status + payments.created_at
-- Filtres admin/clearing : WHERE status = 'pending' / ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_payments_status
    ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at
    ON payments(created_at);

-- P1-DB-05 : lab_prescriptions (4 colonnes sans index hors PK)
-- Dashboard labo/pharmacie : filtre par patient_phone, doctor_phone, status, date
CREATE INDEX IF NOT EXISTS idx_lab_prescriptions_patient_phone
    ON lab_prescriptions(patient_phone);
CREATE INDEX IF NOT EXISTS idx_lab_prescriptions_doctor_phone
    ON lab_prescriptions(doctor_phone);
CREATE INDEX IF NOT EXISTS idx_lab_prescriptions_status
    ON lab_prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_lab_prescriptions_created_at
    ON lab_prescriptions(created_at);

-- P1-DB-06 : prescriptions.status + prescriptions.created_at
CREATE INDEX IF NOT EXISTS idx_prescriptions_status
    ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at
    ON prescriptions(created_at);
