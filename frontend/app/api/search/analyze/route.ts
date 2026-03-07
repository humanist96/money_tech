import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getDb } from '@/lib/db'
import type { VideoAnalysis } from '@/lib/types'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { videoId } = body

  if (!videoId || typeof videoId !== 'string') {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
  }

  try {
    const sql = getDb()

    // Check cache
    const cached = await sql`
      SELECT * FROM video_analysis WHERE youtube_video_id = ${videoId} LIMIT 1
    `

    if (cached.length > 0) {
      const row = cached[0]
      const analysis: VideoAnalysis = {
        youtube_video_id: row.youtube_video_id,
        title: row.title,
        channel_name: row.channel_name,
        channel_id: row.channel_id,
        summary: row.summary,
        sentiment: row.sentiment,
        mentioned_assets: row.mentioned_assets as VideoAnalysis['mentioned_assets'],
        predictions: row.predictions as VideoAnalysis['predictions'],
        key_points: row.key_points as VideoAnalysis['key_points'],
        analyzed_at: row.analyzed_at,
      }
      return NextResponse.json({ analysis, cached: true })
    }

    // Fetch video details from YouTube
    const videoUrl = new URL(`${YOUTUBE_API_BASE}/videos`)
    videoUrl.searchParams.set('part', 'snippet')
    videoUrl.searchParams.set('id', videoId)
    videoUrl.searchParams.set('key', YOUTUBE_API_KEY)

    const videoRes = await fetch(videoUrl.toString())
    if (!videoRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch video info' }, { status: 502 })
    }

    const videoData = await videoRes.json()
    const videoInfo = videoData.items?.[0]
    if (!videoInfo) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    const title = videoInfo.snippet.title
    const channelTitle = videoInfo.snippet.channelTitle
    const channelId = videoInfo.snippet.channelId
    const description = videoInfo.snippet.description || ''
    const tags = videoInfo.snippet.tags || []

    // Try to get captions
    let sourceText = ''
    try {
      const captionsUrl = new URL(`${YOUTUBE_API_BASE}/captions`)
      captionsUrl.searchParams.set('part', 'snippet')
      captionsUrl.searchParams.set('videoId', videoId)
      captionsUrl.searchParams.set('key', YOUTUBE_API_KEY)

      const captionsRes = await fetch(captionsUrl.toString())
      if (captionsRes.ok) {
        const captionsData = await captionsRes.json()
        const koCaption = captionsData.items?.find(
          (c: { snippet: { language: string } }) => c.snippet.language === 'ko'
        )
        const anyCaption = captionsData.items?.[0]
        const captionId = koCaption?.id || anyCaption?.id

        if (captionId) {
          // Note: captions.download requires OAuth, so we'll fall back to description
          // This is left as a placeholder for future OAuth integration
        }
      }
    } catch {
      // Captions API failed, fall back to description
    }

    // Fallback: use title + description + tags
    sourceText = [
      `제목: ${title}`,
      `채널: ${channelTitle}`,
      tags.length > 0 ? `태그: ${tags.join(', ')}` : '',
      `설명:\n${description.substring(0, 3000)}`,
    ].filter(Boolean).join('\n\n')

    // Call OpenAI for analysis
    const openai = new OpenAI()

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `당신은 재테크/투자 유튜브 콘텐츠 분석 전문가입니다. 주어진 영상 정보를 분석하여 반드시 JSON만 응답하세요.

응답 형식:
{
  "summary": "핵심 내용 3줄 요약 (한국어)",
  "sentiment": "positive 또는 negative 또는 neutral",
  "key_points": ["핵심 포인트1", "핵심 포인트2", ...],
  "mentioned_assets": [{"name": "종목명", "code": "종목코드 또는 null", "type": "stock 또는 coin 또는 real_estate", "sentiment": "positive 또는 negative 또는 neutral"}],
  "predictions": [{"type": "buy 또는 sell 또는 hold", "asset": "종목명", "reason": "이유"}]
}

분석 시 주의사항:
- 영상 정보가 부족하면 가용한 정보로 최선의 분석을 하세요
- mentioned_assets에는 구체적 종목/코인/부동산만 포함 (일반적 카테고리 제외)
- predictions는 영상에서 명시적으로 매수/매도/보유 의견이 있을 때만 포함
- 한국 주식 코드는 6자리 숫자 (예: 005930)`,
        },
        {
          role: 'user',
          content: sourceText,
        },
      ],
    })

    // Parse AI response
    const aiText = completion.choices[0]?.message?.content || ''
    let parsed
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = aiText.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch?.[0] || aiText)
    } catch {
      parsed = {
        summary: '분석 결과를 파싱할 수 없습니다.',
        sentiment: 'neutral',
        key_points: [],
        mentioned_assets: [],
        predictions: [],
      }
    }

    // Save to DB
    await sql`
      INSERT INTO video_analysis (youtube_video_id, title, channel_name, channel_id, summary, sentiment, mentioned_assets, predictions, key_points, source_text)
      VALUES (${videoId}, ${title}, ${channelTitle}, ${channelId}, ${parsed.summary}, ${parsed.sentiment}, ${JSON.stringify(parsed.mentioned_assets || [])}, ${JSON.stringify(parsed.predictions || [])}, ${JSON.stringify(parsed.key_points || [])}, ${sourceText.substring(0, 5000)})
      ON CONFLICT (youtube_video_id) DO UPDATE SET
        summary = EXCLUDED.summary,
        sentiment = EXCLUDED.sentiment,
        mentioned_assets = EXCLUDED.mentioned_assets,
        predictions = EXCLUDED.predictions,
        key_points = EXCLUDED.key_points,
        analyzed_at = NOW()
    `

    const analysis: VideoAnalysis = {
      youtube_video_id: videoId,
      title,
      channel_name: channelTitle,
      channel_id: channelId,
      summary: parsed.summary,
      sentiment: parsed.sentiment,
      mentioned_assets: parsed.mentioned_assets || [],
      predictions: parsed.predictions || [],
      key_points: parsed.key_points || [],
      analyzed_at: new Date().toISOString(),
    }

    return NextResponse.json({ analysis, cached: false })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze video' },
      { status: 500 }
    )
  }
}
