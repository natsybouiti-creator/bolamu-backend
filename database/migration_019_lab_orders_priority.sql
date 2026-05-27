-- Migration 019 : Ajouter colonne priorite à lab_prescriptions
-- Créée le 20 mai 2026 pour TC-026

ALTER TABLE lab_prescriptions 
ADD COLUMN IF NOT EXISTS priorite VARCHAR(20) DEFAULT 'normale',
ADD CONSTRAINT chk_lab_prescriptions_priorite CHECK (priorite IN ('normale', 'urgente', 'critique'));

COMMENT ON COLUMN lab_prescriptions.priorite IS 'Priorité de la prescription labo : normale, urgente, critique';
