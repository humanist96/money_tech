-- Backfill of the unique index that ON CONFLICT in crawler/nlp_pipeline.py targets.
-- The index already exists on the live Neon DB (created out-of-band) but was never
-- captured as a migration, so fresh environments would fail with:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- Note: NULL mentioned_asset_id rows are still considered distinct by Postgres and
-- can therefore duplicate. The crawler always supplies a non-null id so this is fine
-- in practice; if that ever changes, switch to a partial index or NOT NULL constraint.

CREATE UNIQUE INDEX IF NOT EXISTS idx_predictions_unique
  ON predictions (video_id, mentioned_asset_id, prediction_type);
