import { getDb } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      enqueue({ type: "connected" })

      let lastCheck = new Date().toISOString()

      const poll = async () => {
        try {
          const sql = getDb()

          const alerts = await sql`
            SELECT
              ma.asset_name,
              COUNT(*)::int AS mention_count,
              COUNT(DISTINCT v.channel_id)::int AS channel_count
            FROM mentioned_assets ma
            JOIN videos v ON v.id = ma.video_id
            WHERE ma.created_at > ${lastCheck}::timestamptz
            GROUP BY ma.asset_name
            HAVING COUNT(*) >= 3
            ORDER BY COUNT(*) DESC
            LIMIT 5
          `

          for (const alert of alerts) {
            enqueue({ type: "buzz_alert", data: alert })
          }

          const predictions = await sql`
            SELECT
              p.prediction_type,
              ma.asset_name,
              c.name AS channel_name
            FROM predictions p
            JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
            JOIN channels c ON p.channel_id = c.id
            WHERE p.predicted_at > ${lastCheck}::timestamptz
            ORDER BY p.predicted_at DESC
            LIMIT 5
          `

          for (const pred of predictions) {
            enqueue({ type: "new_prediction", data: pred })
          }

          lastCheck = new Date().toISOString()
        } catch {
          // Silently continue on poll error
        }
      }

      const interval = setInterval(poll, 30000)

      request.signal.addEventListener("abort", () => {
        clearInterval(interval)
        try {
          controller.close()
        } catch {
          // Stream may already be closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
