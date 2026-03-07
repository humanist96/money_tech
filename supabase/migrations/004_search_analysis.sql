-- Video analysis cache (AI analysis results)
CREATE TABLE IF NOT EXISTS video_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youtube_video_id TEXT UNIQUE NOT NULL,
    title TEXT,
    channel_name TEXT,
    channel_id TEXT,
    summary TEXT,
    sentiment TEXT,
    mentioned_assets JSONB DEFAULT '[]',
    predictions JSONB DEFAULT '[]',
    key_points JSONB DEFAULT '[]',
    source_text TEXT,
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_analysis_vid ON video_analysis(youtube_video_id);

-- Search results cache (1 hour TTL)
CREATE TABLE IF NOT EXISTS search_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT NOT NULL,
    sort_by TEXT NOT NULL DEFAULT 'relevance',
    results JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX IF NOT EXISTS idx_search_cache_keyword ON search_cache(keyword, sort_by);
