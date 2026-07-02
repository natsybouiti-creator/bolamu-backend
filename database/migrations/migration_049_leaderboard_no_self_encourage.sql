-- Migration 049 : Bloquer l'auto-encouragement dans leaderboard_encouragements
-- Un patient ne doit pas pouvoir s'encourager lui-même

ALTER TABLE leaderboard_encouragements
ADD CONSTRAINT chk_no_self_encouragement 
CHECK (from_phone != target_phone);
