-- 019_daily_movers.sql — Track C.
--
-- Stores one explained mover per trading day. Evidence is JSONB rather than a
-- child table: rows are always read whole (one card per stock), the volume is
-- ~10 rows a day, and nothing joins into it.

BEGIN;

CREATE TABLE IF NOT EXISTS daily_movers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_date       DATE NOT NULL,
    stock_code       VARCHAR(20) NOT NULL,
    stock_name       VARCHAR(100) NOT NULL,
    market           VARCHAR(10),                 -- KOSPI | KOSDAQ
    close_price      NUMERIC(18,2),
    change_pct       NUMERIC(8,2) NOT NULL,
    trading_value    BIGINT,
    value_ratio      NUMERIC(8,2),                -- vs previous session
    selection_score  NUMERIC(6,3),
    selection_reason VARCHAR(30),                 -- creator_pick | top_gainer | top_loser
    headline         VARCHAR(120),
    cause_type       VARCHAR(20),                 -- earnings|contract|...|unexplained
    summary          TEXT,
    confidence       VARCHAR(10),                 -- high | medium | low
    factors          JSONB NOT NULL DEFAULT '[]', -- [{type, description, evidence_refs}]
    evidence         JSONB NOT NULL DEFAULT '[]', -- [{n, type, summary, source_url, source_date}]
    creator_context  JSONB,                       -- {text, predictions:[...], sentiment_7d}
    investor_flow    JSONB,                       -- {foreign, institution}
    llm_model        VARCHAR(40),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (trade_date, stock_code)
);

CREATE INDEX IF NOT EXISTS idx_daily_movers_date ON daily_movers (trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_movers_code ON daily_movers (stock_code, trade_date DESC);

-- DART identifies companies by its own 8-digit code, not the ticker, so the
-- mapping is cached and refreshed weekly rather than fetched per lookup.
CREATE TABLE IF NOT EXISTS dart_corp_map (
    stock_code VARCHAR(6) PRIMARY KEY,
    corp_code  VARCHAR(8) NOT NULL,
    corp_name  VARCHAR(100),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
