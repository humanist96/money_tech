-- 018_channel_stats.sql — Track B, step 3.
--
-- Replaces mv_hit_rate_leaderboard's raw average. Ranking on a bare hit rate
-- puts channels with five lucky calls above channels with fifty solid ones, so
-- the ranking key becomes the lower bound of the Wilson interval, which falls
-- automatically when the sample is small.
--
-- A plain table rather than a materialized view: the evaluator computes Wilson
-- bounds in Python, and a table can be UPSERTed per channel and inspected
-- mid-run.

BEGIN;

CREATE TABLE IF NOT EXISTS channel_stats (
    channel_id         UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    horizon            TEXT NOT NULL,        -- '1w' | '1m' | '3m'
    n_effective        INTEGER NOT NULL DEFAULT 0,  -- excludes push/duplicate/unevaluable
    n_hits             INTEGER NOT NULL DEFAULT 0,
    n_push             INTEGER NOT NULL DEFAULT 0,
    n_unevaluable      INTEGER NOT NULL DEFAULT 0,
    n_buy              INTEGER NOT NULL DEFAULT 0,
    n_sell             INTEGER NOT NULL DEFAULT 0,
    n_hold             INTEGER NOT NULL DEFAULT 0,
    hit_rate           NUMERIC,
    wilson_low         NUMERIC,
    wilson_high        NUMERIC,
    avg_excess_return  NUMERIC,
    excess_std         NUMERIC,              -- kept for information ratio; not shown yet
    evaluation_version SMALLINT NOT NULL DEFAULT 2,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (channel_id, horizon, evaluation_version)
);

CREATE INDEX IF NOT EXISTS idx_channel_stats_ranking
    ON channel_stats (horizon, evaluation_version, wilson_low DESC);

COMMIT;
