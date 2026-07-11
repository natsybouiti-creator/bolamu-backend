-- ============================================================
-- Migration 075 : Rattrapage schéma module chat
-- Aligne les migrations trackées sur l'état réel de la base de
-- production (dérive constatée lors de l'audit chat du 11 juillet 2026 :
-- colonnes/contrainte ajoutées hors processus de migration versionné,
-- probablement via clubs.routes.js/migration_055 pour `title`, et via
-- une modification manuelle non documentée pour le reste).
-- 100% idempotent : no-op sur la prod actuelle (colonnes et contrainte
-- déjà présentes, à l'identique) ; reproduit le même état final sur une
-- base rejouée depuis zéro à partir de toutes les migrations.
-- Aucun changement de comportement applicatif — schéma uniquement.
-- ============================================================

-- conversations.title : écrite à la création d'un club
-- (clubs.routes.js, INSERT INTO conversations (type, club_id, title, ...)
-- VALUES ('club', ...)) et par le backfill migration_055. Jamais lue par
-- le code applicatif à ce jour (aucun SELECT trouvé) — write-only mais
-- réelle et activement écrite en prod, à conserver.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS title VARCHAR(255);

-- conversations.last_message_at : écrite après chaque message de club
-- (clubs.controller.js, UPDATE conversations SET last_message_at = NOW()
-- WHERE id = $1). Jamais lue directement : getPatientConversations()
-- (chat.service.js) calcule son propre alias de même nom via une
-- sous-requête sur messages.sent_at, sans toucher cette colonne.
-- Write-only mais réelle, à conserver.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

-- CHECK conversations_type_check : migration_039 ne listait que
-- ('patient_medecin', 'communaute', 'club'). 'private' est utilisé en
-- production depuis chat.routes.js (POST /chat/conversations — conversations
-- patient<->patient, cf. window.startChat() côté frontend) et déjà présent
-- dans la contrainte réelle en base (2 lignes type='private' constatées).
-- DROP+ADD pour que le fichier de migration versionné corresponde enfin à
-- la contrainte réelle — sans effet sur la prod (contenu identique avant/
-- après), corrige la reconstruction depuis zéro.
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_type_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_type_check
  CHECK (type IN ('private', 'patient_medecin', 'communaute', 'club'));

-- messages.message_type : colonne présente en base mais AUCUN usage trouvé
-- dans le code sur la table `messages` (audit du 11 juillet 2026 — grep
-- exhaustif de tous les INSERT/SELECT/UPDATE sur `messages` : aucun ne
-- référence message_type). Toutes les occurrences de "message_type" dans le
-- repo concernent soit chat_messages (ancien système, migration_034, table
-- distincte), soit le paramètre de notifyClub()/animateur.controller.js
-- (sélection de template WhatsApp, sans rapport avec cette table).
-- DÉPRÉCIÉE — conservée telle quelle dans cette tâche (pas de DROP,
-- décision explicite de prudence), à réévaluer pour suppression dans un
-- chantier séparé si aucun besoin (ex. pièces jointes) ne vient la
-- réutiliser. `messages.type` (CHECK text/image/document), elle, est
-- activement lue et écrite (chat.service.js, clubs.controller.js,
-- communityService.js) — c'est la colonne réellement vivante, déjà
-- couverte par migration_039, aucune action requise dessus.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_message_type_check'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
      CHECK (message_type IN ('text', 'image', 'system'));
  END IF;
END $$;

-- Index dupliqué : idx_messages_conv et idx_messages_conversation sont
-- strictement identiques (conversation_id, sent_at DESC), tous deux issus
-- de la dérive (seul idx_messages_conv était dans migration_039 d'origine).
-- On garde idx_messages_conversation : nom complet cohérent avec la
-- convention idx_<table>_<colonne(s)> déjà utilisée pour idx_messages_sender
-- et idx_conv_participants_conv dans ce même module — "conv" abrégé n'est
-- utilisé nulle part ailleurs pour la table `messages`.
DROP INDEX IF EXISTS idx_messages_conv;
