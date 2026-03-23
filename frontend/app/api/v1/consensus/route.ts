import { validateApiKey, logApiUsage, apiError, apiSuccess } from "@/lib/api-middleware"
import { getDb } from "@/lib/db"

export async function GET(request: Request) {
  const startTime = Date.now()
  const validation = await validateApiKey(request)

  if (!validation.valid) {
    return apiError(validation.error ?? "Unauthorized", 401)
  }

  const { searchParams } = new URL(request.url)
  const days = Math.min(Math.max(parseInt(searchParams.get("days") ?? "30", 10) || 30, 1), 365)
  const minChannels = Math.max(parseInt(searchParams.get("min_channels") ?? "2", 10) || 2, 1)

  const sql = getDb()

  try {
    const rows = await sql`
      SELECT
        ma.asset_name,
        ma.asset_code,
        ma.asset_type,
        COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 AS positive_pct,
        COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 AS negative_pct,
        COUNT(CASE WHEN ma.sentiment = 'neutral' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 AS neutral_pct,
        COUNT(*)::int AS total_mentions,
        COUNT(DISTINCT v.channel_id)::int AS channel_count,
        COUNT(CASE WHEN p.prediction_type = 'buy' THEN 1 END)::int AS buy_count,
        COUNT(CASE WHEN p.prediction_type = 'sell' THEN 1 END)::int AS sell_count,
        COUNT(CASE WHEN p.prediction_type = 'hold' THEN 1 END)::int AS hold_count
      FROM mentioned_assets ma
      JOIN videos v ON ma.video_id = v.id
      JOIN channels c ON v.channel_id = c.id
      LEFT JOIN predictions p ON p.video_id = v.id AND p.mentioned_asset_id = ma.id
      WHERE v.published_at >= NOW() - INTERVAL '1 day' * ${days}
        AND ma.sentiment IS NOT NULL
      GROUP BY ma.asset_name, ma.asset_code, ma.asset_type
      HAVING COUNT(DISTINCT v.channel_id) >= ${minChannels}
      ORDER BY COUNT(DISTINCT v.channel_id) DESC, COUNT(*) DESC
      LIMIT 50
    `

    const data = (rows as any[]).map((r) => {
      const maxPct = Math.max(
        Number(r.positive_pct) || 0,
        Number(r.negative_pct) || 0,
        Number(r.neutral_pct) || 0,
      )
      return {
        ...r,
        consensus_score: Math.round(maxPct),
      }
    })

    const responseTimeMs = Date.now() - startTime
    await logApiUsage(validation.keyInfo!.id, "/v1/consensus", 200, responseTimeMs)

    return apiSuccess(data, { count: data.length, days, min_channels: minChannels }, validation.keyInfo)
  } catch {
    const responseTimeMs = Date.now() - startTime
    await logApiUsage(validation.keyInfo!.id, "/v1/consensus", 500, responseTimeMs)
    return apiError("Internal server error", 500)
  }
}
