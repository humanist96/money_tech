-- Asset price history for prediction evaluation
CREATE TABLE IF NOT EXISTS asset_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'coin')),
  price REAL NOT NULL,
  recorded_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_code, recorded_date)
);

CREATE INDEX IF NOT EXISTS idx_asset_prices_code ON asset_prices(asset_code);
CREATE INDEX IF NOT EXISTS idx_asset_prices_date ON asset_prices(recorded_date DESC);
