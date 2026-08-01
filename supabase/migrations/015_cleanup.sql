-- 015_cleanup.sql — Phase A4 of the core-refocus cleanup.
--
-- Removes tables and columns whose producing pipelines were cut in Phase A1/A3,
-- and formalises columns that had been added to the live database out of band
-- (they existed in production but in no migration, so a fresh environment could
-- not be reproduced).
--
-- Dropped tables were exported to backups/ before this migration ran:
--   crowd_sentiment (9,980 rows), crowd_crawl_log (9,970 rows),
--   user_sessions (0), user_daily_usage (0)

BEGIN;

-- 1. Crowd/discussion pipeline (discussion_crawler + crowd_sentiment_analyzer, cut in A3)
DROP TABLE IF EXISTS crowd_sentiment CASCADE;
DROP TABLE IF EXISTS crowd_crawl_log CASCADE;

-- 2. Auth/billing leftovers
--    user_sessions: never referenced (NextAuth uses the JWT strategy)
--    user_daily_usage: fed the mock upgrade flow removed in Phase 0
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_daily_usage CASCADE;

-- 3. Dead columns on users — personalisation lives in user_preferences
ALTER TABLE users DROP COLUMN IF EXISTS watchlist;
ALTER TABLE users DROP COLUMN IF EXISTS followed_channels;

-- 4. Comment-analysis columns (comment_analyzer cut in A3).
--    crowd_accuracy measured agreement, not accuracy, and was hindsight-biased.
--    The leaderboard MV reads it, so rebuild the MV before dropping the columns.
DROP MATERIALIZED VIEW IF EXISTS mv_hit_rate_leaderboard;

CREATE MATERIALIZED VIEW mv_hit_rate_leaderboard AS
SELECT
    c.id                            AS channel_id,
    c.name                          AS channel_name,
    c.thumbnail_url                 AS channel_thumbnail,
    c.category,
    c.channel_type,
    c.prediction_intensity_score    AS pis,
    COUNT(*) FILTER (WHERE p.direction_score >= 0.5)::int   AS accurate_count,
    COUNT(*) FILTER (WHERE p.direction_score IS NOT NULL)::int AS total_predictions,
    COUNT(*)::int                                           AS all_predictions,
    CASE
        WHEN COUNT(*) FILTER (WHERE p.direction_score IS NOT NULL) > 0
        THEN AVG(p.direction_score)::float
        ELSE NULL::float
    END                                                     AS hit_rate
FROM predictions p
JOIN channels c ON p.channel_id = c.id
WHERE p.prediction_type = ANY (ARRAY['buy', 'sell'])
GROUP BY c.id, c.name, c.thumbnail_url, c.category, c.channel_type, c.prediction_intensity_score
HAVING COUNT(*) >= 1
ORDER BY COUNT(*) FILTER (WHERE p.direction_score IS NOT NULL) DESC,
         AVG(p.direction_score) DESC NULLS LAST;

CREATE UNIQUE INDEX IF NOT EXISTS mv_hit_rate_leaderboard_channel_idx
    ON mv_hit_rate_leaderboard (channel_id);

--    videos.comment_count stays: it is the YouTube API comment count, still
--    populated by the YouTube crawler.
ALTER TABLE predictions DROP COLUMN IF EXISTS crowd_accuracy;
ALTER TABLE videos DROP COLUMN IF EXISTS comment_sentiment_score;
ALTER TABLE videos DROP COLUMN IF EXISTS comments_analyzed_at;
ALTER TABLE videos DROP COLUMN IF EXISTS comment_positive_count;
ALTER TABLE videos DROP COLUMN IF EXISTS comment_negative_count;
ALTER TABLE videos DROP COLUMN IF EXISTS comment_neutral_count;
ALTER TABLE videos DROP COLUMN IF EXISTS comment_total_count;

-- 5. Retention for append-only tables so they cannot grow without bound.
CREATE OR REPLACE FUNCTION prune_log_tables() RETURNS void AS $$
BEGIN
    DELETE FROM api_usage_log WHERE created_at < NOW() - INTERVAL '90 days';
    DELETE FROM search_cache  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

COMMIT;
