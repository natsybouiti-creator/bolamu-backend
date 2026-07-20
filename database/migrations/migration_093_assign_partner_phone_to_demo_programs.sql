-- Migration 093 — Attribution temporaire de propriétaires aux offres démo
-- Contexte : Les offres démo (IDs 1,2,3,13-19) avaient partner_phone=NULL,
-- créant une faille fail-open dans validateBonZora() (n'importe quel partenaire
-- pouvait valider ces bons). Cette faille a été corrigée en fail-closed.
-- Attribution temporaire à des comptes de test en attendant la création de
-- vrais comptes partenaires (Pharmacie Daffé, Laboratoire 3A, Clinique Louise Michel,
-- + 7 partenaires commerciaux à catégoriser).
-- À réassigner quand ces comptes existeront.

BEGIN;

-- Offres santé : assignées aux comptes de test actifs disponibles
UPDATE partner_programs SET partner_phone = '+242060000123' WHERE id IN (1, 3);
-- id=1 "Réduction 15% - Pharmacie Daffé" → Dr. Test Bolamu (compte test générique)
-- id=3 "Réduction 20% - Clinique Louise Michel" → Dr. Test Bolamu (rôle doctor cohérent)

UPDATE partner_programs SET partner_phone = '+242069990020' WHERE id IN (2, 13, 14, 15);
-- id=2 "Réduction 10% - Laboratoire 3A" → Partenaire Commercial Test (compte test générique)
-- id=13 "Boutique TechZone" → Partenaire Commercial Test
-- id=14 "Agence Horizon Voyages" → Partenaire Commercial Test
-- id=15 "Réseau ConnectPlus" → Partenaire Commercial Test

-- Offres commerciales restantes : réparties sur le second compte test
UPDATE partner_programs SET partner_phone = '+242090000004' WHERE id IN (16, 17, 18, 19);
-- id=16 "Hôtel Bord de Mer" → Test Partenaire E2E
-- id=17 "Club Forme & Vitalité" → Test Partenaire E2E
-- id=18 "Institut Éclat Beauté" → Test Partenaire E2E
-- id=19 "Station AutoPlus" → Test Partenaire E2E

COMMIT;
