-- Migration 082 : Système de parrainage (carte Gagner > Santé)
-- Date : 15 juillet 2026
-- Description : referred_by stocke le phone du parrain (users.member_code utilisé
--              comme code de parrainage — déjà unique, pas de nouvelle colonne
--              nécessaire pour le code lui-même). Le crédit Zora 'parrainage' au
--              parrain est déclenché par le cron abonnement.job.js quand le filleul
--              souscrit un abonnement payant actif (voir job de crédit dédié).

ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by VARCHAR(20);
