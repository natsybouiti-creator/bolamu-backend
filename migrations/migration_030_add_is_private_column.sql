-- Migration 030 : Ajout colonne is_private pour confidentialité des comptes
-- Date : 6 juillet 2026
-- Description : Permet aux adhérents de passer leur compte en privé (comme Instagram)
--              Si un compte est privé, seuls les followers acceptés peuvent voir ses publications

-- Ajout colonne is_private dans users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Commentaire explicatif
COMMENT ON COLUMN users.is_private IS 'Indique si le compte est privé (true) ou public (false). Par défaut public.';
