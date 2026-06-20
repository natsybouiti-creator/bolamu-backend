-- ============================================================
-- BOLAMU — Sprint 6A : Tables Leaderboard Hebdo + Streaks
-- ============================================================

-- Table leaderboard_weekly
CREATE TABLE IF NOT EXISTS leaderboard_weekly (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  week_start DATE NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  UNIQUE(phone, week_start)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_leaderboard_week 
  ON leaderboard_weekly (week_start, points_earned DESC);

-- Table user_streaks
CREATE TABLE IF NOT EXISTS user_streaks (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL REFERENCES users(phone),
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  UNIQUE(phone)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_user_streaks_phone 
  ON user_streaks (phone);
