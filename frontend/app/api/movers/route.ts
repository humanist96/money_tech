import { NextRequest, NextResponse } from 'next/server'
import { getLatestMoversDate, getMoversByDate, getMoverHistory } from '@/lib/queries'

// The movers pipeline writes once per session (16:40 KST), so a 10-minute
// cache costs nothing in freshness and keeps repeat views off the database.
export const revalidate = 600

/**
 * GET /api/movers            most recent session
 * GET /api/movers?date=YYYY-MM-DD
 * GET /api/movers?code=005930   per-ticker history
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const date = searchParams.get('date')

  try {
    if (code) {
      if (!/^[0-9]{6}$/.test(code)) {
        return NextResponse.json({ error: 'code must be a 6-digit ticker' }, { status: 400 })
      }
      return NextResponse.json({ code, history: await getMoverHistory(code) })
    }

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }

    const tradeDate = date ?? (await getLatestMoversDate())
    if (!tradeDate) {
      return NextResponse.json({ trade_date: null, movers: [] })
    }

    return NextResponse.json({ trade_date: tradeDate, movers: await getMoversByDate(tradeDate) })
  } catch (error) {
    console.error('movers API failed:', error)
    return NextResponse.json({ error: 'Failed to load movers' }, { status: 500 })
  }
}
