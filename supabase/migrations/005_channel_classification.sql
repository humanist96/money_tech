-- 005_channel_classification.sql
-- 채널 유형 분류 필드 추가 (predictor, leader, analyst, media)

ALTER TABLE channels ADD COLUMN IF NOT EXISTS channel_type VARCHAR(20) DEFAULT 'unknown';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS prediction_intensity_score REAL DEFAULT 0;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS classification_updated_at TIMESTAMPTZ;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS classification_details JSONB;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_channels_pis ON channels(prediction_intensity_score DESC);

-- Manual override (takes precedence over auto-classification)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS channel_type_override VARCHAR(20);

COMMENT ON COLUMN channels.channel_type IS 'predictor=예측형, leader=리딩방, analyst=해설형, media=미디어, unknown=미분류';
COMMENT ON COLUMN channels.prediction_intensity_score IS 'PIS 0~100. Auto-calculated from video content analysis';
COMMENT ON COLUMN channels.channel_type_override IS 'Manual override for channel_type. If set, takes precedence over auto-classification';
