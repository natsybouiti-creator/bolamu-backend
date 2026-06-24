-- Migration 043 : Correction balance Zora pour +242069735418
-- Bug : balance = 0 mais ledger SUM = -500
-- Solution : recalculer balance depuis ledger

-- Correction immédiate pour le téléphone problématique
UPDATE zora_points 
SET balance = (
  SELECT COALESCE(SUM(points), 0) 
  FROM zora_ledger 
  WHERE phone = '242069735418'
), 
updated_at = NOW()
WHERE phone = '242069735418';

-- Recalculer tous les balances pour éviter d'autres incohérences
UPDATE zora_points zp
SET balance = (
  SELECT COALESCE(SUM(points), 0) 
  FROM zora_ledger zl 
  WHERE zl.phone = zp.phone
),
updated_at = NOW();
