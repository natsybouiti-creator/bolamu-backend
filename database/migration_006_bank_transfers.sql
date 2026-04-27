-- ============================================================
-- BOLAMU — Migration 006 : Virements Bancaires (Individuel & B2B)
-- Date : 27 avril 2026
-- Objectif : Tables pour virements bancaires patients et entreprises
-- ============================================================

-- ------------------------------------------------------------

-- 1. CRÉATION DES ENUMS NOUVEAUX (AVEC PROTECTION DOUBLONS)
-- ------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE bank_transfer_status AS ENUM ('pending', 'reconciled', 'activated', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE company_contract_status AS ENUM ('draft', 'signed', 'active', 'terminated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE company_employee_status AS ENUM ('pending', 'active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------

-- 2. PHASE 1 — VIREMENT INDIVIDUEL PATIENT
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bank_transfer_requests (
    id                      BIGSERIAL      PRIMARY KEY,
    
    -- Référence structurée : BOL-{phone}-{YYYYMMDD}-{random4}
    reference               VARCHAR(50)    NOT NULL UNIQUE,
    
    -- Patient
    patient_phone           VARCHAR(20)    NOT NULL,
    CONSTRAINT fk_bank_transfer_patient
        FOREIGN KEY (patient_phone) REFERENCES users (phone)
        ON UPDATE CASCADE,
    
    -- Montant
    amount_fcfa             INTEGER        NOT NULL CHECK (amount_fcfa > 0),
    
    -- Plan d'abonnement demandé
    plan                    VARCHAR(20)    NOT NULL,
    
    -- Statut
    status                  bank_transfer_status NOT NULL DEFAULT 'pending',
    
    -- TRAÇABILITÉ COMPTABLE — COMPTE BOLAMU CRÉDITÉ
    destination_account_id   VARCHAR(50)    NOT NULL,
    CONSTRAINT fk_bank_transfer_account
        FOREIGN KEY (destination_account_id) REFERENCES bolamu_accounts (account_id)
        ON UPDATE CASCADE,
    
    -- Référence vers l'abonnement activé (après confirmation)
    subscription_id          INTEGER,
    CONSTRAINT fk_bank_transfer_subscription
        FOREIGN KEY (subscription_id) REFERENCES subscriptions (id)
        ON UPDATE CASCADE,
    
    -- Référence externe (référence virement bancaire)
    external_reference      VARCHAR(100),
    
    -- Notes
    notes                   TEXT,
    
    -- Validation
    validated_by            VARCHAR(20),
    CONSTRAINT fk_bank_transfer_validated_by
        FOREIGN KEY (validated_by) REFERENCES users (phone)
        ON UPDATE CASCADE,
    validated_at            TIMESTAMPTZ,
    
    -- Horodatage
    created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bank_transfer_reference ON bank_transfer_requests (reference);
CREATE INDEX IF NOT EXISTS idx_bank_transfer_patient_phone ON bank_transfer_requests (patient_phone);
CREATE INDEX IF NOT EXISTS idx_bank_transfer_status ON bank_transfer_requests (status);
CREATE INDEX IF NOT EXISTS idx_bank_transfer_destination_account ON bank_transfer_requests (destination_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfer_subscription ON bank_transfer_requests (subscription_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfer_created_at ON bank_transfer_requests (created_at DESC);

-- ------------------------------------------------------------

-- 3. PHASE 2 — B2B ENTREPRISES
-- ------------------------------------------------------------

-- Table company_contracts (contrat entreprise avec Bolamu)
CREATE TABLE IF NOT EXISTS company_contracts (
    id                      SERIAL         PRIMARY KEY,
    
    -- Référence structurée : BOL-B2B-{company_code}-{YYYYMMDD}
    reference               VARCHAR(50)    NOT NULL UNIQUE,
    
    -- Identifiant entreprise
    company_code            VARCHAR(20)    NOT NULL UNIQUE,
    company_name            VARCHAR(200)   NOT NULL,
    
    -- Contact entreprise
    contact_name            VARCHAR(100)   NOT NULL,
    contact_phone           VARCHAR(20)    NOT NULL,
    contact_email           VARCHAR(100),
    
    -- Détails contrat
    employee_count          INTEGER        NOT NULL CHECK (employee_count > 0),
    total_amount_fcfa       INTEGER        NOT NULL CHECK (total_amount_fcfa > 0),
    plan                    VARCHAR(20)    NOT NULL,
    billing_type            VARCHAR(20)    NOT NULL CHECK (billing_type IN ('monthly', 'annual')),
    
    -- Statut
    status                  company_contract_status NOT NULL DEFAULT 'draft',
    
    -- Dates
    signed_at               TIMESTAMPTZ,
    started_at              TIMESTAMPTZ,
    expires_at              TIMESTAMPTZ,
    
    -- TRAÇABILITÉ COMPTABLE — COMPTE BOLAMU CRÉDITÉ
    destination_account_id   VARCHAR(50)    NOT NULL,
    CONSTRAINT fk_company_contract_account
        FOREIGN KEY (destination_account_id) REFERENCES bolamu_accounts (account_id)
        ON UPDATE CASCADE,
    
    -- Documents
    contract_document_url   VARCHAR(500),
    
    -- Notes
    notes                   TEXT,
    
    -- Validation
    validated_by            VARCHAR(20),
    CONSTRAINT fk_company_contract_validated_by
        FOREIGN KEY (validated_by) REFERENCES users (phone)
        ON UPDATE CASCADE,
    validated_at            TIMESTAMPTZ,
    
    -- Horodatage
    created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_contracts_reference ON company_contracts (reference);
CREATE INDEX IF NOT EXISTS idx_company_contracts_company_code ON company_contracts (company_code);
CREATE INDEX IF NOT EXISTS idx_company_contracts_status ON company_contracts (status);
CREATE INDEX IF NOT EXISTS idx_company_contracts_destination_account ON company_contracts (destination_account_id);
CREATE INDEX IF NOT EXISTS idx_company_contracts_created_at ON company_contracts (created_at DESC);

-- Table company_employees (employés rattachés au contrat)
CREATE TABLE IF NOT EXISTS company_employees (
    id                      BIGSERIAL      PRIMARY KEY,
    
    -- Contrat entreprise
    contract_id             INTEGER        NOT NULL,
    CONSTRAINT fk_company_employee_contract
        FOREIGN KEY (contract_id) REFERENCES company_contracts (id)
        ON UPDATE CASCADE,
    
    -- Employé
    employee_phone           VARCHAR(20)    NOT NULL,
    CONSTRAINT fk_company_employee_user
        FOREIGN KEY (employee_phone) REFERENCES users (phone)
        ON UPDATE CASCADE,
    
    -- Nom complet (reprise pour faciliter les requêtes)
    employee_name            VARCHAR(100)   NOT NULL,
    
    -- Référence vers l'abonnement activé
    subscription_id          INTEGER,
    CONSTRAINT fk_company_employee_subscription
        FOREIGN KEY (subscription_id) REFERENCES subscriptions (id)
        ON UPDATE CASCADE,
    
    -- Statut
    status                  company_employee_status NOT NULL DEFAULT 'pending',
    
    -- Notes
    notes                   TEXT,
    
    -- Horodatage
    created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_employees_contract ON company_employees (contract_id);
CREATE INDEX IF NOT EXISTS idx_company_employees_employee_phone ON company_employees (employee_phone);
CREATE INDEX IF NOT EXISTS idx_company_employees_status ON company_employees (status);
CREATE INDEX IF NOT EXISTS idx_company_employees_subscription ON company_employees (subscription_id);
CREATE INDEX IF NOT EXISTS idx_company_employees_created_at ON company_employees (created_at DESC);

-- Index unique pour éviter les doublons employé/contrat
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_employees_unique_contract_employee 
    ON company_employees (contract_id, employee_phone);
