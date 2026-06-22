-- Migration 037 : Ajouter question_id sur zora_game_plays
-- La colonne etait referencee par le service (SELECT, INSERT, JOIN)
-- mais absente du schema initial (migration_032).

ALTER TABLE zora_game_plays
  ADD COLUMN IF NOT EXISTS question_id INTEGER REFERENCES zora_quiz_questions(id);

CREATE INDEX IF NOT EXISTS idx_game_plays_question_id
  ON zora_game_plays (question_id);
