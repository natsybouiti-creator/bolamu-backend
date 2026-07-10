-- Migration 074 : élargit users.role de VARCHAR(20) à VARCHAR(30)
-- Date : 10 juillet 2026
-- Description : Phase 3A du chantier "publication d'offres partenaires".
--              'partenaire_commercial' (21 caractères) dépasse la limite
--              actuelle de users.role (VARCHAR(20)), découvert via un
--              INSERT réel qui a échoué avec "value too long for type
--              character varying(20)". Aucune contrainte CHECK/ENUM sur
--              users.role (vérifié en Phase 1) — uniquement une limite
--              de longueur trop courte pour ce nouveau rôle. VARCHAR(30)
--              laisse une marge confortable pour de futurs rôles.

ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(30);
