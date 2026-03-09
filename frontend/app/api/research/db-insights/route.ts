import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import type { DbInsight } from '@/lib/research-types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('keyword')?.trim()

  if (!keyword) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 })
  }

  try {
    const sql = getDb()

    // Find channels mentioning this keyword
    const channelMentions = await sql`
      SELECT
        c.name as channel_name,
        c.category,
        COUNT(DISTINCT v.id) as video_count,
        COALESCE(
          (SELECT sentiment FROM mentioned_assets ma
           WHERE ma.video_id = ANY(ARRAY_AGG(v.id))
           AND (ma.asset_name ILIKE ${'%' + keyword + '%'} OR ma.asset_code ILIKE ${'%' + keyword + '%'})
           GROUP BY sentiment ORDER BY COUNT(*) DESC LIMIT 1),
          'neutral'
        ) as dominant_sentiment
      FROM channels c
      JOIN videos v ON v.channel_id = c.id
      WHERE v.title ILIKE ${'%' + keyword + '%'}
         OR v.subtitle_text ILIKE ${'%' + keyword + '%'}
      GROUP BY c.id, c.name, c.category
      HAVING COUNT(DISTINCT v.id) > 0
      ORDER BY video_count DESC
      LIMIT 10
    `

    // Find asset mentions
    const assetMentions = await sql`
      SELECT
        ma.asset_name,
        ma.asset_code,
        COUNT(*) as mention_count,
        ROUND(100.0 * COUNT(*) FILTER (WHERE ma.sentiment = 'positive') / NULLIF(COUNT(*), 0)) as positive_pct,
        ROUND(100.0 * COUNT(*) FILTER (WHERE ma.sentiment = 'negative') / NULLIF(COUNT(*), 0)) as negative_pct
      FROM mentioned_assets ma
      WHERE ma.asset_name ILIKE ${'%' + keyword + '%'}
         OR ma.asset_code ILIKE ${'%' + keyword + '%'}
      GROUP BY ma.asset_name, ma.asset_code
      ORDER BY mention_count DESC
      LIMIT 10
    `

    // Build summary text
    const summaryParts: string[] = []
    if (channelMentions.length > 0) {
      summaryParts.push(
        `[채널 분석] "${keyword}" 관련 채널 ${channelMentions.length}개 발견:\n` +
        channelMentions.map((c) =>
          `- ${c.channel_name} (${c.category}): 영상 ${c.video_count}개, 감성: ${c.dominant_sentiment}`
        ).join('\n')
      )
    }
    if (assetMentions.length > 0) {
      summaryParts.push(
        `[종목 언급 분석]\n` +
        assetMentions.map((a) =>
          `- ${a.asset_name}${a.asset_code ? ` (${a.asset_code})` : ''}: 언급 ${a.mention_count}회, 긍정 ${a.positive_pct || 0}%, 부정 ${a.negative_pct || 0}%`
        ).join('\n')
      )
    }

    const insight: DbInsight = {
      keyword,
      channelMentions: channelMentions.map((c) => ({
        channelName: c.channel_name,
        category: c.category,
        videoCount: Number(c.video_count),
        sentiment: c.dominant_sentiment,
      })),
      assetMentions: assetMentions.map((a) => ({
        assetName: a.asset_name,
        assetCode: a.asset_code,
        mentionCount: Number(a.mention_count),
        positivePct: Number(a.positive_pct || 0),
        negativePct: Number(a.negative_pct || 0),
      })),
      summary: summaryParts.join('\n\n') || `"${keyword}"에 대한 DB 분석 데이터가 없습니다.`,
    }

    return NextResponse.json(insight)
  } catch (error) {
    console.error('DB insights error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch DB insights' },
      { status: 500 }
    )
  }
}
