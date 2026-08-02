import { NextRequest, NextResponse } from 'next/server'
import { getMoversByDate, getMoverHistory } from '@/lib/queries'

// Reading request.url makes this handler dynamic, so `revalidate` would be a
// no-op — the cache has to live on the response instead.
const CACHE_HEADER = { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1800' }

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
      return NextResponse.json({ code, history: await getMoverHistory(code) }, { headers: CACHE_HEADER })
    }

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }

    const movers = await getMoversByDate(date ?? null)
    return NextResponse.json(
      { trade_date: date ?? movers[0]?.trade_date ?? null, movers },
      { headers: CACHE_HEADER },
    )
  } catch (error) {
    console.error('movers API failed:', error)
    return NextResponse.json({ error: 'Failed to load movers' }, { status: 500 })
  }
}
