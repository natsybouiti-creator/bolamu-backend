-- Migration 090 — Désactivation des 3 offres Zora "santé" non conformes DPC
--
-- Contexte : Bolamu opère en Direct Primary Care (DPC), pas en assurance. Le SSP
-- (Soins de Santé Primaires) est gratuit pour l'Abonné dans le cadre de son
-- abonnement actif — ce n'est pas une remise accordée par un partenaire.
-- Les 3 offres ci-dessous (partner_phone = NULL, aucun partenaire réel rattaché)
-- décrivaient une "réduction X%" sur des actes de soin (médicaments, analyses,
-- consultation) qui chevauchent désormais le SSP gratuit et créent une confusion
-- avec un modèle d'assurance. Décision : désactivation plutôt que renommage,
-- vu l'absence de partenaire réel derrière ces offres. De nouvelles offres santé
-- seront recréées plus tard avec de vrais partenaires.
--
-- IDs concernés : 1 (Réduction 15% - Pharmacie Daffé), 2 (Réduction 10% -
-- Laboratoire 3A), 3 (Réduction 20% - Clinique Louise Michel).

UPDATE partner_programs
SET is_active = false
WHERE id IN (1, 2, 3)
  AND partner_phone IS NULL
  AND category = 'Santé';
