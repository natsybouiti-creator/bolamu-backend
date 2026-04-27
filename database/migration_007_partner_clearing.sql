-- ============================================================
-- BOLAMU — Migration 007 : Clearing Mensuel Partenaires
-- ============================================================
-- Tables : partner_zones, partner_payouts
-- Date : 27 avril 2026
-- ============================================================

-- ─── ENUMS PROTÉGÉS ───────────────────────────────────────────────────────────────
DO $$
BEGIN
    -- partner_payout_status : statut du versement partenaire
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_payout_status') THEN
        CREATE TYPE partner_payout_status AS ENUM ('pending', 'paid', 'failed');
    END IF;

    -- partner_type : type de partenaire
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_zone_type') THEN
        CREATE TYPE partner_zone_type AS ENUM ('doctor', 'pharmacie', 'laboratoire');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ─── TABLE partner_zones ───────────────────────────────────────────────────────────
-- Lie chaque zone géographique à ses partenaires avec le tarif par adhérent
CREATE TABLE IF NOT EXISTS partner_zones (
    id SERIAL PRIMARY KEY,
    zone_name VARCHAR(100) NOT NULL,
    partner_phone VARCHAR(20) NOT NULL,
    partner_type partner_zone_type NOT NULL,
    fee_per_adherent INTEGER NOT NULL, -- Tarif par adhérent (lu depuis platform_config)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(zone_name, partner_phone, partner_type),
    CONSTRAINT fk_partner_zones_partner
        FOREIGN KEY (partner_phone) REFERENCES users (phone)
        ON UPDATE CASCADE
);

-- Index sur colonnes filtrées
CREATE INDEX IF NOT EXISTS idx_partner_zones_zone_name ON partner_zones(zone_name);
CREATE INDEX IF NOT EXISTS idx_partner_zones_partner_phone ON partner_zones(partner_phone);
CREATE INDEX IF NOT EXISTS idx_partner_zones_partner_type ON partner_zones(partner_type);
CREATE INDEX IF NOT EXISTS idx_partner_zones_is_active ON partner_zones(is_active);

-- ─── TABLE partner_payouts ────────────────────────────────────────────────────────
-- Enregistre chaque versement mensuel vers un partenaire
CREATE TABLE IF NOT EXISTS partner_payouts (
    id SERIAL PRIMARY KEY,
    partner_phone VARCHAR(20) NOT NULL,
    partner_type partner_zone_type NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    member_count INTEGER NOT NULL DEFAULT 0,
    amount_fcfa INTEGER NOT NULL,
    status partner_payout_status DEFAULT 'pending',
    
    -- Traçabilité comptable (compte Bolamu débité)
    source_account_id VARCHAR(50),
    source_account_type account_type,
    source_account_reference VARCHAR(100),
    
    -- Traçabilité comptable (compte partenaire crédité via momo_number)
    destination_account_id VARCHAR(50),
    destination_account_type account_type,
    destination_account_reference VARCHAR(100),
    momo_number VARCHAR(20),
    momo_reference VARCHAR(100),
    
    -- Validation
    validated_by VARCHAR(20),
    validated_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index sur colonnes filtrées
CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner_phone ON partner_payouts(partner_phone);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner_type ON partner_payouts(partner_type);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_period ON partner_payouts(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_status ON partner_payouts(status);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_source_account ON partner_payouts(source_account_id);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_destination_account ON partner_payouts(destination_account_id);

-- FK vers bolamu_accounts
ALTER TABLE partner_payouts ADD CONSTRAINT fk_payouts_source_account 
    FOREIGN KEY (source_account_id) REFERENCES bolamu_accounts(account_id) ON DELETE SET NULL;
ALTER TABLE partner_payouts ADD CONSTRAINT fk_payouts_destination_account 
    FOREIGN KEY (destination_account_id) REFERENCES bolamu_accounts(account_id) ON DELETE SET NULL;

-- FK vers users (validated_by)
ALTER TABLE partner_payouts ADD CONSTRAINT fk_payouts_validated_by 
    FOREIGN KEY (validated_by) REFERENCES users(phone) ON DELETE SET NULL;

-- Commentaires
COMMENT ON TABLE partner_zones IS 'Lie chaque zone géographique à ses partenaires avec le tarif par adhérent';
COMMENT ON TABLE partner_payouts IS 'Enregistre chaque versement mensuel vers un partenaire avec traçabilité comptable';
