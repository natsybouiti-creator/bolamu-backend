-- ============================================================
-- Migration 080 : Règles Zora manquantes pour Roue/Coffre/Quiz
-- Date : 12 juillet 2026
-- Audit du 12 juillet 2026 (chaîne complète du solde Zora après action
-- patient) : zora_earn_rules n'avait de ligne active que pour
-- action_type='game_scratch'. awardZora() rejette toute action sans
-- règle ('rule_unknown') — confirmé en conditions réelles : Roue,
-- Coffre et Quiz affichaient un gain (points_won > 0, zora_game_plays
-- enregistré) sans jamais créditer zora_ledger/zora_points (aucune
-- entrée game_wheel/game_chest/game_quiz historique trouvée en base).
--
-- Valeurs choisies : points = plafond de gain déjà configuré pour
-- chaque jeu dans zora_games.daily_gain_cap (wheel=50, chest=75,
-- quiz=40 — cohérent avec le prix maximum réel de zora_game_prizes
-- pour wheel/chest, et le score max 'difficile' pour quiz).
-- daily_cap=3, category='engagement', required_proof_class=
-- 'system_event' : identique à la règle game_scratch déjà active
-- (id=14), pour rester cohérent avec le seul précédent existant.
-- ============================================================

INSERT INTO zora_earn_rules (action_type, label_fr, category, points, required_proof_class, daily_cap, is_active, phase)
SELECT 'game_wheel', 'Partie de Roue', 'engagement', 50, 'system_event', 3, TRUE, 'now'
WHERE NOT EXISTS (SELECT 1 FROM zora_earn_rules WHERE action_type = 'game_wheel');

INSERT INTO zora_earn_rules (action_type, label_fr, category, points, required_proof_class, daily_cap, is_active, phase)
SELECT 'game_chest', 'Partie de Coffre', 'engagement', 75, 'system_event', 3, TRUE, 'now'
WHERE NOT EXISTS (SELECT 1 FROM zora_earn_rules WHERE action_type = 'game_chest');

INSERT INTO zora_earn_rules (action_type, label_fr, category, points, required_proof_class, daily_cap, is_active, phase)
SELECT 'game_quiz', 'Partie de Quiz', 'engagement', 40, 'system_event', 3, TRUE, 'now'
WHERE NOT EXISTS (SELECT 1 FROM zora_earn_rules WHERE action_type = 'game_quiz');
