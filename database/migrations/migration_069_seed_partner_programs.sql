-- Migration 069 : Seed initial de partner_programs (catalogue "Échangeable maintenant")
-- Date : 7 juillet 2026
-- Description : partner_programs était vide, ce qui gardait la bande "Échangeable
--              maintenant avec vos Zora" du dashboard patient en display:none (GET
--              /bons-zora/programs renvoyait un tableau vide). Insertion de 3
--              programmes réalistes, validés par l'utilisateur avant application.
--              partner_id laissé à NULL : Pharmacie Daffé et Laboratoire 3A ne sont
--              pas des comptes seedés dans cette base (partenaires réels côté
--              business, absents des tables users/pharmacies/laboratories ici) ;
--              aucune contrainte FK n'existe sur partner_programs.partner_id.

INSERT INTO partner_programs (name, description, category, zora_cost, fcfa_value, is_active, stock, partner_id)
VALUES
  ('Réduction 15% - Pharmacie Daffé', '15% de réduction sur médicaments et produits de santé chez Pharmacie Daffé, partenaire Bolamu.', 'Santé', 250, 3000, true, NULL, NULL),
  ('Réduction 10% - Laboratoire 3A', '10% de réduction sur vos analyses médicales chez Laboratoire 3A, partenaire Bolamu.', 'Santé', 350, 4000, true, NULL, NULL),
  ('Réduction 20% - Clinique Louise Michel', '20% de réduction sur consultation chez Clinique Louise Michel, partenaire Bolamu.', 'Santé', 500, 6000, true, NULL, NULL);
