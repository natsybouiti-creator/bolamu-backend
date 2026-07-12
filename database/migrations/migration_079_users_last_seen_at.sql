-- Migration 079 : ajoute users.last_seen_at (présence multi-instances)
-- Date : 12 juillet 2026
-- Description : dette technique post-chat-unifié, item 3. onlineUsers
-- (socketService.js) est une Map JS en mémoire par instance — si Render
-- scale à plusieurs instances, un user connecté sur l'instance A apparaît
-- offline vu de l'instance B. Solution intermédiaire sans Redis : Neon
-- (déjà présente) comme store de présence partagé, avec fenêtre TTL de
-- 30s appliquée côté application (isOnline()) sur cette colonne.
--
-- Audit (12 juillet 2026) : colonne last_seen_at absente de users
-- (information_schema.columns). 53 comptes actifs — volume faible, les
-- écritures à chaque connexion/déconnexion socket restent négligeables.
--
-- Idempotente : ADD COLUMN IF NOT EXISTS, rejouable sans erreur.
-- Pas de BEGIN/COMMIT auto-enveloppant (executeMigration() wrappe déjà
-- chaque fichier dans sa propre transaction — cf. bug corrigé migration_077).

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
