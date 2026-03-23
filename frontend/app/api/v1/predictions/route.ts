import { validateApiKey, logApiUsage, apiError, apiSuccess } from "@/lib/api-middleware"
import { getDb } from "@/lib/db"

export async function GET(request: Request) {
  const startTime = Date.now()
  const validation = await validateApiKey(request)

  if (!validation.valid) {
    return apiError(validation.error ?? "Unauthorized", 401)
  }

  const { searchParams } = new URL(request.url)
  const assetCode = searchParams.get("asset_code")
  const direction = searchParams.get("direction")
  const days = Math.min(Math.max(parseInt(searchParams.get("days") ?? "30", 10) || 30, 1), 365)
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), 200)

  const sql = getDb()

  try {
    const rows = await sql`
      SELECT
        p.id,
        c.name AS channel_name,
        c.category AS channel_category,
        COALESCE(ma.asset_name, '(unspecified)') AS asset_name,
        ma.asset_code,
        p.prediction_type,
        p.reason,
        p.predicted_at,
        p.direction_1w,
        p.direction_1m,
        p.direction_3m,
        p.direction_score::float AS direction_score,
        ma.price_at_mention::float AS price_at_mention,
        p.target_price::float AS target_price
      FROM predictions p
      JOIN channels c ON p.channel_id = c.id
      LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
      WHERE p.prediction_type IN ('buy', 'sell')
        AND p.predicted_at >= NOW() - INTERVAL '1 day' * ${days}
        ${assetCode ? sql`AND ma.asset_code = ${assetCode}` : sql``}
        ${direction ? sql`AND p.prediction_type = ${direction}` : sql``}
      ORDER BY p.predicted_at DESC
      LIMIT ${limit}
    `

    const responseTimeMs = Date.now() - startTime
    await logApiUsage(validation.keyInfo!.id, "/v1/predictions", 200, responseTimeMs)

    return apiSuccess(rows, { count: rows.length, limit, days }, validation.keyInfo)
  } catch {
    const responseTimeMs = Date.now() - startTime
    await logApiUsage(validation.keyInfo!.id, "/v1/predictions", 500, responseTimeMs)
    return apiError("Internal server error", 500)
  }
}
