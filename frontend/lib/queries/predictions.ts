import { getDb } from '../db'
import type {
  PredictionFeedItem, HitRateLeaderboardItem,
  WeeklyReportItem, ConsensusTimelineEntry,
  ActivePrediction, Horizon, SkillGrade,
} from '../types'

// Recent Predictions Feed (deduplicated, v2 evaluation outcomes)
export async function getRecentPredictions(limit = 20): Promise<PredictionFeedItem[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT DISTINCT ON (c.name, ma.asset_name, p.prediction_type, p.predicted_at::date)
      p.id,
      c.name AS channel_name,
      c.thumbnail_url AS channel_thumbnail,
      c.category AS channel_category,
      COALESCE(ma.asset_name, '(미지정)') AS asset_name,
      ma.asset_code,
      p.prediction_type,
      p.reason,
      p.predicted_at,
      pe1w.outcome AS outcome_1w,
      pe1m.outcome AS outcome_1m,
      pe3m.outcome AS outcome_3m,
      pe1m.excess_return::float AS excess_return_1m
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    LEFT JOIN prediction_evaluations pe1w
           ON pe1w.prediction_id = p.id AND pe1w.horizon = '1w' AND pe1w.evaluation_version = 2
    LEFT JOIN prediction_evaluations pe1m
           ON pe1m.prediction_id = p.id AND pe1m.horizon = '1m' AND pe1m.evaluation_version = 2
    LEFT JOIN prediction_evaluations pe3m
           ON pe3m.prediction_id = p.id AND pe3m.horizon = '3m' AND pe3m.evaluation_version = 2
    WHERE p.prediction_type IN ('buy', 'sell')
      AND (ma.asset_type IS NULL OR ma.asset_type IN ('stock', 'coin'))
      AND c.is_active
    ORDER BY c.name, ma.asset_name, p.prediction_type, p.predicted_at::date, p.predicted_at DESC
  `
  const sorted = (rows as PredictionFeedItem[])
    .sort((a, b) => new Date(b.predicted_at ?? 0).getTime() - new Date(a.predicted_at ?? 0).getTime())
    .slice(0, limit)
  return sorted
}

/** Sample below which a record is reported as "under evaluation". */
export const MIN_SAMPLE_FOR_RANKING = 10

// Hit Rate Leaderboard
// Reads channel_stats, which the evaluator writes with benchmark-adjusted
// outcomes and Wilson bounds. Ranking uses the interval's lower bound so a
// short lucky streak cannot outrank a long consistent record.
export async function getHitRateLeaderboard(
  horizon: Horizon = '1m'
): Promise<HitRateLeaderboardItem[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      c.id AS channel_id,
      c.name AS channel_name,
      c.thumbnail_url AS channel_thumbnail,
      c.category,
      c.channel_type,
      c.prediction_intensity_score AS pis,
      cs.horizon,
      cs.hit_rate::float,
      cs.wilson_low::float,
      cs.wilson_high::float,
      cs.n_effective,
      cs.n_hits,
      cs.n_push,
      cs.n_unevaluable,
      cs.n_buy,
      cs.n_sell,
      cs.n_hold,
      cs.avg_excess_return::float,
      (SELECT COUNT(*)::int FROM predictions p2 WHERE p2.channel_id = c.id) AS all_predictions,
      -- 계획 §3.2: BTC는 절대수익 판정이라 척도가 섞이므로 비중을 표기해 가시화
      btc.share::float AS btc_share,
      COALESCE(recent.predictions, '[]'::json) AS recent_predictions
    FROM channel_stats cs
    JOIN channels c ON c.id = cs.channel_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE ma3.asset_code = 'BTC')::float / NULLIF(COUNT(*), 0) AS share
      FROM predictions p3
      LEFT JOIN mentioned_assets ma3 ON p3.mentioned_asset_id = ma3.id
      WHERE p3.channel_id = c.id
        AND NOT p3.is_duplicate
        AND p3.prediction_type IN ('buy', 'sell', 'hold')
    ) btc ON TRUE
    LEFT JOIN LATERAL (
      SELECT json_agg(p_recent) AS predictions
      FROM (
        SELECT p.prediction_type, ma.asset_name,
               pe.outcome, pe.excess_return::float
        FROM predictions p
        LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
        LEFT JOIN prediction_evaluations pe
               ON pe.prediction_id = p.id
              AND pe.horizon = ${horizon}
              AND pe.evaluation_version = 2
        WHERE p.channel_id = c.id
          AND NOT p.is_duplicate
          AND p.prediction_type IN ('buy', 'sell', 'hold')
        ORDER BY p.predicted_at DESC NULLS LAST
        LIMIT 5
      ) p_recent
    ) recent ON TRUE
    WHERE cs.horizon = ${horizon}
      AND cs.evaluation_version = 2
      AND c.is_active
      -- Below this the interval is too wide to rank on; those channels are
      -- reachable from the channel list, just not ranked against the others.
      AND cs.n_effective >= ${MIN_SAMPLE_FOR_RANKING}
    ORDER BY cs.wilson_low DESC NULLS LAST, cs.n_effective DESC
  `

  return (rows as any[]).map((r) => ({
    ...r,
    hit_rate: r.hit_rate ?? null,
    grade: gradeChannel(r.n_effective, r.wilson_low, r.wilson_high),
    recent_predictions: r.recent_predictions ?? [],
  })) as HitRateLeaderboardItem[]
}

/**
 * Translates the interval into a claim we can defend.
 * The whole interval must sit on one side of 50% before calling a channel
 * better or worse than the market; otherwise the record is consistent with
 * chance and says so.
 */
function gradeChannel(
  nEffective: number,
  wilsonLow: number | null,
  wilsonHigh: number | null
): SkillGrade {
  if (nEffective < MIN_SAMPLE_FOR_RANKING || wilsonLow == null || wilsonHigh == null) {
    return 'insufficient'
  }
  if (wilsonLow > 0.5) return 'beats_market'
  if (wilsonHigh < 0.5) return 'below_market'
  return 'market_level'
}

// Weekly Winner/Loser Report
// Ranks channels by v2 1-week outcomes from the most recent 7-day window of
// *confirmed evaluations* (anchored at MAX(eval_date), not today — the
// evaluation pipeline can trail the calendar when price history lags, and a
// hard NOW()-7d window would then render an empty panel forever). The window
// dates are returned so the UI can label the period honestly. The old version
// averaged the retired direction_score over predictions made in the last
// 7 days, most of which could not have been evaluated yet.
export async function getWeeklyReport(): Promise<{
  winners: WeeklyReportItem[]; losers: WeeklyReportItem[]; bestCall: any; worstCall: any
  periodStart: string | null; periodEnd: string | null
}> {
  const sql = getDb()
  const anchorRows = await sql`
    SELECT MAX(pe.eval_date)::date::text AS period_end,
           (MAX(pe.eval_date)::date - 6)::text AS period_start
    FROM prediction_evaluations pe
    WHERE pe.horizon = '1w' AND pe.evaluation_version = 2 AND pe.outcome IN ('hit', 'miss')
  `
  const periodEnd: string | null = (anchorRows[0] as any)?.period_end ?? null
  const periodStart: string | null = (anchorRows[0] as any)?.period_start ?? null
  if (!periodEnd) {
    return { winners: [], losers: [], bestCall: null, worstCall: null, periodStart: null, periodEnd: null }
  }

  const rows = await sql`
    SELECT
      c.id AS channel_id,
      c.name AS channel_name,
      c.thumbnail_url AS channel_thumbnail,
      c.category,
      COUNT(CASE WHEN pe.outcome = 'hit' THEN 1 END)::int AS accurate_count,
      COUNT(*)::int AS total_count,
      (COUNT(CASE WHEN pe.outcome = 'hit' THEN 1 END)::float / COUNT(*) * 100) AS accuracy_pct
    FROM prediction_evaluations pe
    JOIN predictions p ON p.id = pe.prediction_id
    JOIN channels c ON p.channel_id = c.id
    WHERE pe.horizon = '1w'
      AND pe.evaluation_version = 2
      AND pe.outcome IN ('hit', 'miss')
      AND pe.eval_date >= ${periodStart}::date
      AND pe.eval_date <= ${periodEnd}::date
      AND p.prediction_type IN ('buy', 'sell')
      AND c.is_active
    GROUP BY c.id, c.name, c.thumbnail_url, c.category
    ORDER BY accuracy_pct DESC, total_count DESC
  `

  const all = (rows as any[]).map(r => ({
    channel_id: r.channel_id,
    channel_name: r.channel_name,
    channel_thumbnail: r.channel_thumbnail,
    category: r.category,
    accurate_count: r.accurate_count,
    total_count: r.total_count,
    accuracy_pct: Math.round(Number(r.accuracy_pct) * 10) / 10,
    best_call: null,
    worst_call: null,
  }))

  // Directional quality: excess return for a buy, its negation for a sell —
  // reported as benchmark-relative % so the number matches the leaderboard.
  const callRows = await sql`
    SELECT
      c.name AS channel_name,
      ma.asset_name,
      p.prediction_type,
      (CASE WHEN p.prediction_type = 'sell' THEN -pe.excess_return ELSE pe.excess_return END * 100)::float AS return_pct
    FROM prediction_evaluations pe
    JOIN predictions p ON p.id = pe.prediction_id
    JOIN channels c ON p.channel_id = c.id
    JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE pe.horizon = '1w'
      AND pe.evaluation_version = 2
      AND pe.outcome IN ('hit', 'miss')
      AND pe.excess_return IS NOT NULL
      AND pe.eval_date >= ${periodStart}::date
      AND pe.eval_date <= ${periodEnd}::date
      AND p.prediction_type IN ('buy', 'sell')
      AND c.is_active
    ORDER BY 4 DESC
  `

  return {
    winners: all.slice(0, 5),
    losers: all.slice(-5).reverse(),
    bestCall: callRows[0] || null,
    worstCall: callRows.length > 1 ? callRows[callRows.length - 1] : null,
    periodStart,
    periodEnd,
  }
}

// Consensus Timeline (per asset)
export async function getConsensusTimeline(assetCode: string, days = 60): Promise<ConsensusTimelineEntry[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      c.name AS channel_name,
      c.id AS channel_id,
      c.thumbnail_url AS channel_thumbnail,
      p.prediction_type,
      ma.sentiment,
      v.published_at,
      v.title AS video_title
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    JOIN channels c ON v.channel_id = c.id
    LEFT JOIN predictions p ON p.video_id = v.id AND p.mentioned_asset_id = ma.id
    WHERE ma.asset_code = ${assetCode}
      AND v.published_at >= NOW() - INTERVAL '1 day' * ${days}
    ORDER BY v.published_at ASC
  `
  return rows as ConsensusTimelineEntry[]
}

// Analyst Consensus
// Active Predictions Tracker
export async function getActivePredictions(limit = 30): Promise<ActivePrediction[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      p.id,
      p.channel_id,
      c.name AS channel_name,
      c.thumbnail_url AS channel_thumbnail,
      COALESCE(ma.asset_name, '(미지정)') AS asset_name,
      ma.asset_code,
      p.prediction_type,
      ma.price_at_mention::float AS mentioned_price,
      p.target_price::float AS target_price,
      latest_price.price::float AS current_price,
      p.predicted_at,
      EXTRACT(DAY FROM NOW() - p.predicted_at)::int AS days_since,
      pe.outcome AS outcome_1m,
      p.reason,
      -- 계획 3.4: clamp((P(t0+90) - P(t0)) / (TP - P(t0)), -1, 2).
      -- 분자의 기준 시점은 t0+90이며, 아직 오지 않았으면 최신가로 진행
      -- 상황을 보여준다(정보성 표기, 랭킹 미반영). 어느 쪽인지는
      -- progress_is_final로 구분해 UI가 단정하지 않게 한다.
      CASE
        WHEN ma.price_at_mention IS NOT NULL
          AND p.target_price IS NOT NULL
          AND p.target_price != ma.price_at_mention
          AND progress_price.price IS NOT NULL
        THEN LEAST(GREATEST(
          ((progress_price.price - ma.price_at_mention) / (p.target_price - ma.price_at_mention) * 100)::float,
          -100
        ), 200)
        ELSE NULL
      END AS progress_pct,
      (p.predicted_at::date + 90) <= CURRENT_DATE AS progress_is_final,
      progress_price.recorded_date::text AS progress_asof
    FROM predictions p
    LEFT JOIN prediction_evaluations pe
           ON pe.prediction_id = p.id
          AND pe.horizon = '1m'
          AND pe.evaluation_version = 2
    JOIN channels c ON p.channel_id = c.id
    LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    LEFT JOIN LATERAL (
      SELECT ap.price
      FROM asset_prices ap
      WHERE ap.asset_code = ma.asset_code
      ORDER BY ap.recorded_date DESC
      LIMIT 1
    ) latest_price ON true
    LEFT JOIN LATERAL (
      SELECT ap.price, ap.recorded_date
      FROM asset_prices ap
      WHERE ap.asset_code = ma.asset_code
        AND ap.recorded_date <= LEAST(p.predicted_at::date + 90, CURRENT_DATE)
      ORDER BY ap.recorded_date DESC
      LIMIT 1
    ) progress_price ON true
    WHERE p.prediction_type IN ('buy', 'sell', 'hold')
      -- 3개월 호라이즌이 아직 열려 있는 예측까지가 '진행 중'이다.
      AND p.predicted_at >= NOW() - INTERVAL '90 days'
      AND (ma.asset_type IS NULL OR ma.asset_type IN ('stock', 'coin'))
    ORDER BY p.predicted_at DESC
    LIMIT ${limit}
  `

  return (rows as any[]).map(r => ({
    id: r.id,
    channel_id: r.channel_id,
    channel_name: r.channel_name,
    channel_thumbnail: r.channel_thumbnail,
    asset_name: r.asset_name,
    asset_code: r.asset_code,
    prediction_type: r.prediction_type,
    mentioned_price: r.mentioned_price != null ? Number(r.mentioned_price) : null,
    target_price: r.target_price != null ? Number(r.target_price) : null,
    current_price: r.current_price != null ? Number(r.current_price) : null,
    progress_pct: r.progress_pct != null ? Math.round(Number(r.progress_pct) * 10) / 10 : null,
    progress_is_final: Boolean(r.progress_is_final),
    progress_asof: r.progress_asof ?? null,
    predicted_at: r.predicted_at,
    days_since: Number(r.days_since) || 0,
    outcome_1m: r.outcome_1m ?? null,
    reason: r.reason,
  }))
}

// Prediction Timeline (price history for a specific prediction)
