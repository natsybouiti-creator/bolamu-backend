-- ============================================================
-- BOLAMU — Migration 001
-- Remplacement de doctors basique + ajout subscriptions,
-- platform_config, audit_log
-- À exécuter UNE SEULE FOIS sur la base bolamu existante
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. NOUVEAUX TYPES ENUM
--    (seulement s'ils n'existent pas déjà)
-- ------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE doctor_status AS ENUM ('pending', 'verified', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_plan AS ENUM ('essentiel', 'standard', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ------------------------------------------------------------
-- 1. REMPLACEMENT DE LA TABLE DOCTORS
--    On sauvegarde les données existantes (s'il y en a),
--    on droppe, on recrée proprement
-- ------------------------------------------------------------

-- Sauvegarde des données existantes dans une table temporaire
CREATE TEMP TABLE doctors_backup AS SELECT * FROM doctors;

-- Suppression de l'ancienne table
DROP TABLE doctors;

-- Nouvelle table doctors complète
CREATE TABLE doctors (
    id                      SERIAL PRIMARY KEY,
    phone                   VARCHAR(20)     NOT NULL UNIQUE,

    -- Lien optionnel vers users (garde la compatibilité avec init.sql)
    user_id                 INT REFERENCES users(id) ON UPDATE CASCADE,

    full_name               VARCHAR(200)    NOT NULL,
    specialty               VARCHAR(100)    NOT NULL,
    registration_number     VARCHAR(100)    UNIQUE,
    city                    VARCHAR(100)    NOT NULL DEFAULT 'Brazzaville',
    neighborhood            VARCHAR(150),
    bio                     TEXT,

    -- Disponibilités JSON
    -- ex: {"lundi": ["08:00-12:00","14:00-18:00"], "samedi": ["09:00-12:00"]}
    availability_schedule   JSONB           NOT NULL DEFAULT '{}',

    status                  doctor_status   NOT NULL DEFAULT 'pending',
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,

    total_consultations     INTEGER         NOT NULL DEFAULT 0,
    total_earnings_fcfa     INTEGER         NOT NULL DEFAULT 0,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    verified_at             TIMESTAMPTZ,

    CONSTRAINT chk_suspended_inactive
        CHECK (status != 'suspended' OR is_active = FALSE)
);

-- Réimport des données sauvegardées (si la table n'était pas vide)
-- On mappe les anciens champs vers les nouveaux
INSERT INTO doctors (user_id, full_name, specialty, status, is_active, phone)
SELECT
    b.user_id,
    COALESCE(b.full_name, 'À compléter'),
    COALESCE(b.speciality, 'Généraliste'),
    CASE b.status
        WHEN 'active'      THEN 'verified'::doctor_status
        WHEN 'suspendu'    THEN 'suspended'::doctor_status
        ELSE 'pending'::doctor_status
    END,
    CASE b.status WHEN 'suspendu' THEN FALSE ELSE TRUE END,
    -- Récupère le phone depuis users si possible
    COALESCE(
        (SELECT phone FROM users WHERE id = b.user_id LIMIT 1),
        '+242_migration_' || b.id  -- fallback temporaire si user_id NULL
    )
FROM doctors_backup b
ON CONFLICT (phone) DO NOTHING;

DROP TABLE doctors_backup;

-- Index
CREATE INDEX idx_doctors_phone     ON doctors (phone);
CREATE INDEX idx_doctors_specialty ON doctors (specialty);
CREATE INDEX idx_doctors_city      ON doctors (city);
CREATE INDEX idx_doctors_status    ON doctors (status) WHERE is_active = TRUE;


-- ------------------------------------------------------------
-- 2. NETTOYAGE DE users
--    statut_abonnement et date_fin_abonnement seront gérés
--    par la table subscriptions — on garde les colonnes
--    pour compatibilité mais subscriptions fait foi
-- ------------------------------------------------------------

-- Rien à modifier dans users pour l'instant —
-- les colonnes statut_abonnement/date_fin_abonnement restent
-- et seront synchronisées par un trigger en semaine 2


-- ------------------------------------------------------------
-- 3. PLATFORM_CONFIG
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS platform_config (
    id              SERIAL PRIMARY KEY,
    config_key      VARCHAR(100) NOT NULL UNIQUE,
    config_value    TEXT         NOT NULL,
    description     TEXT,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO platform_config (config_key, config_value, description) VALUES
    ('price_essentiel',            '1000',       'Tarif mensuel formule Essentiel (FCFA)'),
    ('price_standard',             '2500',       'Tarif mensuel formule Standard (FCFA)'),
    ('price_premium',              '5000',       'Tarif mensuel formule Premium (FCFA)'),
    ('doctor_fee_bootstrap',       '2500',       'Rémunération médecin phase bootstrap (FCFA)'),
    ('doctor_fee_growth',          '3500',       'Rémunération médecin phase croissance (FCFA)'),
    ('doctor_fee_maturity',        '5000',       'Rémunération médecin phase maturité (FCFA)'),
    ('active_phase',               'bootstrap',  'Phase commerciale active'),
    ('doctor_patient_ratio',       '200',        'Nombre max abonnés actifs par médecin'),
    ('breakeven_subscribers',      '280',        'Seuil de rentabilité en nombre abonnés'),
    ('subscription_duration_days', '30',         'Durée standard abonnement en jours')
ON CONFLICT (config_key) DO NOTHING;


-- ------------------------------------------------------------
-- 4. SUBSCRIPTIONS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscriptions (
    id                  SERIAL PRIMARY KEY,
    patient_phone       VARCHAR(20)         NOT NULL,
    CONSTRAINT fk_subscriptions_patient
        FOREIGN KEY (patient_phone) REFERENCES users (phone)
        ON UPDATE CASCADE,

    plan                subscription_plan   NOT NULL,
    amount_fcfa         INTEGER             NOT NULL,
    status              subscription_status NOT NULL DEFAULT 'active',

    started_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ         NOT NULL,

    is_active           BOOLEAN             NOT NULL DEFAULT TRUE,
    payment_reference   VARCHAR(100),

    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_patient ON subscriptions (patient_phone);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active
    ON subscriptions (patient_phone, expires_at)
    WHERE status = 'active' AND is_active = TRUE;


-- ------------------------------------------------------------
-- 5. AUDIT LOG
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_log (
    id              BIGSERIAL   PRIMARY KEY,
    event_type      VARCHAR(60) NOT NULL,
    actor_phone     VARCHAR(20),
    target_table    VARCHAR(60),
    target_id       INTEGER,
    payload         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_event  ON audit_log (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_log (actor_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log (target_table, target_id);


-- ------------------------------------------------------------
-- 6. TRIGGERS updated_at
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_doctors_updated_at ON doctors;
CREATE TRIGGER trg_doctors_updated_at
    BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ------------------------------------------------------------
-- 7. FONCTION UTILITAIRE — abonnement actif
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_subscription_active(p_phone VARCHAR)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM subscriptions
        WHERE patient_phone = p_phone
          AND status        = 'active'
          AND is_active     = TRUE
          AND expires_at    > NOW()
    );
$$ LANGUAGE sql STABLE;


COMMIT;

-- ------------------------------------------------------------
-- VÉRIFICATION RAPIDE (exécuter séparément après la migration)
-- ------------------------------------------------------------
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;
--
-- SELECT config_key, config_value FROM platform_config;
-- \d doctors
-- ============================================================