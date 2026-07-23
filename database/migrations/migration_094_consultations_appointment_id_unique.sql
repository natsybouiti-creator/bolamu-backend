-- Migration 094 : contrainte UNIQUE sur consultations.appointment_id
-- Contexte : fix clôture consultation (branche A). /consultations/:id/close
-- reçoit désormais un appointment_id. L'upsert idempotent nécessite une
-- contrainte d'unicité sur appointment_id (les valeurs NULL restent permises).

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
        RAISE EXCEPTION '% doublon(s) sur consultations.appointment_id. Nettoyer avant d appliquer cette migration.', dup_count;
    END IF;
END $$;

ALTER TABLE consultations
ADD CONSTRAINT IF NOT EXISTS consultations_appointment_id_unique
UNIQUE (appointment_id);
