-- 007_new_platforms.sql
-- Add support for Telegram, Analyst Reports, and Naver Discussion Board

-- ============================================================
-- 1. Telegram fields
-- ============================================================
ALTER TABLE channels ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100);
ALTER TABLE channels ADD COLUMN IF NOT EXISTS telegram_channel_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_telegram_username
  ON channels(telegram_username) WHERE telegram_username IS NOT NULL;

ALTER TABLE videos ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_telegram_message
  ON videos(channel_id, telegram_message_id) WHERE telegram_message_id IS NOT NULL;

-- ============================================================
-- 2. Analyst Report fields
-- ============================================================
ALTER TABLE channels ADD COLUMN IF NOT EXISTS firm_code VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_firm_code
  ON channels(firm_code) WHERE firm_code IS NOT NULL;

ALTER TABLE videos ADD COLUMN IF NOT EXISTS report_url VARCHAR(500);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS analyst_name VARCHAR(100);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS firm_name VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_report_url
  ON videos(report_url) WHERE report_url IS NOT NULL;

-- predictions table extensions for analyst reports
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS previous_target_price REAL;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS confidence VARCHAR(20);

-- ============================================================
-- 3. Crowd Sentiment (Naver Discussion Board)
-- ============================================================
CREATE TABLE IF NOT EXISTS crowd_sentiment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_code VARCHAR(10) NOT NULL,
  stock_name VARCHAR(100) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_posts INTEGER NOT NULL DEFAULT 0,
  filtered_posts INTEGER NOT NULL DEFAULT 0,
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  neutral_count INTEGER NOT NULL DEFAULT 0,
  bullish_ratio REAL,
  sentiment_score REAL,
  top_keywords JSONB,
  sample_posts JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stock_code, period_start)
);

CREATE INDEX IF NOT EXISTS idx_crowd_sentiment_stock ON crowd_sentiment(stock_code);
CREATE INDEX IF NOT EXISTS idx_crowd_sentiment_period ON crowd_sentiment(period_start DESC);

CREATE TABLE IF NOT EXISTS crowd_crawl_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_code VARCHAR(10) NOT NULL,
  crawled_at TIMESTAMPTZ DEFAULT NOW(),
  pages_crawled INTEGER,
  posts_found INTEGER,
  posts_filtered INTEGER,
  status VARCHAR(20) DEFAULT 'success'
);
