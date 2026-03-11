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

    // Combined hit rate
    const hitRateRows = await sql`
      SELECT
        COUNT(CASE WHEN p.direction_score >= 0.5 THEN 1 END)::int AS accurate_count,
        COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END)::int AS total_predictions,
        CASE WHEN COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) > 0
          THEN AVG(p.direction_score)::float
          ELSE NULL END AS combined_hit_rate
      FROM predictions p
      WHERE p.channel_id = ANY(${channelIds})
        AND p.prediction_type IN ('buy', 'sell')
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
        p.direction_score::float AS direction_score,
        p.predicted_at
      FROM predictions p
      JOIN channels c ON p.channel_id = c.id
      LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
      WHERE p.channel_id = ANY(${channelIds})
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
