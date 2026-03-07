import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getDb } from '@/lib/db'
import type { VideoAnalysis, SearchReport } from '@/lib/types'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { videoIds } = body

  if (!Array.isArray(videoIds) || videoIds.length === 0 || videoIds.length > 5) {
    return NextResponse.json(
      { error: 'videoIds must be an array of 1-5 video IDs' },
      { status: 400 }
    )
  }

  try {
    const sql = getDb()

    // Fetch all analyses (should be cached from individual analysis calls)
    const analyses = await sql`
      SELECT * FROM video_analysis WHERE youtube_video_id = ANY(${videoIds})
    `

    if (analyses.length === 0) {
      return NextResponse.json(
        { error: 'No analyses found. Analyze individual videos first.' },
        { status: 400 }
      )
    }

    const analysisData: VideoAnalysis[] = analyses.map((row) => ({
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
    }))

    // Prepare summary for Claude
    const analysisText = analysisData
      .map(
        (a, i) =>
          `[영상 ${i + 1}] ${a.title} (${a.channel_name})
요약: ${a.summary}
감성: ${a.sentiment}
핵심 포인트: ${(a.key_points || []).join(', ')}
언급 종목: ${(a.mentioned_assets || []).map((m) => `${m.name}(${m.sentiment})`).join(', ') || '없음'}
예측: ${(a.predictions || []).map((p) => `${p.asset} ${p.type}: ${p.reason}`).join(', ') || '없음'}`
      )
      .join('\n\n')

    const openai = new OpenAI()

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `당신은 재테크/투자 유튜브 콘텐츠 종합 분석 전문가입니다. 여러 영상의 분석 결과를 종합하여 반드시 JSON만 응답하세요.

응답 형식:
{
  "overall_summary": "전체 영상들의 핵심 내용 종합 요약 (3-5문장, 한국어)",
  "consensus": "유튜버들의 공통 의견 (한국어)",
  "sentiment_distribution": {"positive": 숫자, "negative": 숫자, "neutral": 숫자},
  "key_arguments": ["주요 근거1", "주요 근거2", ...],
  "conflicts": ["의견 충돌 사항1", "의견 충돌 사항2", ...]
}

분석 시 주의사항:
- 의견이 일치하는 부분과 충돌하는 부분을 명확히 구분
- sentiment_distribution은 분석된 영상 수 기준 (합계 = 총 영상 수)
- conflicts가 없으면 빈 배열`,
        },
        {
          role: 'user',
          content: `다음 ${analysisData.length}개 영상의 분석 결과를 종합해주세요:\n\n${analysisText}`,
        },
      ],
    })

    const aiText = completion.choices[0]?.message?.content || ''
    let report: SearchReport
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/)
      report = JSON.parse(jsonMatch?.[0] || aiText)
    } catch {
      report = {
        overall_summary: '종합 분석 결과를 파싱할 수 없습니다.',
        consensus: '',
        sentiment_distribution: { positive: 0, negative: 0, neutral: 0 },
        key_arguments: [],
        conflicts: [],
      }
    }

    return NextResponse.json({ report, analyses: analysisData })
  } catch (error) {
    console.error('Report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
