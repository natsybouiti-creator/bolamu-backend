-- Migration 081 : Ajout du type 'reel' aux posts
-- Date : 15 juillet 2026
-- Description : Contenu vidéo courte réutilisant la table posts (comme les stories),
--              mais sans expiration 24h contrairement au type 'story'.

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_type_check;
ALTER TABLE posts ADD CONSTRAINT posts_type_check
  CHECK (type IN ('manual', 'system', 'story', 'reel'));
