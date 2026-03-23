import { auth } from "@/auth"
import { getDb } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const sql = getDb()

  try {
    const keyRows = await sql`
      SELECT id, rate_limit FROM api_keys
      WHERE user_id = ${session.user.id} AND is_active = true
      LIMIT 1
    `

    if ((keyRows as any[]).length === 0) {
      return Response.json({
        success: true,
        data: {
          today: 0,
          this_week: 0,
          this_month: 0,
          endpoints: [],
          rate_limit: 100,
          used_this_hour: 0,
        },
      })
    }

    const keyIds = await sql`
      SELECT id FROM api_keys WHERE user_id = ${session.user.id}
    `
    const ids = (keyIds as any[]).map((r) => r.id)

    const rateLimit = (keyRows[0] as any).rate_limit || 100

    const todayRows = await sql`
      SELECT COUNT(*)::int AS count FROM api_usage_log
      WHERE api_key_id = ANY(${ids})
        AND created_at >= CURRENT_DATE
    `

    const weekRows = await sql`
      SELECT COUNT(*)::int AS count FROM api_usage_log
      WHERE api_key_id = ANY(${ids})
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    `

    const monthRows = await sql`
      SELECT COUNT(*)::int AS count FROM api_usage_log
      WHERE api_key_id = ANY(${ids})
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `

    const hourRows = await sql`
      SELECT COUNT(*)::int AS count FROM api_usage_log
      WHERE api_key_id = ANY(${ids})
        AND created_at >= NOW() - INTERVAL '1 hour'
    `

    const endpointRows = await sql`
      SELECT endpoint, COUNT(*)::int AS count FROM api_usage_log
      WHERE api_key_id = ANY(${ids})
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY endpoint
      ORDER BY count DESC
      LIMIT 10
    `

    return Response.json({
      success: true,
      data: {
        today: (todayRows[0] as any).count,
        this_week: (weekRows[0] as any).count,
        this_month: (monthRows[0] as any).count,
        endpoints: endpointRows as any[],
        rate_limit: rateLimit,
        used_this_hour: (hourRows[0] as any).count,
      },
    })
  } catch {
    return Response.json({ success: false, error: "Failed to fetch usage data" }, { status: 500 })
  }
}
