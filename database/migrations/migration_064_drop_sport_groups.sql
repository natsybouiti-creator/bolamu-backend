-- ============================================================
-- Migration 064 — Suppression tables sport_groups dépréciées
-- Routes non montées (sport-groups.routes.DEPRECATED.js,
-- community.routes.DEPRECATED.js — commentées dans server.js),
-- 0 membre, 0 appelant actif dans src/.
-- Système remplacé par clubs.routes.js (Task B4).
--
-- Noms des 7 sport_groups supprimés (traçabilité) :
-- 1  | Runners Brazza
-- 2  | Basketball Poto-Poto
-- 3  | Football Bacongo
-- 4  | Tennis Club PNR
-- 5  | Natation Congo
-- 6  | Cyclisme Brazza
-- 19 | Basketball Bacongo
-- ============================================================

DROP TABLE IF EXISTS sport_group_members;
DROP TABLE IF EXISTS sport_groups;
