import { getDb } from '../db'
import type {
  PredictionFeedItem, HitRateLeaderboardItem,
  BacktestResult, BacktestTrade, WeeklyReportItem,
  ConsensusTimelineEntry, AnalystConsensus,
  ActivePrediction, PredictionTimelineData,
  Horizon, SkillGrade,
} from '../types'

// Recent Predictions Feed (deduplicated, direction-based)
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
      p.is_accurate,
      p.direction_1w,
      p.direction_1m,
      p.direction_3m,
      p.direction_score::float AS direction_score
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE p.prediction_type IN ('buy', 'sell')
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
      COALESCE(recent.predictions, '[]'::json) AS recent_predictions
    FROM channel_stats cs
    JOIN channels c ON c.id = cs.channel_id
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

// YouTuber Backtesting Simulator
// Weekly Winner/Loser Report
export async function getWeeklyReport(): Promise<{ winners: WeeklyReportItem[]; losers: WeeklyReportItem[]; bestCall: any; worstCall: any }> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      c.id AS channel_id,
      c.name AS channel_name,
      c.thumbnail_url AS channel_thumbnail,
      c.category,
      COUNT(CASE WHEN p.direction_score >= 0.5 THEN 1 END)::int AS accurate_count,
      COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END)::int AS total_count,
      CASE WHEN COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) > 0
        THEN (COUNT(CASE WHEN p.direction_score >= 0.5 THEN 1 END)::float /
              COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) * 100)
        ELSE 0 END AS accuracy_pct
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    WHERE p.predicted_at >= NOW() - INTERVAL '7 days'
      AND p.prediction_type IN ('buy', 'sell')
      AND p.direction_score IS NOT NULL
    GROUP BY c.id, c.name, c.thumbnail_url, c.category
    HAVING COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) >= 1
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

  const bestCallRows = await sql`
    SELECT
      c.name AS channel_name,
      ma.asset_name,
      p.prediction_type,
      CASE WHEN ma.price_at_mention > 0 AND p.actual_price_after_1w IS NOT NULL
        THEN ((p.actual_price_after_1w - ma.price_at_mention) / ma.price_at_mention * 100)
        ELSE NULL END AS return_pct
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE p.predicted_at >= NOW() - INTERVAL '7 days'
      AND p.prediction_type IN ('buy', 'sell')
      AND ma.price_at_mention > 0
      AND p.actual_price_after_1w IS NOT NULL
    ORDER BY CASE WHEN p.prediction_type = 'buy'
      THEN (p.actual_price_after_1w - ma.price_at_mention) / ma.price_at_mention
      ELSE (ma.price_at_mention - p.actual_price_after_1w) / ma.price_at_mention
    END DESC
    LIMIT 1
  `

  const worstCallRows = await sql`
    SELECT
      c.name AS channel_name,
      ma.asset_name,
      p.prediction_type,
      CASE WHEN ma.price_at_mention > 0 AND p.actual_price_after_1w IS NOT NULL
        THEN ((p.actual_price_after_1w - ma.price_at_mention) / ma.price_at_mention * 100)
        ELSE NULL END AS return_pct
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE p.predicted_at >= NOW() - INTERVAL '7 days'
      AND p.prediction_type IN ('buy', 'sell')
      AND ma.price_at_mention > 0
      AND p.actual_price_after_1w IS NOT NULL
    ORDER BY CASE WHEN p.prediction_type = 'buy'
      THEN (p.actual_price_after_1w - ma.price_at_mention) / ma.price_at_mention
      ELSE (ma.price_at_mention - p.actual_price_after_1w) / ma.price_at_mention
    END ASC
    LIMIT 1
  `

  return {
    winners: all.slice(0, 5),
    losers: all.slice(-5).reverse(),
    bestCall: bestCallRows[0] || null,
    worstCall: worstCallRows[0] || null,
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
      p.is_accurate,
      p.direction_score::float AS direction_score,
      p.reason,
      CASE
        WHEN ma.price_at_mention IS NOT NULL
          AND p.target_price IS NOT NULL
          AND p.target_price != ma.price_at_mention
          AND latest_price.price IS NOT NULL
        THEN LEAST(GREATEST(
          ((latest_price.price - ma.price_at_mention) / (p.target_price - ma.price_at_mention) * 100)::float,
          -100
        ), 200)
        ELSE NULL
      END AS progress_pct
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    LEFT JOIN LATERAL (
      SELECT ap.price
      FROM asset_prices ap
      WHERE ap.asset_code = ma.asset_code
      ORDER BY ap.recorded_date DESC
      LIMIT 1
    ) latest_price ON true
    WHERE p.prediction_type IN ('buy', 'sell', 'hold')
      AND p.predicted_at >= NOW() - INTERVAL '30 days'
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
    predicted_at: r.predicted_at,
    days_since: Number(r.days_since) || 0,
    is_accurate: r.is_accurate,
    direction_score: r.direction_score != null ? Number(r.direction_score) : null,
    reason: r.reason,
  }))
}

// Prediction Timeline (price history for a specific prediction)
