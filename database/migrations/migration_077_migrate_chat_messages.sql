-- Migration 077 : migre chat_messages (ancien système) vers messages
-- Date : 12 juillet 2026
-- Description : Phase 8/12 du chantier "chat unifié".
--
-- AUDIT PRÉALABLE (11-12 juillet 2026) — écart avec le plan initial :
-- chat_messages.channel prend 3 valeurs distinctes, pas 2 comme supposé
-- ("communauté" + "9 messages patient<->médecin") :
--   - 'community'               : 121 messages -> BLOC 2
--   - 'medecin_+242060000001'   : 9 messages   -> BLOC 3 (canal identifie
--     un médecin précis, migrable vers une conversation 1:1)
--   - 'medecin'                 : 7 messages   -> NON MIGRÉS. Ce canal
--     générique (vestige de tests, cf. contenu "Message test médecin"
--     identique au canal ci-dessus) n'identifie AUCUN médecin
--     destinataire dans les données existantes — impossible de le
--     rattacher à une conversation 1:1 sans fabriquer un destinataire.
--     Perte assumée et documentée, comme achievement_data/réactions.
-- Tous les sender_phone des 3 canaux appartiennent au même compte patient
-- de test (+242069735418), 0 orphelin (chat_messages LEFT JOIN users).
-- Aucune violation de FK possible aujourd'hui ; guard défensif conservé
-- au cas où (EXISTS users) pour un rejeu sur un autre environnement.
--
-- Idempotence : pas de contrainte UNIQUE exploitable sur messages pour
-- ON CONFLICT (aucune ne préexiste, en ajouter une rétroactivement sortirait
-- du scope "migration SQL uniquement, aucun fichier applicatif") -> guard
-- NOT EXISTS (conversation_id, sender_phone, content, sent_at) à la place.
--
-- achievement_data (chat_messages) et chat_reactions (34 lignes) : ignorés,
-- perte assumée (actée dans le contexte du chantier, Phase 8).
--
-- Pas de BEGIN/COMMIT auto-enveloppant ici : executeMigration() (src/db/migrate.js)
-- wrappe déjà chaque fichier dans sa propre transaction (patron migration_076).
-- Un COMMIT interne aurait validé la transaction en plein milieu du script.

-- BLOC 1 : s'assurer que la conversation communauté existe
-- (no-op aujourd'hui : id=1 déjà présente, vérifié à l'audit 1e)
INSERT INTO conversations (type, created_at)
SELECT 'communaute', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM conversations WHERE type = 'communaute'
);

-- BLOC 2 : migrer les 121 messages communauté (channel = 'community')
INSERT INTO messages (conversation_id, sender_phone, content, sent_at)
SELECT
  (SELECT id FROM conversations WHERE type = 'communaute' LIMIT 1),
  cm.sender_phone,
  cm.content,
  cm.created_at
FROM chat_messages cm
WHERE cm.channel = 'community'
  AND EXISTS (SELECT 1 FROM users u WHERE u.phone = cm.sender_phone)
  AND NOT EXISTS (
    SELECT 1 FROM messages m
    WHERE m.conversation_id = (SELECT id FROM conversations WHERE type = 'communaute' LIMIT 1)
      AND m.sender_phone = cm.sender_phone
      AND m.content = cm.content
      AND m.sent_at = cm.created_at
  );

-- BLOC 3 : migrer les messages des canaux 'medecin_<phone>' — identifient
-- un médecin précis. Retrouve ou crée la conversation 1:1 réelle (réutilise
-- celle du nouveau système si elle existe déjà, ex. créée par un test ou un
-- usage réel via /chat/conversations ou /chat/medecin/:phone).
DO $$
DECLARE
  r RECORD;
  v_conv_id INTEGER;
  v_patient_role VARCHAR;
  v_doctor_role VARCHAR;
BEGIN
  FOR r IN
    SELECT DISTINCT channel,
           sender_phone AS patient_phone,
           SUBSTRING(channel FROM 9) AS doctor_phone  -- après 'medecin_' (8 car.)
    FROM chat_messages
    WHERE channel LIKE 'medecin\_+%' ESCAPE '\'
  LOOP
    -- Cherche une conversation directe existante entre les deux participants
    SELECT c.id INTO v_conv_id
    FROM conversations c
    JOIN conversation_participants cp1
      ON cp1.conversation_id = c.id AND cp1.participant_phone = r.patient_phone
    JOIN conversation_participants cp2
      ON cp2.conversation_id = c.id AND cp2.participant_phone = r.doctor_phone
    WHERE c.type IN ('private', 'patient_medecin')
    LIMIT 1;

    IF v_conv_id IS NULL THEN
      SELECT role INTO v_patient_role FROM users WHERE phone = r.patient_phone;
      SELECT role INTO v_doctor_role FROM users WHERE phone = r.doctor_phone;

      -- Si l'un des deux comptes n'existe plus, on saute ce canal plutôt
      -- que de violer la FK conversation_participants.participant_phone.
      IF v_patient_role IS NULL OR v_doctor_role IS NULL THEN
        CONTINUE;
      END IF;

      INSERT INTO conversations (type, created_at)
      VALUES ('patient_medecin', NOW())
      RETURNING id INTO v_conv_id;

      INSERT INTO conversation_participants (conversation_id, participant_phone, role)
      VALUES
        (v_conv_id, r.patient_phone, v_patient_role),
        (v_conv_id, r.doctor_phone, v_doctor_role);
    END IF;

    INSERT INTO messages (conversation_id, sender_phone, content, sent_at)
    SELECT v_conv_id, cm.sender_phone, cm.content, cm.created_at
    FROM chat_messages cm
    WHERE cm.channel = r.channel
      AND EXISTS (SELECT 1 FROM users u WHERE u.phone = cm.sender_phone)
      AND NOT EXISTS (
        SELECT 1 FROM messages m
        WHERE m.conversation_id = v_conv_id
          AND m.sender_phone = cm.sender_phone
          AND m.content = cm.content
          AND m.sent_at = cm.created_at
      );
  END LOOP;
END $$;
