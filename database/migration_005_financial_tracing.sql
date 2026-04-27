-- ============================================================
-- BOLAMU — Migration 005 : Traçabilité Comptable Financière
-- Date : 27 avril 2026
-- Objectif : Ajouter traçabilité comptable aux tables financières existantes
-- Stratégie : ALTER TABLE (pas de migration de données VARCHAR vers ENUMs)
-- ============================================================

-- ------------------------------------------------------------

-- 1. CRÉATION DES ENUMS NOUVEAUX (AVEC PROTECTION DOUBLONS)
-- ------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'refunded', 'reconciling');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('mtn_momo', 'airtel_money', 'bank_transfer', 'cash', 'simulation');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE account_type AS ENUM ('mtn_momo', 'airtel_money', 'bank_account');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE convention_status AS ENUM ('pending', 'actif', 'suspendu', 'resilie');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM ('pending', 'validated', 'paid', 'rejected', 'reconciling');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------

-- 2. ALTER TABLE PAYMENTS — AJOUT COLONNES TRAÇABILITÉ
-- ------------------------------------------------------------

-- Direction du flux (entrant/sortant)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS direction VARCHAR(10) CHECK (direction IN ('incoming', 'outgoing'));

-- Méthode de paiement (nouveau ENUM)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS payment_method_new payment_method;

-- Type de paiement (abonnement, consultation, tiers payant, etc.)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50);

-- Référence vers l'abonnement
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS subscription_id INTEGER;

-- Référence vers le rendez-vous
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS appointment_id INTEGER;

-- TRAÇABILITÉ COMPTABLE — COMPTE SOURCE
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS source_account_id VARCHAR(50);

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS source_account_type account_type;

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS source_account_reference VARCHAR(100);

-- TRAÇABILITÉ COMPTABLE — COMPTE DESTINATION
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS destination_account_id VARCHAR(50);

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS destination_account_type account_type;

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS destination_account_reference VARCHAR(100);

-- Référence externe (référence transaction opérateur, numéro virement, etc.)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS external_reference VARCHAR(100);

-- Notes / motif
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Réconciliation
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS reconciled_by VARCHAR(20);

-- Indexes pour les nouvelles colonnes
CREATE INDEX IF NOT EXISTS idx_payments_direction ON payments (direction);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method_new ON payments (payment_method_new);
CREATE INDEX IF NOT EXISTS idx_payments_source_account ON payments (source_account_id, source_account_type);
CREATE INDEX IF NOT EXISTS idx_payments_destination_account ON payments (destination_account_id, destination_account_type);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON payments (subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_appointment ON payments (appointment_id);

-- ------------------------------------------------------------

-- 3. ALTER TABLE PARTNER_CONVENTIONS — AJOUT COLONNES TRAÇABILITÉ
-- ------------------------------------------------------------

-- Statut (nouveau ENUM, garde l'ancien VARCHAR en parallèle)
ALTER TABLE partner_conventions 
ADD COLUMN IF NOT EXISTS status_new convention_status;

-- Dates
ALTER TABLE partner_conventions 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE partner_conventions 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- TRAÇABILITÉ COMPTABLE — COMPTE BOLAMU DÉBITÉ POUR VERSEMENTS
ALTER TABLE partner_conventions 
ADD COLUMN IF NOT EXISTS payout_account_id VARCHAR(50);

ALTER TABLE partner_conventions 
ADD COLUMN IF NOT EXISTS payout_account_type account_type;

ALTER TABLE partner_conventions 
ADD COLUMN IF NOT EXISTS payout_account_reference VARCHAR(100);

-- TRAÇABILITÉ COMPTABLE — COMPTE PARTENAIRE CRÉDITÉ
ALTER TABLE partner_conventions 
ADD COLUMN IF NOT EXISTS partner_account_id VARCHAR(50);

ALTER TABLE partner_conventions 
ADD COLUMN IF NOT EXISTS partner_account_type account_type;

ALTER TABLE partner_conventions 
ADD COLUMN IF NOT EXISTS partner_account_reference VARCHAR(100);

-- Documents
ALTER TABLE partner_conventions 
ADD COLUMN IF NOT EXISTS contract_document_url VARCHAR(500);

-- Validation
ALTER TABLE partner_conventions 
ADD COLUMN IF NOT EXISTS validated_by VARCHAR(20);

ALTER TABLE partner_conventions 
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

-- Indexes pour les nouvelles colonnes
CREATE INDEX IF NOT EXISTS idx_conventions_status_new ON partner_conventions (status_new);
CREATE INDEX IF NOT EXISTS idx_conventions_payout_account ON partner_conventions (payout_account_id, payout_account_type);
CREATE INDEX IF NOT EXISTS idx_conventions_partner_account ON partner_conventions (partner_account_id, partner_account_type);

-- ------------------------------------------------------------

-- 4. ALTER TABLE TRANSACTIONS_TIERS_PAYANT — AJOUT COLONNES TRAÇABILITÉ
-- ------------------------------------------------------------

-- Convention associée
ALTER TABLE transactions_tiers_payant 
ADD COLUMN IF NOT EXISTS convention_id INTEGER;

-- Statut (nouveau ENUM, garde l'ancien VARCHAR en parallèle)
ALTER TABLE transactions_tiers_payant 
ADD COLUMN IF NOT EXISTS status_new transaction_status;

-- TRAÇABILITÉ COMPTABLE — COMPTE BOLAMU DÉBITÉ
ALTER TABLE transactions_tiers_payant 
ADD COLUMN IF NOT EXISTS source_account_id VARCHAR(50);

ALTER TABLE transactions_tiers_payant 
ADD COLUMN IF NOT EXISTS source_account_type account_type;

ALTER TABLE transactions_tiers_payant 
ADD COLUMN IF NOT EXISTS source_account_reference VARCHAR(100);

-- TRAÇABILITÉ COMPTABLE — COMPTE PARTENAIRE CRÉDITÉ
ALTER TABLE transactions_tiers_payant 
ADD COLUMN IF NOT EXISTS destination_account_id VARCHAR(50);

ALTER TABLE transactions_tiers_payant 
ADD COLUMN IF NOT EXISTS destination_account_type account_type;

ALTER TABLE transactions_tiers_payant 
ADD COLUMN IF NOT EXISTS destination_account_reference VARCHAR(100);

-- Notes
ALTER TABLE transactions_tiers_payant 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Réconciliation
ALTER TABLE transactions_tiers_payant 
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

ALTER TABLE transactions_tiers_payant 
ADD COLUMN IF NOT EXISTS reconciled_by VARCHAR(20);

-- Indexes pour les nouvelles colonnes
CREATE INDEX IF NOT EXISTS idx_ttp_convention ON transactions_tiers_payant (convention_id);
CREATE INDEX IF NOT EXISTS idx_ttp_status_new ON transactions_tiers_payant (status_new);
CREATE INDEX IF NOT EXISTS idx_ttp_source_account ON transactions_tiers_payant (source_account_id, source_account_type);
CREATE INDEX IF NOT EXISTS idx_ttp_destination_account ON transactions_tiers_payant (destination_account_id, destination_account_type);

-- ------------------------------------------------------------

-- 5. CREATE TABLE BOLAMU_ACCOUNTS (référentiel des comptes NBA Gestion SARLU)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bolamu_accounts (
    id                      SERIAL         PRIMARY KEY,
    
    -- Identifiant du compte
    account_id              VARCHAR(50)    NOT NULL UNIQUE,
    
    -- Type de compte
    account_type            account_type   NOT NULL,
    
    -- Référence externe (numéro MoMo, RIB, etc.)
    account_reference       VARCHAR(100)   NOT NULL,
    
    -- Banque / opérateur
    provider_name           VARCHAR(100)   NOT NULL, -- MTN, Airtel, BGFI, LCB, CDC, etc.
    
    -- Devise (FCFA par défaut)
    currency                VARCHAR(3)     NOT NULL DEFAULT 'XAF',
    
    -- Solde courant (snapshot, non comptable)
    current_balance_fcfa    INTEGER        NOT NULL DEFAULT 0,
    
    -- Type d'utilisation
    usage_type              VARCHAR(20)    NOT NULL CHECK (usage_type IN ('incoming', 'outgoing', 'both')),
    
    -- Statut
    is_active               BOOLEAN        NOT NULL DEFAULT TRUE,
    
    -- Notes
    notes                   TEXT,
    
    -- Horodatage
    created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bolamu_accounts_type ON bolamu_accounts (account_type);
CREATE INDEX IF NOT EXISTS idx_bolamu_accounts_usage ON bolamu_accounts (usage_type);
CREATE INDEX IF NOT EXISTS idx_bolamu_accounts_active ON bolamu_accounts (account_id) WHERE is_active = TRUE;

-- ------------------------------------------------------------

-- 6. INSERT DONNÉES INITIALES — COMPTES BOLAMU (PLACEHOLDERS)
-- ------------------------------------------------------------

INSERT INTO bolamu_accounts (account_id, account_type, account_reference, provider_name, usage_type, notes)
VALUES 
    ('BOLAMU_MTN_IN', 'mtn_momo', '+242XXXXXXXX', 'MTN Congo', 'incoming', 'Compte MTN MoMo Bolamu — réception paiements patients (PLACEHOLDER)'),
    ('BOLAMU_AIRTEL_IN', 'airtel_money', '+242XXXXXXXX', 'Airtel Congo', 'incoming', 'Compte Airtel Money Bolamu — réception paiements patients (PLACEHOLDER)'),
    ('BOLAMU_BGFI_MAIN', 'bank_account', 'CGXXXXXXXXX', 'BGFI Bank', 'both', 'Compte principal BGFI Bank — opérations diverses (PLACEHOLDER)'),
    ('BOLAMU_LCB_MAIN', 'bank_account', 'CGXXXXXXXXX', 'LCB Bank', 'both', 'Compte principal LCB Bank — opérations diverses (PLACEHOLDER)'),
    ('BOLAMU_MTN_OUT', 'mtn_momo', '+242XXXXXXXX', 'MTN Congo', 'outgoing', 'Compte MTN MoMo Bolamu — versements partenaires (PLACEHOLDER)'),
    ('BOLAMU_AIRTEL_OUT', 'airtel_money', '+242XXXXXXXX', 'Airtel Congo', 'outgoing', 'Compte Airtel Money Bolamu — versements partenaires (PLACEHOLDER)')
ON CONFLICT (account_id) DO NOTHING;
