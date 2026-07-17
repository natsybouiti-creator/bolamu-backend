-- ============================================================
-- Migration 086 : nettoyage des résidus de test dans partner_programs
-- Date : 17 juillet 2026
--
-- Suite à l'audit du 17 juillet 2026 (offres partenaires, onglet
-- Récompenses) : 8 des 12 lignes de partner_programs étaient des
-- résidus de tests CRUD/E2E/Playwright jamais nettoyés, toutes
-- is_active=false, avec un encodage UTF-8 cassé sur certaines
-- ("R�duction", "Sant�", "T�l�com") : id 4, 5, 6, 7, 8, 9, 11, 12.
--
-- id=10 ("Consultation -20% Test Medecin", rattaché à un vrai médecin
-- suspendu, doctors.id=3 Dr. Mbemba Jean) est explicitement HORS SCOPE
-- de ce nettoyage — décision produit à trancher séparément, pas une
-- suppression automatique.
--
-- Dépendance trouvée avant suppression (pas de FK formelle déclarée
-- sur partner_bons_zora.partner_id → partner_programs.id, mais un
-- lien applicatif réel) : id=7 ("Data Illimitée 1 jour") était
-- référencé par un bon de test (partner_bons_zora.id=18, patient de
-- test +242069735418, validé par le partenaire de test
-- +242069990020, généré le 9 juillet 2026 dans le cadre du même
-- chantier E2E) et sa validation associée (partner_validations.id=10).
-- Les deux ont été supprimés dans le même ordre ci-dessous pour ne
-- laisser aucune référence orpheline.
-- ============================================================

DELETE FROM partner_validations WHERE voucher_id = 18;
DELETE FROM partner_bons_zora WHERE id = 18;
DELETE FROM partner_programs WHERE id IN (4, 5, 6, 7, 8, 9, 11, 12);
