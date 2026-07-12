-- Migration 078 : supprime l'ANCIEN SYSTÈME chat_messages/chat_reactions
-- Date : 12 juillet 2026
-- Description : Phase 11/12 du chantier "chat unifié" — dernière étape du
-- retrait de l'ancien système canal (chat_messages/chat_reactions), après
-- migration des données (migration_077, 130 messages migrés vers messages)
-- et retrait des routes applicatives qui les utilisaient (chat.routes.js,
-- Phase 11/12 — GET/POST /medecin/messages, GET /doctors,
-- POST /messages/:id/react, GET+POST /:channel/messages).
--
-- Pertes actées et documentées (migration_077, Phase 8/12) :
--   - chat_reactions : 34 lignes
--   - chat_messages.achievement_data : toujours null en pratique
--   - 7 messages du canal générique 'medecin' (non rattachables à une
--     conversation 1:1 précise)
-- Ces 7 messages restent dans chat_messages (non migrés) — supprimés
-- avec la table, perte déjà actée et non nouvelle à cette migration.
--
-- Plus aucune route ni fonction de service active ne référence ces deux
-- tables après Phase 11/12 (postAchievement porté vers messages/
-- conversations). Les fonctions chat.service.js getMessages/sendMessage/
-- addReaction/getPatientDoctors restent définies mais deviennent du code
-- mort (non appelées par aucune route) — hors scope de cette migration,
-- laissé pour une passe de nettoyage ultérieure décidée par King.
--
-- Idempotente : DROP TABLE IF EXISTS, rejouable sans erreur.
-- Pas de BEGIN/COMMIT auto-enveloppant (executeMigration() wrappe déjà
-- chaque fichier dans sa propre transaction — cf. bug corrigé migration_077).

DROP TABLE IF EXISTS chat_reactions;
DROP TABLE IF EXISTS chat_messages;
