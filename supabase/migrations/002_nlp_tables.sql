-- Add new fields to channels
ALTER TABLE channels ADD COLUMN IF NOT EXISTS trust_score REAL;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS hit_rate REAL;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS upload_frequency TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS last_crawled_at TIMESTAMPTZ;

-- Add summary field to videos
ALTER TABLE videos ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add sentiment_distribution to daily_stats
ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS sentiment_distribution JSONB;

-- 언급된 자산 (종목/코인/부동산)
CREATE TABLE IF NOT EXISTS mentioned_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'coin', 'real_estate')),
  asset_name TEXT NOT NULL,
  asset_code TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  context_text TEXT,
  mentioned_at INTEGER, -- seconds into video
  price_at_mention REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 예측/추천 기록
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  mentioned_asset_id UUID REFERENCES mentioned_assets(id) ON DELETE SET NULL,
  prediction_type TEXT CHECK (prediction_type IN ('buy', 'sell', 'hold')),
  target_price REAL,
  reason TEXT,
  predicted_at TIMESTAMPTZ,
  evaluation_date DATE,
  actual_price_after_1w REAL,
  actual_price_after_1m REAL,
  actual_price_after_3m REAL,
  is_accurate BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mentioned_assets_video ON mentioned_assets(video_id);
CREATE INDEX IF NOT EXISTS idx_mentioned_assets_name ON mentioned_assets(asset_name);
CREATE INDEX IF NOT EXISTS idx_mentioned_assets_type ON mentioned_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_predictions_channel ON predictions(channel_id);
CREATE INDEX IF NOT EXISTS idx_predictions_asset ON predictions(mentioned_asset_id);

-- RLS policies
ALTER TABLE mentioned_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentioned_assets_read_all" ON mentioned_assets FOR SELECT USING (true);
CREATE POLICY "predictions_read_all" ON predictions FOR SELECT USING (true);
CREATE POLICY "mentioned_assets_insert" ON mentioned_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "mentioned_assets_update" ON mentioned_assets FOR UPDATE USING (true);
CREATE POLICY "predictions_insert" ON predictions FOR INSERT WITH CHECK (true);
CREATE POLICY "predictions_update" ON predictions FOR UPDATE USING (true);
