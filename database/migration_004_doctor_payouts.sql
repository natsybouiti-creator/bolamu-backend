-- Migration 004 : Table versements médecins (doctor_payouts)
-- Date : 26 avril 2026

CREATE TABLE IF NOT EXISTS doctor_payouts (
    id                  SERIAL PRIMARY KEY,
    doctor_phone        VARCHAR(20)         NOT NULL,
    CONSTRAINT fk_doctor_payouts_doctor
        FOREIGN KEY (doctor_phone) REFERENCES doctors (phone)
        ON UPDATE CASCADE,
    amount_fcfa         INTEGER             NOT NULL,
    consultations_count INTEGER             NOT NULL DEFAULT 0,
    period_start        DATE                NOT NULL,
    period_end          DATE                NOT NULL,
    status              VARCHAR(20)         NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'paid', 'failed')),
    momo_number         VARCHAR(20)         NOT NULL,
    momo_reference      VARCHAR(100),
    initiated_by        VARCHAR(20),
    note                TEXT,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_payouts_phone 
    ON doctor_payouts (doctor_phone);
CREATE INDEX IF NOT EXISTS idx_doctor_payouts_status 
    ON doctor_payouts (status);
CREATE INDEX IF NOT EXISTS idx_doctor_payouts_period 
    ON doctor_payouts (period_start, period_end);

-- Audit log pour chaque versement
-- (utilise la table audit_log existante)
