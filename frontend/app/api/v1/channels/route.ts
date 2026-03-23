import { validateApiKey, logApiUsage, apiError, apiSuccess } from "@/lib/api-middleware"
import { getDb } from "@/lib/db"

export async function GET(request: Request) {
  const startTime = Date.now()
  const validation = await validateApiKey(request)

  if (!validation.valid) {
    return apiError(validation.error ?? "Unauthorized", 401)
  }

  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1), 100)
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0)

  const sql = getDb()

  try {
    const countRows = category
      ? await sql`SELECT COUNT(*)::int AS total FROM channels WHERE category = ${category}`
      : await sql`SELECT COUNT(*)::int AS total FROM channels`
    const total = (countRows[0] as { total: number }).total

    const rows = category
      ? await sql`
          SELECT id, name, platform, category, subscriber_count, video_count,
                 thumbnail_url, channel_type, hit_rate, prediction_intensity_score,
                 created_at
          FROM channels
          WHERE category = ${category}
          ORDER BY subscriber_count DESC NULLS LAST
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql`
          SELECT id, name, platform, category, subscriber_count, video_count,
                 thumbnail_url, channel_type, hit_rate, prediction_intensity_score,
                 created_at
          FROM channels
          ORDER BY subscriber_count DESC NULLS LAST
          LIMIT ${limit} OFFSET ${offset}
        `

    const responseTimeMs = Date.now() - startTime
    await logApiUsage(validation.keyInfo!.id, "/v1/channels", 200, responseTimeMs)

    return apiSuccess(rows, { total, limit, offset }, validation.keyInfo)
  } catch {
    const responseTimeMs = Date.now() - startTime
    await logApiUsage(validation.keyInfo!.id, "/v1/channels", 500, responseTimeMs)
    return apiError("Internal server error", 500)
  }
}
