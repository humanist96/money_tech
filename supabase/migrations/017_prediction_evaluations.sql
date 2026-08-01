-- 017_prediction_evaluations.sql — Track B, step 2.
--
-- Evaluation results move out of predictions' widening column list into one row
-- per (prediction, horizon). Keeping evaluation_version on each row means a
-- change to the scoring rules can never silently overwrite values produced by
-- the previous definition (which is exactly how the old 0% and ±3% thresholds
-- ended up mixed in one is_accurate column).

BEGIN;

CREATE TABLE IF NOT EXISTS prediction_evaluations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id      UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
    horizon            TEXT NOT NULL,        -- '1w' | '1m' | '3m'
    eval_date          DATE,                 -- date of the price actually used
    price_t0           NUMERIC,
    price_th           NUMERIC,
    asset_return       NUMERIC,
    benchmark_code     TEXT,                 -- NULL = judged on absolute return
    benchmark_return   NUMERIC,
    excess_return      NUMERIC,
    outcome            TEXT NOT NULL,        -- 'hit' | 'miss' | 'push' | 'unevaluable'
    unevaluable_reason TEXT,
    evaluation_version SMALLINT NOT NULL DEFAULT 2,
    evaluated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (prediction_id, horizon, evaluation_version)
);

CREATE INDEX IF NOT EXISTS idx_prediction_evaluations_outcome
    ON prediction_evaluations (horizon, evaluation_version, outcome);

-- Which detector produced a prediction, so precision can be tracked per path.
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS detection_method TEXT;  -- 'keyword'|'llm'|'report'

-- Repeat calls on the same asset are one bet, not many: counting each mention
-- inflates the effective sample and understates variance.
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN NOT NULL DEFAULT FALSE;

-- Makes skipped predictions countable instead of silently absent.
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS evaluation_status TEXT NOT NULL DEFAULT 'pending';
    -- 'pending'|'evaluated'|'no_price_source'|'delisted'|'contradictory'

-- Preserve the look-ahead-contaminated values until the backfill is verified.
ALTER TABLE mentioned_assets ADD COLUMN IF NOT EXISTS price_at_mention_v1 REAL;

CREATE INDEX IF NOT EXISTS idx_predictions_evaluation_status
    ON predictions (evaluation_status) WHERE NOT is_duplicate;

-- Manual sampling of detector output; the source of truth for precision.
CREATE TABLE IF NOT EXISTS detection_audit (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id    UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
    detection_method TEXT NOT NULL,
    label            TEXT NOT NULL,  -- 'correct'|'wrong_direction'|'not_a_prediction'|'wrong_asset'
    note             TEXT,
    audited_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (prediction_id)
);

COMMIT;
