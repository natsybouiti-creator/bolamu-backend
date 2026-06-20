-- ============================================================
-- BOLAMU — Sprint 4 : Seeds Jeux Zora
-- ============================================================

-- Jeux
INSERT INTO zora_games 
  (game_type, label_fr, daily_free_plays, 
   extra_play_cost, max_gain_per_play, daily_gain_cap) 
VALUES
  ('scratch', 'Carte à gratter', 1, 50, 30, 30),
  ('wheel',   'Roue de la fortune', 1, 75, 50, 50),
  ('chest',   'Coffre mystère', 1, 100, 75, 75),
  ('quiz',    'Quiz santé', 1, 30, 40, 40);

INSERT INTO zora_games_global_cap 
  (daily_total_cap, category_cap_percent) 
VALUES (100, 15);

-- Prix grattage (probabilités sur 1000)
INSERT INTO zora_game_prizes 
  (game_id, label_fr, points_value, probability) VALUES
  (1, 'Pas de gain', 0, 550),
  (1, '+5 Zora', 5, 250),
  (1, '+10 Zora', 10, 130),
  (1, '+20 Zora', 20, 60),
  (1, '+30 Zora', 30, 10);

-- Prix roue (probabilités sur 1000)
INSERT INTO zora_game_prizes 
  (game_id, label_fr, points_value, probability) VALUES
  (2, 'Pas de gain', 0, 400),
  (2, '+5 Zora', 5, 280),
  (2, '+15 Zora', 15, 180),
  (2, '+30 Zora', 30, 100),
  (2, '+50 Zora', 50, 40);

-- Prix coffre (probabilités sur 1000)
INSERT INTO zora_game_prizes 
  (game_id, label_fr, points_value, probability) VALUES
  (3, 'Pas de gain', 0, 300),
  (3, '+10 Zora', 10, 300),
  (3, '+25 Zora', 25, 250),
  (3, '+50 Zora', 50, 120),
  (3, '+75 Zora', 75, 30);

-- 20 questions quiz santé de base
INSERT INTO zora_quiz_questions 
  (question, option_a, option_b, option_c, option_d,
   correct_answer, category, difficulty) VALUES
  ('Combien de litres d''eau faut-il boire par jour ?',
   '1 litre', '1,5 à 2 litres', '3 litres', '4 litres',
   'b', 'sante', 'facile'),
  ('Quelle vitamine est produite par le soleil ?',
   'Vitamine A', 'Vitamine B12', 'Vitamine C', 'Vitamine D',
   'd', 'sante', 'facile'),
  ('Quel organe filtre le sang ?',
   'Le foie', 'Les reins', 'Le cœur', 'Les poumons',
   'b', 'sante', 'facile'),
  ('Combien de pas par jour est recommandé ?',
   '2 000', '5 000', '10 000', '20 000',
   'c', 'sante', 'facile'),
  ('Quelle est la tension artérielle normale ?',
   '100/60', '120/80', '140/90', '160/100',
   'b', 'sante', 'moyen'),
  ('Le paludisme est transmis par ?',
   'Un moustique', 'Un moucheron', 'Une mouche', 'Un pou',
   'a', 'sante', 'facile'),
  ('Quelle maladie est prévenue par le vaccin BCG ?',
   'La rougeole', 'La tuberculose', 
   'La polio', 'L''hépatite B',
   'b', 'sante', 'moyen'),
  ('Combien d''heures de sommeil pour un adulte ?',
   '4 à 5h', '5 à 6h', '7 à 9h', '10 à 12h',
   'c', 'sante', 'facile'),
  ('L''IMC normal se situe entre ?',
   '10 et 15', '18,5 et 24,9', '25 et 30', '30 et 35',
   'b', 'sante', 'moyen'),
  ('Quel aliment est riche en fer ?',
   'Le lait', 'Les épinards', 'Le pain blanc', 'Le sucre',
   'b', 'sante', 'facile'),
  ('Le cholestérol HDL est ?',
   'Le mauvais cholestérol', 'Le bon cholestérol',
   'Un sucre', 'Une protéine',
   'b', 'sante', 'moyen'),
  ('La fièvre est définie à partir de ?',
   '37°C', '37,5°C', '38°C', '39°C',
   'c', 'sante', 'facile'),
  ('Quel organe produit l''insuline ?',
   'Le foie', 'Le rein', 'Le pancréas', 'L''estomac',
   'c', 'sante', 'moyen'),
  ('Le VIH se transmet par ?',
   'La salive', 'Le sang et les fluides sexuels',
   'La toux', 'La poignée de main',
   'b', 'sante', 'facile'),
  ('Quelle vitamine prévient le scorbut ?',
   'Vitamine A', 'Vitamine B', 'Vitamine C', 'Vitamine D',
   'c', 'sante', 'moyen'),
  ('Le groupe sanguin O- est dit ?',
   'Donneur universel', 'Receveur universel',
   'Groupe rare', 'Groupe commun',
   'a', 'sante', 'difficile'),
  ('L''hypertension est définie à partir de ?',
   '120/80', '130/85', '140/90', '150/95',
   'c', 'sante', 'difficile'),
  ('Quelle est la durée d''incubation du paludisme ?',
   '1 à 2 jours', '7 à 14 jours',
   '30 jours', '3 mois',
   'b', 'sante', 'difficile'),
  ('Le zinc est important pour ?',
   'Les os', 'Le système immunitaire',
   'La vision', 'La digestion',
   'b', 'sante', 'moyen'),
  ('Combien de dents a un adulte ?',
   '28', '30', '32', '36',
   'c', 'sante', 'facile');
