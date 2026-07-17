-- ============================================================
-- Migration 087 : photos des 3 offres partenaires santé réelles
-- Date : 17 juillet 2026
--
-- image_url était NULL sur les 3 offres actives (audit du 17 juillet
-- 2026). Photos déjà présentes dans public/images/landing/ (jamais
-- reliées à partner_programs), uploadées vers Cloudinary
-- (dossier bolamu/partner_programs, cohérent avec le CRUD existant de
-- bon-zora.routes.js) :
--   - Pharmacie Daffé : 67-pharmacie-daffe.jpg (photo dédiée réelle,
--     déjà utilisée pour cet établissement dans public/js/
--     etablissements-carte-temp.js)
--   - Clinique Louise Michel : 59-clinique-louise-michel.jpg (photo
--     dédiée réelle, déjà utilisée pour cet établissement dans
--     etablissements-carte-temp.js ET public/reseau/cliniques-medecins.html)
--   - Laboratoire 3A : AUCUNE photo dédiée n'existe dans le dépôt
--     (vérifié par recherche exhaustive) — repli sur
--     18-reseau-laboratoires.jpg, photo stock générique (tube de sang,
--     gants), topiquement pertinente mais non spécifique à cet
--     établissement. Signalé explicitement : à remplacer par une vraie
--     photo de Laboratoire 3A si elle devient disponible.
-- ============================================================

UPDATE partner_programs SET image_url = 'https://res.cloudinary.com/dpxefz80w/image/upload/v1784317599/bolamu/partner_programs/demo_daffe.jpg' WHERE id = 1;
UPDATE partner_programs SET image_url = 'https://res.cloudinary.com/dpxefz80w/image/upload/v1784317600/bolamu/partner_programs/demo_labo_generic.jpg' WHERE id = 2;
UPDATE partner_programs SET image_url = 'https://res.cloudinary.com/dpxefz80w/image/upload/v1784317600/bolamu/partner_programs/demo_louise_michel.jpg' WHERE id = 3;
