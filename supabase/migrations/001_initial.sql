-- MoneyTech MVP: Initial Schema

-- 채널
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_channel_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('stock', 'coin', 'real_estate', 'economy')),
  subscriber_count INTEGER,
  total_view_count BIGINT,
  video_count INTEGER,
  thumbnail_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 영상
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  youtube_video_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  view_count INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  duration INTEGER,
  published_at TIMESTAMPTZ,
  thumbnail_url TEXT,
  tags TEXT[],
  subtitle_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 일별 트렌드 집계
CREATE TABLE daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('stock', 'coin', 'real_estate', 'economy')),
  total_videos INTEGER,
  top_channels JSONB,
  top_keywords JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, category)
);

-- 인덱스
CREATE INDEX idx_channels_category ON channels(category);
CREATE INDEX idx_videos_channel_id ON videos(channel_id);
CREATE INDEX idx_videos_published_at ON videos(published_at DESC);
CREATE INDEX idx_videos_youtube_video_id ON videos(youtube_video_id);
CREATE INDEX idx_daily_stats_date ON daily_stats(date DESC);

-- RLS (읽기 전용 공개)
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channels_read_all" ON channels FOR SELECT USING (true);
CREATE POLICY "videos_read_all" ON videos FOR SELECT USING (true);
CREATE POLICY "daily_stats_read_all" ON daily_stats FOR SELECT USING (true);

-- service_role은 모든 작업 가능 (크롤러용)
CREATE POLICY "channels_insert_service" ON channels FOR INSERT WITH CHECK (true);
CREATE POLICY "channels_update_service" ON channels FOR UPDATE USING (true);
CREATE POLICY "videos_insert_service" ON videos FOR INSERT WITH CHECK (true);
CREATE POLICY "videos_update_service" ON videos FOR UPDATE USING (true);
CREATE POLICY "daily_stats_insert_service" ON daily_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "daily_stats_update_service" ON daily_stats FOR UPDATE USING (true);
