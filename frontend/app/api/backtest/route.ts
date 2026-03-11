import { NextRequest, NextResponse } from "next/server"
import { getBacktestData } from "@/lib/queries"

export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("channelId")
  const amountParam = request.nextUrl.searchParams.get("amount")

  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 })
  }

  try {
    const result = await getBacktestData(channelId)
    if (!result) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 })
    }

    // Apply custom initial amount if provided
    const initialAmount = amountParam ? Math.max(1000000, Math.min(Number(amountParam) || 10000000, 1000000000)) : result.initial_amount
    const ratio = initialAmount / result.initial_amount
    const adjusted = {
      ...result,
      initial_amount: initialAmount,
      final_amount: Math.round(result.final_amount * ratio),
    }

    return NextResponse.json(adjusted)
  } catch {
    return NextResponse.json(
      { error: "Failed to run backtest" },
      { status: 500 }
    )
  }
}
