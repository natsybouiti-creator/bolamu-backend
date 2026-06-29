-- ============================================================
-- BOLAMU — Migration : champs paiement abonnements
-- Adapte la table subscriptions existante (NE TOUCHE PAS aux colonnes existantes)
-- ENUM réel : subscription_status (active | expired | suspended)
-- ============================================================

-- 1. Ajouter 'pending' à l'ENUM subscription_status (idempotent)
--    NB : ADD VALUE ne peut pas tourner dans un bloc transactionnel (ni DO) → statement autonome.
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'pending';

-- 2. Ajouter les colonnes manquantes (idempotent)
--    validated_by = phone admin (règle Bolamu : phone, jamais l'id numérique)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS operator           VARCHAR(10)
    CHECK (operator IN ('MTN', 'AIRTEL')),
  ADD COLUMN IF NOT EXISTS next_billing_date  DATE,
  ADD COLUMN IF NOT EXISTS validated_by       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS validated_at       TIMESTAMPTZ;

-- payment_reference existe déjà dans le schéma initial (migration_001) — non recréé.

-- 3. FK validated_by -> users(phone) (idempotent, ignore si déjà présente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_subscriptions_validated_by'
      AND table_name = 'subscriptions'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT fk_subscriptions_validated_by
      FOREIGN KEY (validated_by) REFERENCES users (phone) ON UPDATE CASCADE;
  END IF;
END$$;

-- 4. Index pour les cron jobs de renouvellement
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing
  ON subscriptions (next_billing_date)
  WHERE status = 'active';
