-- Migration 076 : élargit conversation_participants.role (colonne + contrainte)
-- Date : 11 juillet 2026 (révisée suite audit et validation King)
-- Description : Phase 1/12 du chantier "chat unifié" (consolidation de tous
--              les chats sur conversations/messages/conversation_participants).
--              La contrainte actuelle (audit pg_constraint du 11 juillet 2026)
--              n'autorise que ('patient', 'medecin', 'animateur') — 3 valeurs
--              seulement, jamais revues depuis la migration d'origine.
--
--              RÉVISION (11 juillet 2026) : la première version de cette
--              migration utilisait une liste anglaise (doctor, secretary,
--              pharmacy, laboratory, partner, company_hr, agent) alignée sur
--              le plan initial du chantier. Décision actée par King : utiliser
--              à la place les valeurs RÉELLES de users.role (audit 1b,
--              SELECT role, COUNT(*) FROM users GROUP BY role), pour éviter
--              tout mapping silencieux dans le code applicatif tant que
--              users.role n'est pas normalisé. conversation_participants.role
--              sera mis à jour en même temps que users.role le jour de sa
--              normalisation — pas avant.
--
--              Nouvelle liste (= valeurs réelles users.role) : patient,
--              doctor, secretaire, pharmacie, laboratoire, animateur,
--              partenaire_commercial, rh, admin, content_admin, agent_bolamu.
--              content_admin inclus pour cohérence de schéma bien qu'exclu du
--              scope fonctionnel du chantier chat.
--
--              'medecin' NON conservé dans la nouvelle contrainte : audit du
--              11 juillet 2026 (SELECT COUNT(*) FROM conversation_participants
--              WHERE role = 'medecin') = 0 ligne. Aucune donnée existante
--              sous ce rôle — pas de coexistence temporaire nécessaire ici.
--              conversation_participants.role utilisées aujourd'hui en prod :
--              'patient' (13 lignes), 'animateur' (13 lignes) — les deux déjà
--              couvertes par la nouvelle liste, aucune migration de données
--              nécessaire.
--
--              ÉLARGISSEMENT DE COLONNE NÉCESSAIRE : conversation_participants
--              .role est VARCHAR(20) (vérifié via information_schema.columns).
--              'partenaire_commercial' fait 21 caractères — dépasse cette
--              limite. Reproduit et confirmé par un INSERT réel en transaction
--              annulée (11 juillet 2026) : "value too long for type character
--              varying(20)", AVANT même l'évaluation de la contrainte CHECK.
--              Même bug que celui corrigé par migration_074 sur users.role
--              (VARCHAR(20) -> VARCHAR(30) pour la même valeur). Sans cet
--              élargissement, la contrainte listerait une valeur qu'aucune
--              ligne ne pourrait jamais réellement porter — piège silencieux.
--              VARCHAR(30) reprend la même marge que migration_074, cohérence
--              entre les deux colonnes de rôle.
--
-- Idempotente : ALTER COLUMN TYPE (no-op si déjà VARCHAR(30) ou plus large,
-- PostgreSQL ne réduit jamais implicitement) + DROP CONSTRAINT IF EXISTS +
-- ADD CONSTRAINT, rejouable sans erreur (testée deux fois en dry-run).

ALTER TABLE conversation_participants ALTER COLUMN role TYPE VARCHAR(30);

ALTER TABLE conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_role_check;
ALTER TABLE conversation_participants ADD CONSTRAINT conversation_participants_role_check
  CHECK (role IN ('patient', 'doctor', 'secretaire', 'pharmacie', 'laboratoire', 'animateur', 'partenaire_commercial', 'rh', 'admin', 'content_admin', 'agent_bolamu'));
