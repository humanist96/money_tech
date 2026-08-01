-- 방향성 예측 시스템: is_accurate 기반 → direction 기반 전환
-- direction_1w/1m/3m: 각 구간별 방향 맞춤 여부
-- direction_score: 가중 평균 (1w:50%, 1m:30%, 3m:20%)

ALTER TABLE predictions ADD COLUMN IF NOT EXISTS direction_1w BOOLEAN;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS direction_1m BOOLEAN;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS direction_3m BOOLEAN;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS direction_score NUMERIC(4,3);

-- 기존 데이터 마이그레이션: is_accurate 기반 데이터를 direction으로 변환
-- buy 예측: 가격이 올랐으면 방향 맞춤
-- sell 예측: 가격이 내렸으면 방향 맞춤
-- hold 예측: direction 평가에서 제외 (NULL 유지)
UPDATE predictions SET
  direction_1w = CASE
    WHEN prediction_type = 'hold' THEN NULL
    WHEN prediction_type = 'buy' AND actual_price_after_1w > ma.price_at_mention THEN true
    WHEN prediction_type = 'sell' AND actual_price_after_1w < ma.price_at_mention THEN true
    WHEN actual_price_after_1w IS NOT NULL AND ma.price_at_mention IS NOT NULL THEN false
    ELSE NULL
  END,
  direction_1m = CASE
    WHEN prediction_type = 'hold' THEN NULL
    WHEN prediction_type = 'buy' AND actual_price_after_1m > ma.price_at_mention THEN true
    WHEN prediction_type = 'sell' AND actual_price_after_1m < ma.price_at_mention THEN true
    WHEN actual_price_after_1m IS NOT NULL AND ma.price_at_mention IS NOT NULL THEN false
    ELSE NULL
  END,
  direction_3m = CASE
    WHEN prediction_type = 'hold' THEN NULL
    WHEN prediction_type = 'buy' AND actual_price_after_3m > ma.price_at_mention THEN true
    WHEN prediction_type = 'sell' AND actual_price_after_3m < ma.price_at_mention THEN true
    WHEN actual_price_after_3m IS NOT NULL AND ma.price_at_mention IS NOT NULL THEN false
    ELSE NULL
  END
FROM mentioned_assets ma
WHERE predictions.mentioned_asset_id = ma.id
  AND predictions.prediction_type IN ('buy', 'sell');

-- direction_score 계산 (1w:50%, 1m:30%, 3m:20%)
UPDATE predictions SET
  direction_score = (
    COALESCE(direction_1w::int * 0.5, 0) +
    COALESCE(direction_1m::int * 0.3, 0) +
    COALESCE(direction_3m::int * 0.2, 0)
  ) / (
    CASE WHEN direction_1w IS NOT NULL THEN 0.5 ELSE 0 END +
    CASE WHEN direction_1m IS NOT NULL THEN 0.3 ELSE 0 END +
    CASE WHEN direction_3m IS NOT NULL THEN 0.2 ELSE 0 END
  )
WHERE direction_1w IS NOT NULL OR direction_1m IS NOT NULL OR direction_3m IS NOT NULL;
