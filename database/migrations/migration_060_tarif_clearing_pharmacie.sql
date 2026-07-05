-- Migration 060: Tarif de clearing dispensation pharmacie (platform_config)
-- Contexte : deliverPrescription() (Système A canonique, unification ordonnances/
-- prescriptions) génère désormais un clearing_transactions à la dispensation.
-- La référence pharmacie.service.js::dispenserOrdonnance() lisait un tarif depuis
-- partner_zones.tarif_fcfa — colonne inexistante sur la table réelle (vérifié sur
-- Neon), jamais fonctionnelle. Remplacé par une clé platform_config dédiée,
-- conforme à la règle "jamais de valeur hardcodée".
-- Additive uniquement — aucune colonne existante modifiée ni supprimée.

INSERT INTO platform_config (config_key, config_value, description) VALUES
    ('tarif_clearing_pharmacie', '2500', 'Tarif clearing CDR par dispensation pharmacie (FCFA), fallback historique')
ON CONFLICT (config_key) DO NOTHING;
