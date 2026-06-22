-- Migration 038 : Ajouter règle game_scratch dans zora_earn_rules
-- Corrige l'erreur prod "[ZORA] Règle inconnue : game_scratch"
-- La règle est requise par awardZora() lors des parties de scratch Zora

INSERT INTO zora_earn_rules
  (action_type, label_fr, points, category, required_proof_class, daily_cap, is_active)
VALUES
  ('game_scratch', 'Partie de Scratch', 50, 'engagement', 'system_event', 3, true)
ON CONFLICT (action_type) DO NOTHING;
