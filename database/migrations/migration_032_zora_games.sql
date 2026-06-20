-- ============================================================
-- BOLAMU — Sprint 4 : Migration Jeux Zora
-- ============================================================

-- Configuration des jeux
CREATE TABLE IF NOT EXISTS zora_games (
  id SERIAL PRIMARY KEY,
  game_type VARCHAR(30) UNIQUE NOT NULL,
  -- scratch | wheel | chest | quiz
  label_fr VARCHAR(60) NOT NULL,
  daily_free_plays INTEGER NOT NULL DEFAULT 1,
  extra_play_cost INTEGER NOT NULL,
  -- Zora pour débloquer une partie supp
  max_gain_per_play INTEGER NOT NULL,
  -- gain max par partie
  daily_gain_cap INTEGER NOT NULL,
  -- gain max/jour pour ce jeu
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Catalogue des prix possibles par jeu
CREATE TABLE IF NOT EXISTS zora_game_prizes (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES zora_games(id),
  label_fr VARCHAR(60) NOT NULL,
  points_value INTEGER NOT NULL,
  -- 0 = pas de gain
  probability INTEGER NOT NULL,
  -- sur 1000 (ex: 100 = 10%)
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Historique des parties jouées
CREATE TABLE IF NOT EXISTS zora_game_plays (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  game_id INTEGER NOT NULL REFERENCES zora_games(id),
  play_type VARCHAR(20) NOT NULL DEFAULT 'free',
  -- free | paid
  cost_paid INTEGER NOT NULL DEFAULT 0,
  -- Zora dépensés pour débloquer
  prize_id INTEGER REFERENCES zora_game_prizes(id),
  points_won INTEGER NOT NULL DEFAULT 0,
  server_seed VARCHAR(64) NOT NULL,
  -- graine serveur pour audit
  played_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_game_plays_phone 
  ON zora_game_plays (phone);
CREATE INDEX idx_game_plays_daily 
  ON zora_game_plays (phone, game_id, played_at);
-- Idempotence : une partie = un résultat unique
CREATE UNIQUE INDEX uq_game_play_session 
  ON zora_game_plays (phone, game_id, server_seed);

-- Plafond global jeux
CREATE TABLE IF NOT EXISTS zora_games_global_cap (
  id SERIAL PRIMARY KEY,
  daily_total_cap INTEGER NOT NULL DEFAULT 100,
  -- max Zora/jour tous jeux confondus
  category_cap_percent INTEGER NOT NULL DEFAULT 15
  -- max % du total_earned global
);

-- Quiz : banque de questions
CREATE TABLE IF NOT EXISTS zora_quiz_questions (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  option_a VARCHAR(200) NOT NULL,
  option_b VARCHAR(200) NOT NULL,
  option_c VARCHAR(200) NOT NULL,
  option_d VARCHAR(200) NOT NULL,
  correct_answer CHAR(1) NOT NULL,
  -- a | b | c | d
  category VARCHAR(30) NOT NULL DEFAULT 'sante',
  difficulty VARCHAR(10) NOT NULL DEFAULT 'facile',
  -- facile | moyen | difficile
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_quiz_questions_category 
  ON zora_quiz_questions (category);
CREATE INDEX idx_quiz_questions_difficulty 
  ON zora_quiz_questions (difficulty);
