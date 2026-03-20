import { getDb } from '../db'
import type {
  PredictionFeedItem, HitRateLeaderboardItem,
  BacktestResult, BacktestTrade, WeeklyReportItem,
  ConsensusTimelineEntry, AnalystConsensus,
  ActivePrediction, PredictionTimelineData,
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

// Hit Rate Leaderboard (direction-based)
// Uses mv_hit_rate_leaderboard materialized view for the main aggregation,
// then fetches recent_predictions per channel (N+1 queries, but main query is instant).
export async function getHitRateLeaderboard(): Promise<HitRateLeaderboardItem[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM mv_hit_rate_leaderboard
  `

  const result: HitRateLeaderboardItem[] = []
  for (const r of rows as any[]) {
    const recentPreds = await sql`
      SELECT p.prediction_type, p.is_accurate, p.direction_1w, p.direction_1m, p.direction_3m,
             p.direction_score::float, ma.asset_name
      FROM predictions p
      LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
      WHERE p.channel_id = ${r.channel_id}
        AND p.prediction_type IN ('buy', 'sell')
      ORDER BY p.predicted_at DESC NULLS LAST
      LIMIT 5
    `
    result.push({
      ...r,
      hit_rate: Number(r.hit_rate) || 0,
      avg_crowd_accuracy: Number(r.avg_crowd_accuracy) || 0,
      recent_predictions: recentPreds as any[],
    })
  }
  return result
}

// YouTuber Backtesting Simulator
export async function getBacktestData(channelId: string): Promise<BacktestResult | null> {
  const sql = getDb()

  const channelRow = await sql`SELECT id, name, thumbnail_url FROM channels WHERE id = ${channelId} LIMIT 1`
  if (channelRow.length === 0) return null
  const channel = channelRow[0] as any

  const trades = await sql`
    SELECT
      ma.asset_name, ma.asset_code,
      p.prediction_type,
      ma.price_at_mention AS entry_price,
      p.actual_price_after_1w AS exit_price_1w,
      p.actual_price_after_1m AS exit_price_1m,
      CASE WHEN ma.price_at_mention > 0 AND p.actual_price_after_1w IS NOT NULL
        THEN ((p.actual_price_after_1w - ma.price_at_mention) / ma.price_at_mention * 100)
        ELSE NULL END AS return_1w,
      CASE WHEN ma.price_at_mention > 0 AND p.actual_price_after_1m IS NOT NULL
        THEN ((p.actual_price_after_1m - ma.price_at_mention) / ma.price_at_mention * 100)
        ELSE NULL END AS return_1m,
      p.predicted_at
    FROM predictions p
    JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE p.channel_id = ${channelId}
      AND p.prediction_type IN ('buy', 'sell')
      AND ma.price_at_mention IS NOT NULL
    ORDER BY p.predicted_at ASC
  `

  const tradeList: BacktestTrade[] = (trades as any[]).map(t => ({
    asset_name: t.asset_name,
    asset_code: t.asset_code,
    prediction_type: t.prediction_type,
    entry_price: t.entry_price ? Number(t.entry_price) : null,
    exit_price_1w: t.exit_price_1w ? Number(t.exit_price_1w) : null,
    exit_price_1m: t.exit_price_1m ? Number(t.exit_price_1m) : null,
    return_1w: t.return_1w ? Number(t.return_1w) : null,
    return_1m: t.return_1m ? Number(t.return_1m) : null,
    predicted_at: t.predicted_at,
  }))

  const initialAmount = 10000000
  let cumReturn = 0
  let wins = 0
  let total = 0
  let maxDrawdown = 0
  let peak = 0

  for (const trade of tradeList) {
    const ret = trade.return_1m ?? trade.return_1w
    if (ret === null) continue
    const adjustedReturn = trade.prediction_type === 'sell' ? -ret : ret
    cumReturn += adjustedReturn
    total++
    if (adjustedReturn > 0) wins++
    if (cumReturn > peak) peak = cumReturn
    const drawdown = peak - cumReturn
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  return {
    channel_id: channelId,
    channel_name: channel.name,
    channel_thumbnail: channel.thumbnail_url,
    initial_amount: initialAmount,
    final_amount: Math.round(initialAmount * (1 + cumReturn / 100)),
    total_return_pct: Math.round(cumReturn * 100) / 100,
    benchmark_return_pct: 0,
    total_trades: total,
    win_rate: total > 0 ? Math.round((wins / total) * 10000) / 100 : 0,
    max_drawdown: Math.round(maxDrawdown * 100) / 100,
    trades: tradeList,
  }
}

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
export async function getAnalystConsensus(assetCode: string): Promise<AnalystConsensus | null> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      p.target_price,
      p.prediction_type,
      v.firm_name,
      p.predicted_at
    FROM predictions p
    JOIN videos v ON p.video_id = v.id
    JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE ma.asset_code = ${assetCode}
    AND v.platform = 'analyst_report'
    AND p.predicted_at >= NOW() - INTERVAL '90 days'
    ORDER BY p.predicted_at DESC
  ` as any[]

  if (rows.length === 0) return null

  const targetPrices = rows
    .map((r: any) => r.target_price)
    .filter((p: any): p is number => p != null && p > 0)

  const recommendations = rows.map((r: any) => ({
    firm_name: r.firm_name || '',
    recommendation: r.prediction_type || '',
    target_price: r.target_price,
    published_at: r.predicted_at,
  }))

  return {
    asset_name: '',
    asset_code: assetCode,
    avg_target_price: targetPrices.length > 0 ? targetPrices.reduce((a: number, b: number) => a + b, 0) / targetPrices.length : null,
    median_target_price: targetPrices.length > 0 ? targetPrices.sort((a: number, b: number) => a - b)[Math.floor(targetPrices.length / 2)] : null,
    max_target_price: targetPrices.length > 0 ? Math.max(...targetPrices) : null,
    min_target_price: targetPrices.length > 0 ? Math.min(...targetPrices) : null,
    firm_count: new Set(rows.map((r: any) => r.firm_name)).size,
    buy_count: rows.filter((r: any) => r.prediction_type === 'buy').length,
    sell_count: rows.filter((r: any) => r.prediction_type === 'sell').length,
    hold_count: rows.filter((r: any) => r.prediction_type === 'hold').length,
    recommendations,
  }
}

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
export async function getPredictionTimeline(predictionId: string): Promise<PredictionTimelineData | null> {
  const sql = getDb()

  const predRows = await sql`
    SELECT
      p.id,
      c.name AS channel_name,
      COALESCE(ma.asset_name, '(미지정)') AS asset_name,
      ma.asset_code,
      p.prediction_type,
      ma.price_at_mention::float AS mentioned_price,
      p.target_price::float AS target_price,
      p.predicted_at,
      p.is_accurate
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE p.id = ${predictionId}
    LIMIT 1
  `

  if (predRows.length === 0) return null
  const pred = predRows[0] as any

  const priceRows = pred.asset_code
    ? await sql`
        SELECT recorded_date::text AS date, price::float AS price
        FROM asset_prices
        WHERE asset_code = ${pred.asset_code}
          AND recorded_date >= ${pred.predicted_at}::date
        ORDER BY recorded_date ASC
      `
    : []

  return {
    id: pred.id,
    channel_name: pred.channel_name,
    asset_name: pred.asset_name,
    asset_code: pred.asset_code,
    prediction_type: pred.prediction_type,
    mentioned_price: pred.mentioned_price != null ? Number(pred.mentioned_price) : null,
    target_price: pred.target_price != null ? Number(pred.target_price) : null,
    predicted_at: pred.predicted_at,
    is_accurate: pred.is_accurate,
    timeline: (priceRows as any[]).map(r => ({
      date: r.date,
      price: Number(r.price),
    })),
  }
}
