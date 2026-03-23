import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-helpers"
import { checkLimit, type FeatureKey } from "@/lib/tier-config"

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user?.id) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      )
    }

    const sql = getDb()

    const rows = await sql`
      SELECT feature, count
      FROM user_daily_usage
      WHERE user_id = ${user.id}
        AND usage_date = CURRENT_DATE
    `

    const usage: Record<string, number> = {}
    for (const row of rows) {
      usage[row.feature] = row.count
    }

    return NextResponse.json({ usage, tier: user.tier ?? "free" })
  } catch (error) {
    return NextResponse.json(
      { error: "사용량 조회에 실패했습니다.", detail: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user?.id) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { feature } = body

    if (!feature) {
      return NextResponse.json(
        { error: "feature 필드가 필요합니다." },
        { status: 400 }
      )
    }

    const sql = getDb()

    const currentRows = await sql`
      SELECT count
      FROM user_daily_usage
      WHERE user_id = ${user.id}
        AND feature = ${feature}
        AND usage_date = CURRENT_DATE
    `

    const currentUsage = currentRows.length > 0 ? currentRows[0].count : 0
    const tier = user.tier ?? "free"
    const limitCheck = checkLimit(tier, feature as FeatureKey, currentUsage)

    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: "일일 사용 한도에 도달했습니다.",
          limit: limitCheck.limit,
          usage: currentUsage,
        },
        { status: 429 }
      )
    }

    await sql`
      INSERT INTO user_daily_usage (user_id, feature, usage_date, count)
      VALUES (${user.id}, ${feature}, CURRENT_DATE, 1)
      ON CONFLICT (user_id, feature, usage_date)
      DO UPDATE SET
        count = user_daily_usage.count + 1,
        updated_at = NOW()
    `

    return NextResponse.json({
      success: true,
      feature,
      usage: currentUsage + 1,
      remaining: limitCheck.remaining === Infinity
        ? null
        : (limitCheck.remaining ?? 0) - 1,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "사용량 기록에 실패했습니다.", detail: String(error) },
      { status: 500 }
    )
  }
}
