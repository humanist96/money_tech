-- 021_predictions_hedge_guard.sql — Act phase, gap G5.
--
-- The 014 constraint keyed on (video_id, mentioned_asset_id, prediction_type),
-- which permits one video to hold both a buy and a sell on the same asset. That
-- is hedging, not a prediction, and it inflates hit rate: one of the two is
-- always right.
--
-- Must ship together with the nlp_pipeline change to a bare `ON CONFLICT DO
-- NOTHING`. The old clause names the 014 columns, so a violation of this new
-- index would not be caught by it and would abort the whole crawl job.

BEGIN;

-- Resolve existing violations by keeping the most recent call per (video, asset).
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY video_id, mentioned_asset_id
               ORDER BY predicted_at DESC NULLS LAST, created_at DESC
           ) AS rn
    FROM predictions
    WHERE NOT is_duplicate
)
UPDATE predictions p
SET is_duplicate = TRUE
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

-- Partial: superseded rows stay queryable for display, they just cannot be a
-- second live call on the same asset in the same piece of content.
CREATE UNIQUE INDEX IF NOT EXISTS predictions_video_asset_live_uniq
    ON predictions (video_id, mentioned_asset_id)
    WHERE NOT is_duplicate;

COMMIT;
