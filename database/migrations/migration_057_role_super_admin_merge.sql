-- Migration 057: Fusion du rôle super_admin dans admin
-- Décision produit : super_admin n'a jamais eu de périmètre distinct d'admin.
-- UPDATE uniquement — jamais de DELETE sur users.

UPDATE users SET role = 'admin' WHERE role = 'super_admin';
