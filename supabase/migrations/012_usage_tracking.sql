-- Usage tracking for freemium tier system
CREATE TABLE IF NOT EXISTS user_daily_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature VARCHAR(50) NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, feature, usage_date)
);

CREATE INDEX idx_user_daily_usage_user_date
  ON user_daily_usage (user_id, usage_date);

CREATE INDEX idx_user_daily_usage_lookup
  ON user_daily_usage (user_id, feature, usage_date);
