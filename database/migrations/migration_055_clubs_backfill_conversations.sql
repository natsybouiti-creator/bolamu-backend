-- Migration 055: Backfill conversations pour les clubs existants sans chat
-- Chaque club actif sans conversation_id reçoit une conversation de type 'club',
-- l'animateur et tous les membres existants (club_members) sont ajoutés comme
-- participants (rôle 'animateur' pour l'animateur, 'patient' pour les autres —
-- seules valeurs acceptées par conversation_participants_role_check, cf. migration_039).
-- Jamais de DROP ni de perte de données — uniquement des INSERT/UPDATE additifs.

WITH target_clubs AS (
  SELECT id, name, animateur_phone
  FROM clubs
  WHERE conversation_id IS NULL AND is_active = TRUE
),
new_conversations AS (
  INSERT INTO conversations (type, club_id, title, created_at, is_active)
  SELECT 'club', tc.id, tc.name, NOW(), true
  FROM target_clubs tc
  RETURNING id AS conversation_id, club_id
),
updated_clubs AS (
  UPDATE clubs c
  SET conversation_id = nc.conversation_id
  FROM new_conversations nc
  WHERE c.id = nc.club_id
  RETURNING c.id AS club_id, c.animateur_phone, nc.conversation_id
),
animateur_participants AS (
  INSERT INTO conversation_participants (conversation_id, participant_phone, role, joined_at)
  SELECT conversation_id, animateur_phone, 'animateur', NOW()
  FROM updated_clubs
  RETURNING conversation_id
)
INSERT INTO conversation_participants (conversation_id, participant_phone, role, joined_at)
SELECT uc.conversation_id, cm.patient_phone, 'patient', NOW()
FROM updated_clubs uc
JOIN club_members cm ON cm.club_id = uc.club_id
WHERE cm.patient_phone <> uc.animateur_phone;
