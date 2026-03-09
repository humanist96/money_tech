import { NextRequest, NextResponse } from 'next/server'
import { getChannelProfile } from '@/lib/queries'

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('ids')
  if (!ids) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 })
  }

  const channelIds = ids.split(',').filter(Boolean)
  if (channelIds.length === 0 || channelIds.length > 3) {
    return NextResponse.json({ error: 'Provide 1-3 channel IDs' }, { status: 400 })
  }

  const profiles = await Promise.all(
    channelIds.map(async (id) => {
      const profile = await getChannelProfile(id)
      return { id, profile }
    })
  )

  return NextResponse.json(profiles)
}
