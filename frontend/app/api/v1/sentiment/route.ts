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

  const sql = getDb()

  try {
    const categoryRows = await sql`
      SELECT
        c.category,
        COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::int AS positive_count,
        COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::int AS negative_count,
        COUNT(CASE WHEN ma.sentiment = 'neutral' THEN 1 END)::int AS neutral_count,
        COUNT(*)::int AS total_count
      FROM mentioned_assets ma
      JOIN videos v ON ma.video_id = v.id
      JOIN channels c ON v.channel_id = c.id
      WHERE v.published_at >= NOW() - INTERVAL '7 days'
        AND ma.sentiment IS NOT NULL
      GROUP BY c.category
    `

    const categoryScores = (categoryRows as any[]).map((r) => ({
      ...r,
      temperature: r.total_count > 0
        ? ((r.positive_count - r.negative_count) / r.total_count) * 50 + 50
        : 50,
    }))

    const overallScore = categoryScores.length > 0
      ? categoryScores.reduce((sum, d) => sum + d.temperature * d.total_count, 0) /
        Math.max(categoryScores.reduce((sum, d) => sum + d.total_count, 0), 1)
      : 50

    let assetSentiment = null
    if (assetCode) {
      const assetRows = await sql`
        SELECT
          ma.asset_name,
          ma.asset_code,
          COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::int AS positive_count,
          COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::int AS negative_count,
          COUNT(CASE WHEN ma.sentiment = 'neutral' THEN 1 END)::int AS neutral_count,
          COUNT(*)::int AS total_count,
          COUNT(DISTINCT v.channel_id)::int AS channel_count
        FROM mentioned_assets ma
        JOIN videos v ON ma.video_id = v.id
        WHERE ma.asset_code = ${assetCode}
          AND v.published_at >= NOW() - INTERVAL '7 days'
          AND ma.sentiment IS NOT NULL
        GROUP BY ma.asset_name, ma.asset_code
      `
      if ((assetRows as any[]).length > 0) {
        const r = assetRows[0] as any
        assetSentiment = {
          ...r,
          sentiment_score: r.total_count > 0
            ? Math.round(((r.positive_count - r.negative_count) / r.total_count) * 50 + 50)
            : 50,
        }
      }
    }

    const data = {
      overall_score: Math.round(overallScore),
      label: overallScore >= 70 ? "greedy" : overallScore <= 30 ? "fearful" : "neutral",
      category_scores: categoryScores,
      ...(assetSentiment ? { asset_sentiment: assetSentiment } : {}),
    }

    const responseTimeMs = Date.now() - startTime
    await logApiUsage(validation.keyInfo!.id, "/v1/sentiment", 200, responseTimeMs)

    return apiSuccess(data, undefined, validation.keyInfo)
  } catch {
    const responseTimeMs = Date.now() - startTime
    await logApiUsage(validation.keyInfo!.id, "/v1/sentiment", 500, responseTimeMs)
    return apiError("Internal server error", 500)
  }
}
