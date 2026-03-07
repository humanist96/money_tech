import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import type { SearchResult } from '@/lib/types'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('keyword')?.trim()
  const sortBy = searchParams.get('sortBy') === 'date' ? 'date' : 'relevance'
  const maxResults = Math.min(Number(searchParams.get('maxResults') || 10), 20)

  if (!keyword) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 })
  }

  if (!YOUTUBE_API_KEY) {
    return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 })
  }

  try {
    const sql = getDb()

    // Check cache (1 hour TTL)
    const cached = await sql`
      SELECT results FROM search_cache
      WHERE keyword = ${keyword} AND sort_by = ${sortBy} AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `

    if (cached.length > 0) {
      return NextResponse.json({
        results: cached[0].results as SearchResult[],
        cached: true,
      })
    }

    // YouTube Search API
    const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`)
    searchUrl.searchParams.set('part', 'snippet')
    searchUrl.searchParams.set('type', 'video')
    searchUrl.searchParams.set('q', keyword)
    searchUrl.searchParams.set('order', sortBy)
    searchUrl.searchParams.set('maxResults', String(maxResults))
    searchUrl.searchParams.set('relevanceLanguage', 'ko')
    searchUrl.searchParams.set('key', YOUTUBE_API_KEY)

    const searchRes = await fetch(searchUrl.toString())
    if (!searchRes.ok) {
      const err = await searchRes.json()
      return NextResponse.json(
        { error: `YouTube API error: ${err.error?.message || searchRes.statusText}` },
        { status: searchRes.status }
      )
    }

    const searchData = await searchRes.json()
    const videoIds = searchData.items?.map((item: { id: { videoId: string } }) => item.id.videoId) || []

    if (videoIds.length === 0) {
      return NextResponse.json({ results: [], cached: false })
    }

    // Get video details (viewCount, duration)
    const videosUrl = new URL(`${YOUTUBE_API_BASE}/videos`)
    videosUrl.searchParams.set('part', 'statistics,contentDetails')
    videosUrl.searchParams.set('id', videoIds.join(','))
    videosUrl.searchParams.set('key', YOUTUBE_API_KEY)

    const videosRes = await fetch(videosUrl.toString())
    const videosData = videosRes.ok ? await videosRes.json() : { items: [] }

    const videoDetails = new Map<string, { viewCount: number; duration: number }>()
    for (const item of videosData.items || []) {
      videoDetails.set(item.id, {
        viewCount: Number(item.statistics?.viewCount || 0),
        duration: parseDuration(item.contentDetails?.duration || 'PT0S'),
      })
    }

    // Check registered channels
    const channelIds = [...new Set(searchData.items.map((item: { snippet: { channelId: string } }) => item.snippet.channelId))]
    const registeredChannels = await sql`
      SELECT id, youtube_channel_id FROM channels
      WHERE youtube_channel_id = ANY(${channelIds as string[]})
    `
    const channelMap = new Map<string, string>()
    for (const ch of registeredChannels) {
      channelMap.set(ch.youtube_channel_id, ch.id)
    }

    // Build results
    const results: SearchResult[] = searchData.items.map((item: {
      id: { videoId: string }
      snippet: {
        title: string
        channelTitle: string
        channelId: string
        publishedAt: string
        thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } }
      }
    }) => {
      const details = videoDetails.get(item.id.videoId)
      const registeredId = channelMap.get(item.snippet.channelId)
      return {
        videoId: item.id.videoId,
        title: decodeHtmlEntities(item.snippet.title),
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt,
        viewCount: details?.viewCount ?? 0,
        duration: details?.duration ?? 0,
        thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
        isRegisteredChannel: !!registeredId,
        registeredChannelId: registeredId,
      }
    })

    // Cache results
    await sql`
      INSERT INTO search_cache (keyword, sort_by, results)
      VALUES (${keyword}, ${sortBy}, ${JSON.stringify(results)})
    `

    return NextResponse.json({ results, cached: false })
  } catch (error) {
    console.error('YouTube search error:', error)
    return NextResponse.json(
      { error: 'Failed to search YouTube' },
      { status: 500 }
    )
  }
}

function parseDuration(iso8601: string): number {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = Number(match[1] || 0)
  const minutes = Number(match[2] || 0)
  const seconds = Number(match[3] || 0)
  return hours * 3600 + minutes * 60 + seconds
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
