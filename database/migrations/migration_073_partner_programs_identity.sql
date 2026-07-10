-- Migration 073 : partner_programs — identité partenaire par phone + image_url
-- Date : 10 juillet 2026
-- Description : Phase 1 du chantier "publication d'offres partenaires"
--              (partenaires commerciaux : télécom, hôtellerie, etc.).
--
--              1. partner_id (integer) était orphelin depuis l'origine :
--                 NULL sur les 3 lignes existantes, aucune contrainte FK,
--                 et aucun code applicatif n'y écrit jamais (vérifié par
--                 grep exhaustif sur src/ — seuls SELECT et UPDATE stock
--                 par id, jamais de partner_id). Remplacé par
--                 partner_phone pour rester cohérent avec le reste du
--                 système (bon_zora_reglements.partner_phone,
--                 partner_validations.partner_phone), et avec la règle
--                 architecturale documentée : phone = identifiant
--                 universel, jamais l'id numérique.
--              2. Aucun rôle 'partenaire_commercial' à ajouter ici :
--                 users.role est varchar libre, sans contrainte CHECK/ENUM
--                 (vérifié : aucune contrainte CHECK sur users, le type
--                 role_enum existant est orphelin, 0 colonne l'utilise).
--              3. image_url ajoutée : partner_programs n'avait aucune
--                 colonne image (confirmé absent du schéma).

ALTER TABLE partner_programs DROP COLUMN IF EXISTS partner_id;

ALTER TABLE partner_programs ADD COLUMN partner_phone VARCHAR(20)
  REFERENCES users(phone);

ALTER TABLE partner_programs ADD COLUMN image_url TEXT;
