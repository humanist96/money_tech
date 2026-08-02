-- 020_channel_stats_btc_share.sql — Act phase, gap G2.
--
-- BTC is scored on absolute return while every other asset is scored against a
-- benchmark, so one leaderboard mixes two different null hypotheses. The plan
-- required surfacing how much of a channel's record rests on BTC rather than
-- hiding the mixture; this stores the count so the UI can show it.

BEGIN;

ALTER TABLE channel_stats ADD COLUMN IF NOT EXISTS n_absolute INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN channel_stats.n_absolute IS
    'Effective sample judged on absolute return (BTC) rather than vs a benchmark';

COMMIT;
