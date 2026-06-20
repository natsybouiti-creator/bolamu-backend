-- ============================================================
-- BOLAMU — Sprint 3 : Seeds Marketplace MFR
-- ============================================================

-- Partenaires (données démo, logo_path = chemin local existant)
INSERT INTO zora_partners (name, category, logo_path, is_active) VALUES
  ('Pharmacie Amour', 'sante', 
   '/images/partners/pharmacie-amour.png', TRUE),
  ('Clinique Médicale Securex', 'sante', 
   '/images/partners/securex.png', TRUE),
  ('Laboratoire 3A', 'sante', 
   '/images/partners/labo-3a.png', TRUE),
  ('MTN Congo', 'telecom', 
   '/images/partners/mtn.png', TRUE),
  ('Airtel Congo', 'telecom', 
   '/images/partners/airtel.png', TRUE),
  ('Canal Olympia', 'lifestyle', 
   '/images/partners/canal-olympia.png', TRUE),
  ('Grand Lancaster Hotel', 'hotel', 
   '/images/partners/grand-lancaster.png', TRUE);

-- Récompenses (données démo)
INSERT INTO zora_rewards 
  (partner_id, title, description, points_cost, discount_value, 
   discount_type, stock, valid_days, min_tier) VALUES
  (1, 'Remise 15% en pharmacie', 
   '15% de réduction sur votre prochaine ordonnance',
   300, '15%', 'percent', NULL, 2, 'kimia'),
  (2, 'Consultation à tarif réduit', 
   '5 000 FCFA de réduction sur une consultation',
   500, '5000 FCFA', 'fixed_fcfa', 50, 2, 'liboso'),
  (3, 'Analyse offerte', 
   'Une analyse sanguine de base offerte',
   750, '100%', 'percent', 20, 2, 'liboso'),
  (4, 'Forfait data 1Go offert', 
   '1 Go de data MTN offert',
   400, '1Go data', 'fixed_fcfa', NULL, 2, 'kimia'),
  (5, 'Recharge Airtel 2000 FCFA', 
   'Recharge téléphonique Airtel',
   350, '2000 FCFA', 'fixed_fcfa', NULL, 2, 'kimia'),
  (6, 'Place de cinéma offerte', 
   '1 place pour le prochain film au Canal Olympia',
   600, '1 place', 'fixed_fcfa', 30, 7, 'liboso'),
  (7, 'Nuit à tarif préférentiel', 
   '20% sur une nuit au Grand Lancaster',
   2000, '20%', 'percent', 10, 7, 'nkembo');
