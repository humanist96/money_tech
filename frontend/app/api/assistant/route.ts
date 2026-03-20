import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { getDb } from '@/lib/db'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

async function fetchAssetContext(keyword: string): Promise<string> {
  const sql = getDb()
  const parts: string[] = []

  const consensus = await sql`
    SELECT
      ma.asset_name, ma.asset_code, ma.asset_type,
      COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::int AS positive,
      COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::int AS negative,
      COUNT(CASE WHEN ma.sentiment = 'neutral' THEN 1 END)::int AS neutral,
      COUNT(*)::int AS total_mentions,
      COUNT(DISTINCT v.channel_id)::int AS channel_count,
      ARRAY_AGG(DISTINCT c.name) AS channels
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    JOIN channels c ON v.channel_id = c.id
    WHERE (ma.asset_name ILIKE ${'%' + keyword + '%'} OR ma.asset_code ILIKE ${'%' + keyword + '%'})
      AND v.published_at >= NOW() - INTERVAL '30 days'
      AND ma.sentiment IS NOT NULL
    GROUP BY ma.asset_name, ma.asset_code, ma.asset_type
    ORDER BY total_mentions DESC
    LIMIT 3
  `

  if (consensus.length > 0) {
    parts.push('[종목 컨센서스]\n' + (consensus as any[]).map((r: any) =>
      `- ${r.asset_name}(${r.asset_code || '?'}): 언급 ${r.total_mentions}회 (채널 ${r.channel_count}개), 긍정 ${r.positive} / 부정 ${r.negative} / 중립 ${r.neutral}, 언급 채널: ${(r.channels || []).slice(0, 5).join(', ')}`
    ).join('\n'))
  }

  const predictions = await sql`
    SELECT
      c.name AS channel_name,
      p.prediction_type,
      p.reason,
      p.predicted_at,
      p.direction_score::float AS direction_score,
      p.direction_1w, p.direction_1m
    FROM predictions p
    JOIN channels c ON p.channel_id = c.id
    JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
    WHERE (ma.asset_name ILIKE ${'%' + keyword + '%'} OR ma.asset_code ILIKE ${'%' + keyword + '%'})
      AND p.prediction_type IN ('buy', 'sell')
    ORDER BY p.predicted_at DESC NULLS LAST
    LIMIT 5
  `

  if (predictions.length > 0) {
    parts.push('[최근 예측]\n' + (predictions as any[]).map((r: any) =>
      `- ${r.channel_name}: ${r.prediction_type} (${r.predicted_at ? new Date(r.predicted_at).toLocaleDateString('ko-KR') : '?'}), 적중점수: ${r.direction_score != null ? Math.round(r.direction_score * 100) + '%' : '미평가'}${r.reason ? ', 사유: ' + r.reason : ''}`
    ).join('\n'))
  }

  return parts.join('\n\n') || `"${keyword}"에 대한 데이터가 DB에 없습니다.`
}

async function fetchChannelContext(keyword: string): Promise<string> {
  const sql = getDb()
  const parts: string[] = []

  const channels = await sql`
    SELECT
      c.id, c.name, c.category, c.subscriber_count, c.platform,
      c.channel_type, c.hit_rate, c.prediction_intensity_score
    FROM channels c
    WHERE c.name ILIKE ${'%' + keyword + '%'}
    ORDER BY c.subscriber_count DESC NULLS LAST
    LIMIT 3
  `

  if (channels.length > 0) {
    for (const ch of channels as any[]) {
      const hitRate = await sql`
        SELECT
          COUNT(CASE WHEN p.direction_score >= 0.5 THEN 1 END)::int AS accurate,
          COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END)::int AS total,
          CASE WHEN COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) > 0
            THEN (COUNT(CASE WHEN p.direction_score >= 0.5 THEN 1 END)::float /
                  COUNT(CASE WHEN p.direction_score IS NOT NULL THEN 1 END) * 100)
            ELSE NULL END AS rate
        FROM predictions p
        WHERE p.channel_id = ${ch.id} AND p.prediction_type IN ('buy', 'sell')
      `
      const hr = hitRate[0] as any
      parts.push(
        `[채널: ${ch.name}]\n` +
        `- 카테고리: ${ch.category || '미분류'}, 구독자: ${ch.subscriber_count ? Number(ch.subscriber_count).toLocaleString() : '?'}명\n` +
        `- 유형: ${ch.channel_type || '미분류'}, 예측강도: ${ch.prediction_intensity_score ?? '?'}\n` +
        `- 적중률: ${hr.rate != null ? Math.round(hr.rate) + '%' : '데이터 없음'} (${hr.accurate}/${hr.total}건)`
      )

      const recentPreds = await sql`
        SELECT p.prediction_type, ma.asset_name, p.direction_score::float AS score, p.predicted_at
        FROM predictions p
        LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
        WHERE p.channel_id = ${ch.id} AND p.prediction_type IN ('buy', 'sell')
        ORDER BY p.predicted_at DESC NULLS LAST
        LIMIT 5
      `
      if (recentPreds.length > 0) {
        parts.push('최근 예측: ' + (recentPreds as any[]).map((r: any) =>
          `${r.asset_name || '?'} ${r.prediction_type}(${r.score != null ? Math.round(r.score * 100) + '%' : '?'})`
        ).join(', '))
      }
    }
  }

  return parts.join('\n') || `"${keyword}" 채널을 찾을 수 없습니다.`
}

async function fetchMarketContext(): Promise<string> {
  const sql = getDb()
  const parts: string[] = []

  const tempRows = await sql`
    SELECT
      c.category,
      COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::int AS pos,
      COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::int AS neg,
      COUNT(*)::int AS total
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    JOIN channels c ON v.channel_id = c.id
    WHERE v.published_at >= NOW() - INTERVAL '7 days' AND ma.sentiment IS NOT NULL
    GROUP BY c.category
  `
  if (tempRows.length > 0) {
    parts.push('[시장 온도]\n' + (tempRows as any[]).map((r: any) => {
      const temp = r.total > 0 ? ((r.pos - r.neg) / r.total) * 50 + 50 : 50
      return `- ${r.category || '기타'}: ${Math.round(temp)}점 (긍정 ${r.pos}, 부정 ${r.neg})`
    }).join('\n'))
  }

  const buzzRows = await sql`
    SELECT
      ma.asset_name, ma.asset_code,
      COUNT(DISTINCT v.channel_id)::int AS ch_count,
      COUNT(*)::int AS mentions,
      MODE() WITHIN GROUP (ORDER BY ma.sentiment) AS sentiment
    FROM mentioned_assets ma
    JOIN videos v ON ma.video_id = v.id
    WHERE v.published_at >= NOW() - INTERVAL '48 hours'
      AND ma.asset_code IS NOT NULL AND ma.sentiment IS NOT NULL
    GROUP BY ma.asset_name, ma.asset_code
    HAVING COUNT(DISTINCT v.channel_id) >= 2
    ORDER BY ch_count DESC, mentions DESC
    LIMIT 5
  `
  if (buzzRows.length > 0) {
    parts.push('[버즈 종목 (48h)]\n' + (buzzRows as any[]).map((r: any) =>
      `- ${r.asset_name}(${r.asset_code}): ${r.ch_count}개 채널, ${r.mentions}회 언급, 분위기: ${r.sentiment}`
    ).join('\n'))
  }

  const leaderboard = await sql`
    SELECT * FROM mv_hit_rate_leaderboard LIMIT 5
  `
  if (leaderboard.length > 0) {
    parts.push('[적중률 TOP 5]\n' + (leaderboard as any[]).map((r: any, i: number) =>
      `${i + 1}. ${r.channel_name}: ${Math.round(Number(r.hit_rate) * 100) || 0}% (${r.total_evaluated}건)`
    ).join('\n'))
  }

  return parts.join('\n\n') || '시장 데이터를 가져올 수 없습니다.'
}

function detectQueryType(message: string): 'asset' | 'channel' | 'market' {
  const channelKeywords = ['채널', '유튜버', '크리에이터', '적중률', '리더보드', '1위', '순위']
  const marketKeywords = ['시장', '전체', '온도', '분위기', '트렌드', '급등', '버즈', '종합']

  const lower = message.toLowerCase()
  if (channelKeywords.some(k => lower.includes(k))) return 'channel'
  if (marketKeywords.some(k => lower.includes(k))) return 'market'
  return 'asset'
}

function extractKeyword(message: string): string {
  const cleaned = message
    .replace(/[은는이가을를에서의로도만요까]$/g, '')
    .replace(/(컨센서스|전망|예측|분석|알려줘|어때|어떻게|어떤|뭐야|뭔가|에 대해|에대해|좀|해줘|해 줘)/g, '')
    .trim()

  const words = cleaned.split(/\s+/).filter(w => w.length >= 2)
  return words[0] || message.trim().split(/\s+/)[0] || message.trim()
}

const SYSTEM_PROMPT = `당신은 MoneyTech AI 어시스턴트입니다. 유튜브/블로그 크리에이터들의 투자 예측 데이터를 분석하여 사용자에게 인사이트를 제공합니다.

역할:
- 크리에이터 컨센서스(다수 의견), 적중률, 센티먼트를 기반으로 답변
- 데이터 기반으로 객관적 분석 제공
- 투자 조언이 아닌 "크리에이터들의 의견 분석"임을 명확히

답변 규칙:
- 한국어로 간결하게 답변 (300자 이내 권장)
- 숫자와 데이터를 적극 활용
- 매수/매도 추천은 하지 않고, 크리에이터들의 의견 분포를 전달
- DB 데이터가 없으면 솔직하게 "데이터가 부족하다"고 안내
- 마크다운 볼드(**), 리스트(-) 활용하여 읽기 쉽게 구성`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, history } = body as {
      message: string
      history?: ChatMessage[]
    }

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const queryType = detectQueryType(message)
    let dbContext: string

    switch (queryType) {
      case 'channel':
        dbContext = await fetchChannelContext(extractKeyword(message))
        break
      case 'market':
        dbContext = await fetchMarketContext()
        break
      default:
        dbContext = await fetchAssetContext(extractKeyword(message))
        break
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `[DB 컨텍스트]\n${dbContext}` },
      ...(history || []).slice(-10),
      { role: 'user', content: message },
    ]

    const openai = new OpenAI()

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1024,
      stream: true,
    })

    const encoder = new TextEncoder()

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content
            if (text) {
              controller.enqueue(encoder.encode(text))
            }
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
