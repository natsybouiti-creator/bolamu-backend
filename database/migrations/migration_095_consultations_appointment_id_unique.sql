-- Migration 095 : contrainte UNIQUE sur consultations.appointment_id
-- Contexte : correction de la migration 094. PostgreSQL ne supporte pas
-- ADD CONSTRAINT IF NOT EXISTS. On utilise un bloc DO pour n'ajouter
-- la contrainte que si elle n'existe pas encore.

-- 1. Détection des doublons existants avant d'ajouter la contrainte
DO $$
DECLARE
    d RECORD;
    dup_count INTEGER := 0;
BEGIN
    FOR d IN
        SELECT appointment_id, COUNT(*) AS cnt
        FROM consultations
        WHERE appointment_id IS NOT NULL
        GROUP BY appointment_id
        HAVING COUNT(*) > 1
    LOOP
        dup_count := dup_count + 1;
        RAISE NOTICE 'Doublon detecte : appointment_id=% (count=%)', d.appointment_id, d.cnt;
    END LOOP;

    IF dup_count > 0 THEN
        RAISE EXCEPTION '% doublon(s) sur consultations.appointment_id. Nettoyer avant migration.', dup_count;
    END IF;
END $$;

-- 2. Ajout idempotent de la contrainte UNIQUE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'consultations_appointment_id_unique'
          AND conrelid = 'consultations'::regclass
    ) THEN
        ALTER TABLE consultations
        ADD CONSTRAINT consultations_appointment_id_unique
        UNIQUE (appointment_id);
    END IF;
END $$;
