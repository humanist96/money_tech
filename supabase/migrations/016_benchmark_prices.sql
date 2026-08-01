-- 016_benchmark_prices.sql — Track B, step 1.
--
-- Hit rate is currently measured against a 0% threshold, so any upward drift in
-- the market counts as a correct call. Storing benchmark closes lets the
-- evaluator judge predictions on excess return instead.

BEGIN;

CREATE TABLE IF NOT EXISTS benchmark_prices (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benchmark_code TEXT NOT NULL,          -- 'KOSPI' | 'KOSDAQ' | 'BTC'
    close_price    NUMERIC NOT NULL,
    recorded_date  DATE NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (benchmark_code, recorded_date)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_prices_lookup
    ON benchmark_prices (benchmark_code, recorded_date DESC);

-- Delisted / suspended tickers stop returning quotes. Marking them lets the
-- evaluator score them as resolved outcomes instead of dropping them, which
-- would bias hit rate upward by removing the worst outcomes for buy calls.
ALTER TABLE asset_dictionary ADD COLUMN IF NOT EXISTS is_delisted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE asset_dictionary ADD COLUMN IF NOT EXISTS delisted_at DATE;

-- asset_prices is the only point-in-time price source for evaluation, so it
-- needs a fast (code, date) lookup.
CREATE INDEX IF NOT EXISTS idx_asset_prices_lookup
    ON asset_prices (asset_code, recorded_date DESC);

COMMIT;
