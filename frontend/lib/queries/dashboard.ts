import { getDb } from '../db'
import type {
  DailyStat, MarketTemperature, BuzzAlert, BuzzAlertEnhanced,
  ContrarianSignal, AssetMention, PredictionFeedItem,
  ConflictingAsset, MarketSentimentGauge, HotKeyword,
} from '../types'
import { getAssetMentions } from './assets'
import { getRecentPredictions } from './predictions'

export async function getDailyStats(days = 30): Promise<DailyStat[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM daily_stats
    WHERE date >= CURRENT_DATE - ${days}::integer
    ORDER BY date ASC
  `
  return rows as unknown as DailyStat[]
}

export async function getTotalVideoCount(): Promise<number> {
  const sql = getDb()
  const rows = await sql`SELECT count(*)::integer AS count FROM videos`
  return (rows[0] as { count: number }).count
}

// Market Temperature - category sentiment aggregation
export async function getMarketTemperature(days = 7): Promise<MarketTemperature[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      c.category,
      COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::int AS positive_count,
      COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::int AS negative_count,
      COUNT(CASE WHEN ma.sentiment = 'neutral' THEN 1 END)::int AS neutral_count,
      COUNT(*)::int AS total_count
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    JOIN channels c ON v.channel_id = c.id
    WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
      AND ma.sentiment IS NOT NULL
    GROUP BY c.category
  `
  return rows.map((r: any) => ({
    ...r,
    temperature: r.total_count > 0
      ? ((r.positive_count - r.negative_count) / r.total_count) * 50 + 50
      : 50,
  })) as MarketTemperature[]
}

// Enhanced Market Sentiment Gauge
export async function getMarketSentimentGauge(): Promise<MarketSentimentGauge> {
  const sql = getDb()
  const categoryScores = await getMarketTemperature(7)
  const overallScore = categoryScores.length > 0
    ? categoryScores.reduce((sum, d) => sum + d.temperature * d.total_count, 0) /
      Math.max(categoryScores.reduce((sum, d) => sum + d.total_count, 0), 1)
    : 50

  // Use mv_market_sentiment materialized view (pre-computed 90-day daily scores)
  const historicalRows = await sql`
    SELECT date, score FROM mv_market_sentiment ORDER BY date ASC
  `

  const extremes = (historicalRows as any[])
    .filter(r => Number(r.score) >= 80 || Number(r.score) <= 20)
    .map(r => ({
      date: r.date,
      score: Math.round(Number(r.score)),
      actual_market_1m: null,
    }))

  const warning = overallScore >= 80
    ? `탐욕지수 ${Math.round(overallScore)} - 과열 주의`
    : overallScore <= 20
      ? `공포지수 ${Math.round(overallScore)} - 역발상 매수 시점?`
      : null

  return {
    overall_score: Math.round(overallScore),
    category_scores: categoryScores,
    historical_extremes: extremes.slice(-5),
    current_warning: warning,
  }
}

// Buzz Alert - assets mentioned by 3+ channels in recent hours
export async function getBuzzAlerts(hours = 12): Promise<BuzzAlert[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      ma.asset_name,
      ma.asset_code,
      ma.asset_type,
      COUNT(DISTINCT v.channel_id)::int AS channel_count,
      COUNT(*)::int AS mention_count,
      ARRAY_AGG(DISTINCT c.name) AS channels,
      MODE() WITHIN GROUP (ORDER BY ma.sentiment) AS dominant_sentiment,
      MAX(v.published_at) AS latest_at
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    JOIN channels c ON v.channel_id = c.id
    WHERE v.published_at >= NOW() - INTERVAL '1 hour' * ${hours}
      AND ma.asset_code IS NOT NULL
      AND ma.sentiment IS NOT NULL
    GROUP BY ma.asset_name, ma.asset_code, ma.asset_type
    HAVING COUNT(DISTINCT v.channel_id) >= 2
    ORDER BY channel_count DESC, mention_count DESC
    LIMIT 10
  `
  return rows as BuzzAlert[]
}

// Enhanced Buzz Alert - with growth rate
export async function getEnhancedBuzzAlerts(hours = 48): Promise<BuzzAlertEnhanced[]> {
  const sql = getDb()
  const rows = await sql`
    WITH recent AS (
      SELECT
        ma.asset_name, ma.asset_code, ma.asset_type,
        COUNT(DISTINCT v.channel_id)::int AS channel_count,
        COUNT(*)::int AS mention_count,
        ARRAY_AGG(DISTINCT c.name) AS channels,
        MODE() WITHIN GROUP (ORDER BY ma.sentiment) AS dominant_sentiment,
        MAX(v.published_at) AS latest_at
      FROM mentioned_assets ma
      JOIN videos v ON ma.video_id = v.id
      JOIN channels c ON v.channel_id = c.id
      WHERE v.published_at >= NOW() - INTERVAL '1 hour' * ${hours}
        AND ma.asset_code IS NOT NULL AND ma.sentiment IS NOT NULL
      GROUP BY ma.asset_name, ma.asset_code, ma.asset_type
      HAVING COUNT(DISTINCT v.channel_id) >= 2
    ),
    prev_week AS (
      SELECT
        ma.asset_code,
        COUNT(*)::int AS prev_mentions
      FROM mentioned_assets ma
      JOIN videos v ON ma.video_id = v.id
      WHERE v.published_at >= NOW() - INTERVAL '9 days'
        AND v.published_at < NOW() - INTERVAL '2 days'
        AND ma.asset_code IS NOT NULL
      GROUP BY ma.asset_code
    )
    SELECT
      r.*,
      COALESCE(pw.prev_mentions, 0)::int AS prev_week_mentions,
      CASE WHEN COALESCE(pw.prev_mentions, 0) > 0
        THEN ((r.mention_count::float - pw.prev_mentions) / pw.prev_mentions * 100)
        ELSE 999 END AS growth_rate,
      (r.channel_count * 3 + r.mention_count +
        CASE WHEN COALESCE(pw.prev_mentions, 0) > 0
          THEN LEAST((r.mention_count::float / pw.prev_mentions - 1) * 10, 30)
          ELSE 15 END
      )::float AS weighted_score
    FROM recent r
    LEFT JOIN prev_week pw ON pw.asset_code = r.asset_code
    ORDER BY weighted_score DESC
    LIMIT 10
  `
  return rows as any[]
}

// Contrarian Signal - extreme consensus detection
export async function getContrarianSignals(days = 30, threshold = 75): Promise<ContrarianSignal[]> {
  const sql = getDb()
  const rows = await sql`
    WITH asset_consensus AS (
      SELECT
        ma.asset_name,
        ma.asset_code,
        ma.asset_type,
        COUNT(CASE WHEN p.prediction_type = 'buy' THEN 1 END)::int AS buy_count,
        COUNT(CASE WHEN p.prediction_type = 'sell' THEN 1 END)::int AS sell_count,
        COUNT(DISTINCT v.channel_id)::int AS channel_count,
        COUNT(*)::int AS total_preds
      FROM predictions p
      JOIN videos v ON p.video_id = v.id
      JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
      WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
        AND p.prediction_type IN ('buy', 'sell')
        AND ma.asset_code IS NOT NULL
      GROUP BY ma.asset_name, ma.asset_code, ma.asset_type
      HAVING COUNT(*) >= 3 AND COUNT(DISTINCT v.channel_id) >= 2
    ),
    historical AS (
      SELECT
        ma.asset_code,
        AVG(CASE WHEN ap_1w.price IS NOT NULL AND ma.price_at_mention > 0
          THEN ((ap_1w.price - ma.price_at_mention) / ma.price_at_mention * 100)
          ELSE NULL END)::float AS avg_return_1w,
        AVG(CASE WHEN ap_1m.price IS NOT NULL AND ma.price_at_mention > 0
          THEN ((ap_1m.price - ma.price_at_mention) / ma.price_at_mention * 100)
          ELSE NULL END)::float AS avg_return_1m,
        COUNT(*)::int AS similar_cases,
        CASE WHEN COUNT(CASE WHEN ap_1m.price IS NOT NULL AND ma.price_at_mention > 0 THEN 1 END) > 0
          THEN (COUNT(CASE WHEN ap_1m.price > ma.price_at_mention THEN 1 END)::float /
                NULLIF(COUNT(CASE WHEN ap_1m.price IS NOT NULL AND ma.price_at_mention > 0 THEN 1 END), 0) * 100)
          ELSE NULL END AS rebound_pct
      FROM mentioned_assets ma
      JOIN videos v ON ma.video_id = v.id
      LEFT JOIN LATERAL (
        SELECT price FROM asset_prices
        WHERE asset_code = ma.asset_code
          AND recorded_date >= (v.published_at::date + INTERVAL '7 days')::date
          AND recorded_date <= (v.published_at::date + INTERVAL '14 days')::date
        ORDER BY recorded_date ASC
        LIMIT 1
      ) ap_1w ON TRUE
      LEFT JOIN LATERAL (
        SELECT price FROM asset_prices
        WHERE asset_code = ma.asset_code
          AND recorded_date >= (v.published_at::date + INTERVAL '30 days')::date
          AND recorded_date <= (v.published_at::date + INTERVAL '45 days')::date
        ORDER BY recorded_date ASC
        LIMIT 1
      ) ap_1m ON TRUE
      WHERE ma.asset_code IS NOT NULL AND ma.price_at_mention IS NOT NULL
      GROUP BY ma.asset_code
    )
    SELECT
      ac.asset_name, ac.asset_code, ac.asset_type,
      ac.channel_count,
      CASE WHEN ac.buy_count > ac.sell_count
        THEN ac.buy_count::float / ac.total_preds * 100
        ELSE ac.sell_count::float / ac.total_preds * 100
      END AS consensus_pct,
      CASE WHEN ac.buy_count > ac.sell_count THEN 'buy' ELSE 'sell' END AS consensus_direction,
      h.avg_return_1w AS historical_avg_return_1w,
      h.avg_return_1m AS historical_avg_return_1m,
      COALESCE(h.similar_cases, 0)::int AS similar_cases,
      h.rebound_pct AS rebound_probability
    FROM asset_consensus ac
    LEFT JOIN historical h ON h.asset_code = ac.asset_code
    WHERE CASE WHEN ac.buy_count > ac.sell_count
      THEN ac.buy_count::float / ac.total_preds * 100
      ELSE ac.sell_count::float / ac.total_preds * 100
    END >= ${threshold}
    ORDER BY CASE WHEN ac.buy_count > ac.sell_count
      THEN ac.buy_count::float / ac.total_preds * 100
      ELSE ac.sell_count::float / ac.total_preds * 100
    END DESC
    LIMIT 15
  `
  return (rows as any[]).map(r => ({
    ...r,
    consensus_pct: Number(r.consensus_pct) || 0,
    rebound_probability: r.rebound_probability != null ? Number(r.rebound_probability) : null,
    warning_level: r.consensus_pct >= 90 ? 'high' as const :
                   r.consensus_pct >= 80 ? 'medium' as const : 'low' as const,
  }))
}

// Daily Briefing data
export async function getDailyBriefingData(): Promise<{
  topMentioned: AssetMention[]
  conflicts: ConflictingAsset[]
  newRecommendations: PredictionFeedItem[]
  temperature: MarketTemperature[]
}> {
  const sql = getDb()

  const [topMentioned, temperature, newRecommendations] = await Promise.all([
    getAssetMentions(1),
    getMarketTemperature(1),
    getRecentPredictions(10),
  ])

  const conflictRows = await sql`
    SELECT
      ma.asset_name, ma.asset_code,
      ARRAY_AGG(DISTINCT CASE WHEN p.prediction_type = 'buy' THEN c.name END) FILTER (WHERE p.prediction_type = 'buy') AS buy_channels,
      ARRAY_AGG(DISTINCT CASE WHEN p.prediction_type = 'sell' THEN c.name END) FILTER (WHERE p.prediction_type = 'sell') AS sell_channels
    FROM predictions p
    JOIN videos v ON p.video_id = v.id
    JOIN channels c ON p.channel_id = c.id
    JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE v.published_at >= NOW() - INTERVAL '2 days'
      AND p.prediction_type IN ('buy', 'sell')
      AND ma.asset_code IS NOT NULL
    GROUP BY ma.asset_name, ma.asset_code
    HAVING COUNT(DISTINCT CASE WHEN p.prediction_type = 'buy' THEN c.id END) >= 1
       AND COUNT(DISTINCT CASE WHEN p.prediction_type = 'sell' THEN c.id END) >= 1
    ORDER BY COUNT(*) DESC
    LIMIT 5
  `

  const conflicts: ConflictingAsset[] = (conflictRows as any[]).map(r => ({
    asset_name: r.asset_name,
    asset_code: r.asset_code,
    buy_channels: (r.buy_channels || []).filter(Boolean),
    sell_channels: (r.sell_channels || []).filter(Boolean),
  }))

  return {
    topMentioned: topMentioned.slice(0, 5),
    conflicts,
    newRecommendations,
    temperature,
  }
}

// Hot Keywords Ranking
export async function getHotKeywordsRanking(): Promise<HotKeyword[]> {
  const sql = getDb()
  const todayStats = await sql`
    SELECT top_keywords FROM daily_stats
    WHERE date >= CURRENT_DATE - 1
    ORDER BY date DESC
  `
  const yesterdayStats = await sql`
    SELECT top_keywords FROM daily_stats
    WHERE date >= CURRENT_DATE - 3 AND date < CURRENT_DATE - 1
    ORDER BY date DESC
  `

  const todayMap = new Map<string, number>()
  for (const s of todayStats as any[]) {
    if (s.top_keywords) {
      for (const kw of s.top_keywords) {
        todayMap.set(kw.keyword, (todayMap.get(kw.keyword) ?? 0) + kw.count)
      }
    }
  }

  const yesterdayMap = new Map<string, number>()
  for (const s of yesterdayStats as any[]) {
    if (s.top_keywords) {
      for (const kw of s.top_keywords) {
        yesterdayMap.set(kw.keyword, (yesterdayMap.get(kw.keyword) ?? 0) + kw.count)
      }
    }
  }

  const todayRanked = Array.from(todayMap.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)

  const yesterdayRanked = Array.from(yesterdayMap.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)

  const yesterdayRankMap = new Map<string, number>()
  yesterdayRanked.forEach((kw, i) => yesterdayRankMap.set(kw.keyword, i + 1))

  return todayRanked.slice(0, 15).map((kw, i) => {
    const prevRank = yesterdayRankMap.get(kw.keyword)
    const prevCount = yesterdayMap.get(kw.keyword) ?? 0
    return {
      keyword: kw.keyword,
      count: kw.count,
      prev_count: prevCount,
      rank_change: prevRank ? prevRank - (i + 1) : 99,
    }
  })
}
