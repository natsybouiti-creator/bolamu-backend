-- ============================================================
-- BOLAMU — Sprint 2 : Seeds Zora Points
-- ============================================================

-- Paliers
INSERT INTO zora_tiers_config 
  (tier_name, label_fr, min_points, max_points, color_token) VALUES
  ('kimia',   'Kimia',   0,    499,  '#C0C0C0'),
  ('liboso',  'Liboso',  500,  2999, '#00C9A7'),
  ('nkembo',  'Nkembo',  3000, 6999, '#2E6EE8'),
  ('elonga',  'Elonga',  7000, NULL, '#F5A623');

-- Plafonds catégories
INSERT INTO zora_category_caps (category, cap_percent) VALUES
  ('sante',      60),
  ('activite',   25),
  ('engagement', 10),
  ('lifestyle',   5);

-- Règles de gain - Phase 'now' : actives dès ce sprint
INSERT INTO zora_earn_rules 
  (action_type, label_fr, category, points, required_proof_class, 
   daily_cap, is_active, phase) VALUES
  ('consultation', 'Consultation médicale', 
   'sante', 50, 'system_event', 1, TRUE, 'now'),
  ('analyse_labo', 'Analyse laboratoire', 
   'sante', 75, 'system_event', NULL, TRUE, 'now'),
  ('bilan_annuel', 'Bilan annuel complet', 
   'sante', 200, 'system_event', NULL, TRUE, 'now'),
  ('vaccination', 'Vaccination à jour', 
   'sante', 100, 'ground_truth', NULL, TRUE, 'now'),
  ('parrainage', 'Parrainer un ami', 
   'engagement', 200, 'system_event', NULL, TRUE, 'now');

-- Règles de gain - Phase 'sprint5' : définies mais inactives
INSERT INTO zora_earn_rules 
  (action_type, label_fr, category, points, required_proof_class,
   daily_cap, is_active, phase) VALUES
  ('event_checkin', 'Participation événement Elonga', 
   'activite', 50, 'ground_truth', NULL, TRUE, 'sprint5'),
  ('sport_session', 'Séance groupe de sport', 
   'activite', 30, 'ground_truth', NULL, FALSE, 'sprint5');

-- Règles de gain - Phase 'phase2' : définies mais inactives jusqu'à l'app mobile
INSERT INTO zora_earn_rules 
  (action_type, label_fr, category, points, required_proof_class,
   daily_cap, is_active, phase) VALUES
  ('steps_daily', '10 000 pas mesurés', 
   'activite', 25, 'device_measured', 1, FALSE, 'phase2'),
  ('workout_session', 'Séance sport auto-détectée', 
   'activite', 30, 'device_measured', NULL, FALSE, 'phase2'),
  ('sleep_quality', 'Sommeil 7h+ mesuré', 
   'activite', 20, 'device_measured', 1, FALSE, 'phase2');

-- Règles de gain - Phase 'now' : jeux Zora (Sprint 4)
INSERT INTO zora_earn_rules 
  (action_type, label_fr, category, points, required_proof_class, 
   daily_cap, is_active, phase) VALUES
  ('game_scratch', 'Gain carte à gratter',
   'jeux', 30, 'system_event', 1, TRUE, 'now'),
  ('game_wheel', 'Gain roue de la fortune',
   'jeux', 50, 'system_event', 1, TRUE, 'now'),
  ('game_chest', 'Gain coffre mystère',
   'jeux', 75, 'system_event', 1, TRUE, 'now'),
  ('game_quiz', 'Gain quiz santé',
   'jeux', 40, 'system_event', 1, TRUE, 'now');

-- Ajouter le cap catégorie jeux
INSERT INTO zora_category_caps (category, cap_percent) VALUES 
  ('jeux', 15)
ON CONFLICT (category) DO NOTHING;
