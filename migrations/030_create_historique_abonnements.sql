-- Migration : Création de la table historique_abonnements
-- But : Tracer les changements de plan (upgrade/downgrade) avec prorata et coupons
-- Date : 1 juillet 2026
-- Version : 030

CREATE TABLE IF NOT EXISTS historique_abonnements (
    id SERIAL PRIMARY KEY,
    patient_phone VARCHAR(20) NOT NULL,
    ancien_plan subscription_plan NOT NULL,
    nouveau_plan subscription_plan NOT NULL,
    montant_du INTEGER NOT NULL,
    coupon_applique JSONB,
    date_upgrade TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes par patient
CREATE INDEX IF NOT EXISTS idx_historique_abonnements_patient_phone ON historique_abonnements(patient_phone);
CREATE INDEX IF NOT EXISTS idx_historique_abonnements_date_upgrade ON historique_abonnements(date_upgrade DESC);

-- Commentaire
COMMENT ON TABLE historique_abonnements IS 'Historique des changements de plan d''abonnement avec prorata et coupons appliqués';
