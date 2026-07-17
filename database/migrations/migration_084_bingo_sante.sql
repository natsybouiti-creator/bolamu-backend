-- ============================================================
-- Migration 084 : Bingo Santé — 5e jeu Zora
-- Date : 17 juillet 2026
--
-- Contexte : le Bingo Santé est teasé côté frontend (badge "Bientôt")
-- depuis le chantier vaccination. Ce chantier le rend jouable.
--
-- Contrairement aux 4 jeux existants (scratch/wheel/chest/quiz), le
-- Bingo est une grille 5x5 PERSISTANTE sur une semaine (reset le lundi),
-- pas un tirage répétable jour par jour. Il ne passe donc PAS par
-- playGame()/checkDailyPlays() (câblés en dur sur "aujourd'hui", et la
-- route POST /games/play valide game_type contre une liste fermée qui
-- n'inclut pas 'bingo') — le reset hebdomadaire est géré entièrement
-- par le service bingo dédié, via bingo_grids.week_start. Zéro
-- modification des fichiers partagés par les 4 jeux existants.
--
-- Les lignes zora_games/zora_game_prizes ci-dessous servent de
-- catalogue/référence (cohérence avec les 4 jeux existants, valeurs de
-- configuration) mais ne sont PAS lues par un tirage pondéré comme pour
-- scratch/wheel/chest — les récompenses du Bingo sont déterministes
-- (ligne/colonne/diagonale/grille complétée), jamais aléatoires.
-- `probability` est donc inerte ici (mis à 0 sur les 4 lignes).
--
-- extra_play_cost=30 : coût pour régénérer/reroll la grille de la
-- semaine avant son reset naturel (perd la progression de la grille
-- actuelle) — décision actée le 17 juillet 2026.
--
-- category='game' (zora_earn_rules) — distinct de 'engagement' utilisé
-- par les 4 jeux existants (décision explicite de ce chantier). Aucune
-- ligne zora_category_caps n'existe pour 'game' à ce jour : le plafond
-- catégorie d'awardZora() ne s'applique donc jamais aux crédits Bingo
-- (comportement no-op, pas un bug).
--
-- ATTENTION connue : daily_cap=1 sur zora_earn_rules limite awardZora()
-- à 1 seul crédit game_bingo par jour civil, tous types de récompense
-- confondus (ligne/colonne/diagonale/bingo complet). Si un patient
-- complète 2 lignes le même jour, seule la première est créditée — la
-- seconde échoue silencieusement (reason='daily_cap_reached', déjà géré
-- sans erreur visible côté joueur, comme pour les 4 autres jeux). Valeur
-- actée explicitement pour ce chantier — à revoir si ce cas s'avère
-- fréquent en usage réel.
-- ============================================================

-- ---- zora_games : catalogue ----
INSERT INTO zora_games (game_type, label_fr, daily_free_plays, extra_play_cost, max_gain_per_play, daily_gain_cap, is_active)
SELECT 'bingo', 'Bingo Santé', 1, 30, 100, 100, TRUE
WHERE NOT EXISTS (SELECT 1 FROM zora_games WHERE game_type = 'bingo');

-- ---- zora_game_prizes : catalogue des lots (référence, pas de tirage) ----
INSERT INTO zora_game_prizes (game_id, label_fr, points_value, probability, is_active)
SELECT g.id, 'Ligne ou colonne complète', 15, 0, TRUE
FROM zora_games g WHERE g.game_type = 'bingo'
  AND NOT EXISTS (SELECT 1 FROM zora_game_prizes p WHERE p.game_id = g.id AND p.points_value = 15);

INSERT INTO zora_game_prizes (game_id, label_fr, points_value, probability, is_active)
SELECT g.id, 'Diagonale complète', 20, 0, TRUE
FROM zora_games g WHERE g.game_type = 'bingo'
  AND NOT EXISTS (SELECT 1 FROM zora_game_prizes p WHERE p.game_id = g.id AND p.points_value = 20);

INSERT INTO zora_game_prizes (game_id, label_fr, points_value, probability, is_active)
SELECT g.id, 'Grille complète (Bingo)', 100, 0, TRUE
FROM zora_games g WHERE g.game_type = 'bingo'
  AND NOT EXISTS (SELECT 1 FROM zora_game_prizes p WHERE p.game_id = g.id AND p.points_value = 100);

INSERT INTO zora_game_prizes (game_id, label_fr, points_value, probability, is_active)
SELECT g.id, 'Aucune complétion', 0, 0, TRUE
FROM zora_games g WHERE g.game_type = 'bingo'
  AND NOT EXISTS (SELECT 1 FROM zora_game_prizes p WHERE p.game_id = g.id AND p.points_value = 0);

-- ---- zora_earn_rules : règle de crédit (points=100 = valeur max, override_points utilisé au crédit réel) ----
INSERT INTO zora_earn_rules (action_type, label_fr, category, points, required_proof_class, daily_cap, is_active, phase)
SELECT 'game_bingo', 'Bingo Santé', 'game', 100, 'system_event', 1, TRUE, 'now'
WHERE NOT EXISTS (SELECT 1 FROM zora_earn_rules WHERE action_type = 'game_bingo');

-- ---- bingo_actions : banque d'actions santé (25 tirées aléatoirement par grille) ----
CREATE TABLE IF NOT EXISTS bingo_actions (
  id SERIAL PRIMARY KEY,
  action VARCHAR(200) NOT NULL,
  pilier VARCHAR(30) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO bingo_actions (action, pilier)
SELECT * FROM (VALUES
  ('Boire 2L d''eau', 'Hydratation'),
  ('Boire un verre d''eau au réveil', 'Hydratation'),
  ('Éviter les sodas toute la journée', 'Hydratation'),
  ('Boire une tisane le soir', 'Hydratation'),
  ('Remplacer un soda par de l''eau', 'Hydratation'),
  ('Boire de l''eau avant chaque repas', 'Hydratation'),
  ('Emporter une bouteille d''eau au travail', 'Hydratation'),
  ('Boire un jus de fruit frais (sans sucre ajouté)', 'Hydratation'),
  ('Marcher 30 minutes', 'Activité'),
  ('Faire 10 min de stretching', 'Activité'),
  ('Prendre les escaliers plutôt que l''ascenseur', 'Activité'),
  ('Faire 20 pompes ou squats', 'Activité'),
  ('Marcher au lieu de prendre un taxi-moto sur un trajet court', 'Activité'),
  ('Faire une séance de 15 min de sport à la maison', 'Activité'),
  ('Danser 15 minutes', 'Activité'),
  ('Faire une marche rapide de 20 minutes', 'Activité'),
  ('Étirer le dos et les épaules 5 minutes', 'Activité'),
  ('Faire du vélo 20 minutes', 'Activité'),
  ('Manger un fruit', 'Nutrition'),
  ('Manger des légumes à chaque repas', 'Nutrition'),
  ('Éviter la friture aujourd''hui', 'Nutrition'),
  ('Réduire le sucre dans le café/thé', 'Nutrition'),
  ('Manger un repas fait maison', 'Nutrition'),
  ('Ajouter des légumes verts au dîner', 'Nutrition'),
  ('Éviter le grignotage entre les repas', 'Nutrition'),
  ('Manger du poisson au lieu de la viande rouge', 'Nutrition'),
  ('Préparer une salade fraîche', 'Nutrition'),
  ('Réduire le sel dans un plat', 'Nutrition'),
  ('Dormir 7h cette nuit', 'Sommeil'),
  ('Se coucher avant 22h30', 'Sommeil'),
  ('Éviter les écrans 30 min avant de dormir', 'Sommeil'),
  ('Faire une sieste de 20 minutes', 'Sommeil'),
  ('Se lever à heure fixe ce matin', 'Sommeil'),
  ('Dormir sans bruit ni lumière parasite', 'Sommeil'),
  ('Éviter le café après 16h', 'Sommeil'),
  ('Noter son heure de coucher et de réveil', 'Sommeil'),
  ('Faire 5 minutes de respiration profonde', 'Bien-être'),
  ('Prendre un moment sans téléphone', 'Bien-être'),
  ('Appeler un proche pour prendre des nouvelles', 'Bien-être'),
  ('Noter 3 choses positives de la journée', 'Bien-être'),
  ('Passer du temps dehors au soleil', 'Bien-être'),
  ('Faire une activité qui fait plaisir sans écran', 'Bien-être'),
  ('Prendre 10 minutes pour méditer', 'Bien-être'),
  ('Rire avec quelqu''un aujourd''hui', 'Bien-être'),
  ('Ranger un espace de vie 10 minutes', 'Bien-être'),
  ('Prendre ses constantes (tension, poids)', 'Bien-être'),
  ('Faire une pause de 5 minutes toutes les 2h de travail', 'Bien-être'),
  ('Se laver les mains régulièrement toute la journée', 'Bien-être'),
  ('Écrire un objectif santé pour la semaine', 'Bien-être'),
  ('Prendre l''air 10 minutes en pleine journée', 'Bien-être')
) AS v(action, pilier)
WHERE NOT EXISTS (SELECT 1 FROM bingo_actions LIMIT 1);

-- ---- bingo_grids : une grille par patient par semaine ----
CREATE TABLE IF NOT EXISTS bingo_grids (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  week_start DATE NOT NULL,
  grid JSONB NOT NULL,
  checked JSONB NOT NULL DEFAULT '[]'::jsonb,
  lines_rewarded JSONB NOT NULL DEFAULT '[]'::jsonb,
  bingo_rewarded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (phone, week_start)
);

CREATE INDEX IF NOT EXISTS idx_bingo_grids_phone_week ON bingo_grids (phone, week_start);
