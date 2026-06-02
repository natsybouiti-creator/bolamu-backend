-- Migration 030 : Ajouter rh_phone à company_contracts pour lier les RH
-- Date : 2026-06-02
-- Description : Permet de lier un RH à un contrat via son téléphone, en plus du contact_phone

-- Ajouter la colonne rh_phone
ALTER TABLE company_contracts 
  ADD COLUMN IF NOT EXISTS rh_phone VARCHAR(20);

-- Lier le RH Brasco au contrat BRASCO (id = 1)
UPDATE company_contracts 
  SET rh_phone = '+242077000003'
  WHERE id = 1;

-- Ajouter un commentaire pour documentation
COMMENT ON COLUMN company_contracts.rh_phone IS 'Téléphone du RH responsable du contrat (distinct du contact_phone)';
