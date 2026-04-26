-- Mise à jour des tarifs mensuels
UPDATE platform_config SET config_value = '2000' WHERE config_key = 'price_essentiel';
UPDATE platform_config SET config_value = '5000' WHERE config_key = 'price_standard';
UPDATE platform_config SET config_value = '10000' WHERE config_key = 'price_premium';

-- Ajout des tarifs annuels
INSERT INTO platform_config (config_key, config_value, description)
VALUES 
  ('price_essentiel_annual', '24000', 'Tarif annuel formule Essentiel (FCFA)'),
  ('price_standard_annual', '60000', 'Tarif annuel formule Standard (FCFA)'),
  ('price_premium_annual', '120000', 'Tarif annuel formule Premium (FCFA)')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;
