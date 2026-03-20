CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT UNIQUE NOT NULL,
    watchlist JSONB DEFAULT '[]',
    followed_channels UUID[] DEFAULT '{}',
    notification_settings JSONB DEFAULT '{"buzz": true, "predictions": true, "hit_rate": true}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prefs_client ON user_preferences(client_id);
