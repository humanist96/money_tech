import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export async function GET(request: NextRequest) {
  const channelIdsParam = request.nextUrl.searchParams.get("channelIds")
  if (!channelIdsParam) {
    return NextResponse.json({ error: "channelIds required" }, { status: 400 })
  }

  const channelIds = channelIdsParam.split(",").filter(Boolean)
  if (channelIds.length === 0 || channelIds.length > 10) {
    return NextResponse.json({ error: "1-10 channels required" }, { status: 400 })
  }

  try {
    const sql = getDb()

    // Combined record on the v2 definition (1-month horizon), pooled across the
    // selected channels. Reads channel_stats so this agrees with the leaderboard
    // instead of averaging the retired direction_score column.
    const hitRateRows = await sql`
      SELECT
        COALESCE(SUM(cs.n_hits), 0)::int      AS accurate_count,
        COALESCE(SUM(cs.n_effective), 0)::int AS total_predictions,
        CASE WHEN SUM(cs.n_effective) > 0
          THEN (SUM(cs.n_hits)::float / SUM(cs.n_effective))
          ELSE NULL END                       AS combined_hit_rate,
        AVG(cs.avg_excess_return)::float      AS avg_excess_return
      FROM channel_stats cs
      WHERE cs.channel_id = ANY(${channelIds})
        AND cs.horizon = '1m'
        AND cs.evaluation_version = 2
    `

    // Opinion conflicts between selected channels
    const conflictRows = await sql`
      SELECT
        ma.asset_name, ma.asset_code,
        ARRAY_AGG(DISTINCT CASE WHEN p.prediction_type = 'buy' THEN c.name END) FILTER (WHERE p.prediction_type = 'buy') AS buy_channels,
        ARRAY_AGG(DISTINCT CASE WHEN p.prediction_type = 'sell' THEN c.name END) FILTER (WHERE p.prediction_type = 'sell') AS sell_channels
      FROM predictions p
      JOIN channels c ON p.channel_id = c.id
      JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
      WHERE p.channel_id = ANY(${channelIds})
        AND p.prediction_type IN ('buy', 'sell')
        AND ma.asset_code IS NOT NULL
        AND p.predicted_at >= NOW() - INTERVAL '14 days'
      GROUP BY ma.asset_name, ma.asset_code
      HAVING COUNT(DISTINCT CASE WHEN p.prediction_type = 'buy' THEN c.id END) >= 1
         AND COUNT(DISTINCT CASE WHEN p.prediction_type = 'sell' THEN c.id END) >= 1
      ORDER BY COUNT(*) DESC
      LIMIT 5
    `

    // Recent predictions from selected channels
    const predRows = await sql`
      SELECT DISTINCT ON (c.name, ma.asset_name, p.prediction_type, p.predicted_at::date)
        p.id, c.name AS channel_name,
        COALESCE(ma.asset_name, '(미지정)') AS asset_name,
        ma.asset_code, p.prediction_type,
        pe.outcome AS outcome_1m,
        p.predicted_at
      FROM predictions p
      JOIN channels c ON p.channel_id = c.id
      LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
      LEFT JOIN prediction_evaluations pe
             ON pe.prediction_id = p.id
            AND pe.horizon = '1m'
            AND pe.evaluation_version = 2
      WHERE p.channel_id = ANY(${channelIds})
        AND NOT p.is_duplicate
        AND p.prediction_type IN ('buy', 'sell')
      ORDER BY c.name, ma.asset_name, p.prediction_type, p.predicted_at::date, p.predicted_at DESC
    `

    const recentPredictions = (predRows as any[])
      .sort((a, b) => new Date(b.predicted_at ?? 0).getTime() - new Date(a.predicted_at ?? 0).getTime())
      .slice(0, 20)

    const hr = hitRateRows[0] as any

    return NextResponse.json({
      combinedHitRate: hr.combined_hit_rate,
      totalPredictions: hr.total_predictions,
      accurateCount: hr.accurate_count,
      conflicts: (conflictRows as any[]).map(r => ({
        asset_name: r.asset_name,
        asset_code: r.asset_code,
        buy_channels: (r.buy_channels || []).filter(Boolean),
        sell_channels: (r.sell_channels || []).filter(Boolean),
      })),
      recentPredictions,
    })
  } catch {
    return NextResponse.json({ error: "Failed to load portfolio" }, { status: 500 })
  }
}
