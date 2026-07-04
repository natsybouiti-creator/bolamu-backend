-- Migration 058: Fusion du rôle cms_medecin dans doctor
-- Décision produit : cms_medecin n'a jamais eu de périmètre distinct de doctor.
-- UPDATE uniquement — jamais de DELETE sur users.

UPDATE users SET role = 'doctor' WHERE role = 'cms_medecin';
