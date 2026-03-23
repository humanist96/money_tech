import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-helpers"
import { TIERS, type TierKey } from "@/lib/tier-config"

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
    const { tier } = body

    if (!tier || !["pro", "enterprise"].includes(tier)) {
      return NextResponse.json(
        { error: "유효하지 않은 요금제입니다." },
        { status: 400 }
      )
    }

    const targetTier = tier as TierKey
    const tierConfig = TIERS[targetTier]

    const sql = getDb()

    await sql`
      UPDATE users
      SET tier = ${targetTier}, updated_at = NOW()
      WHERE id = ${user.id}
    `

    return NextResponse.json({
      success: true,
      tier: targetTier,
      name: tierConfig.nameKo,
      price: tierConfig.price,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "요금제 변경에 실패했습니다.", detail: String(error) },
      { status: 500 }
    )
  }
}
