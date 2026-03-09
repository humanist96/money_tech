import { notFound } from "next/navigation"
import Link from "next/link"
import { getAssetDetail, getAssetTimeline, formatViewCount, timeAgo } from "@/lib/queries"
import { AssetTimeline } from "@/components/dashboard/asset-timeline"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ code: string }>
}

const SENTIMENT_LABELS: Record<string, string> = {
  positive: "긍정",
  negative: "부정",
  neutral: "중립",
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c997",
  negative: "#ff5757",
  neutral: "#7c6cf0",
}

const TYPE_LABELS: Record<string, string> = {
  stock: "주식",
  coin: "코인",
  real_estate: "부동산",
}

export default async function AssetDetailPage({ params }: PageProps) {
  const { code } = await params
  const decodedCode = decodeURIComponent(code)
  const [mentions, timeline] = await Promise.all([
    getAssetDetail(decodedCode),
    getAssetTimeline(decodedCode, 30),
  ])

  if (!mentions || mentions.length === 0) notFound()

  const assetName = mentions[0].asset_name
  const assetType = mentions[0].asset_type

  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 }
  const channelOpinions = new Map<string, { name: string; sentiment: string; videoTitle: string; date: string }>()

  for (const m of mentions) {
    const s = m.sentiment || "neutral"
    sentimentCounts[s as keyof typeof sentimentCounts]++
    if (!channelOpinions.has(m.channel_name)) {
      channelOpinions.set(m.channel_name, {
        name: m.channel_name,
        sentiment: s,
        videoTitle: m.video_title || "",
        date: m.video_published_at || "",
      })
    }
  }

  const total = sentimentCounts.positive + sentimentCounts.negative + sentimentCounts.neutral
  const consensus = total > 0
    ? sentimentCounts.positive > sentimentCounts.negative
      ? `긍정 우세 (${Math.round((sentimentCounts.positive / total) * 100)}%)`
      : sentimentCounts.negative > sentimentCounts.positive
      ? `부정 우세 (${Math.round((sentimentCounts.negative / total) * 100)}%)`
      : "중립"
    : "분석중"

  return (
    <div className="space-y-8">
      <Link href="/" className="inline-flex items-center gap-2 text-xs text-th-dim hover:text-th-accent transition group">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-0.5 transition-transform">
          <path d="m15 18-6-6 6-6" />
        </svg>
        대시보드
      </Link>

      <div className="glass-card-elevated rounded-2xl p-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold"
            style={{
              background: "linear-gradient(135deg, rgba(0,232,184,0.12), rgba(124,108,240,0.12))",
              color: "#00e8b8",
            }}>
            {assetName[0]}
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-th-primary" style={{ fontFamily: 'var(--font-outfit)' }}>
              {assetName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-th-dim">{decodedCode}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-th-tertiary text-th-muted border border-th-border">
                {TYPE_LABELS[assetType] || assetType}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mt-8 pt-6 border-t border-th-border/50">
          <div>
            <p className="text-[10px] text-th-dim uppercase tracking-wider font-medium">총 언급</p>
            <p className="text-2xl font-bold text-[#00e8b8] mt-1 tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
              {mentions.length}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-th-dim uppercase tracking-wider font-medium">언급 채널</p>
            <p className="text-2xl font-bold text-[#7c6cf0] mt-1 tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
              {channelOpinions.size}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-th-dim uppercase tracking-wider font-medium">합의도</p>
            <p className="text-lg font-bold text-th-primary mt-1">{consensus}</p>
          </div>
          <div>
            <p className="text-[10px] text-th-dim uppercase tracking-wider font-medium">유형</p>
            <p className="text-lg font-bold text-[#ffb84d] mt-1">{TYPE_LABELS[assetType]}</p>
          </div>
        </div>
      </div>

      {/* YouTuber Timeline */}
      <AssetTimeline entries={timeline} assetName={assetName} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 glass-card-elevated rounded-2xl p-6">
          <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>유튜버 의견 종합</h3>
          <div className="space-y-3">
            {(["positive", "negative", "neutral"] as const).map((s) => {
              const count = sentimentCounts[s]
              const ratio = total > 0 ? count / total : 0
              const color = SENTIMENT_COLORS[s]
              return (
                <div key={s}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color }}>{SENTIMENT_LABELS[s]}</span>
                    <span className="text-th-dim tabular-nums">{count}건 ({Math.round(ratio * 100)}%)</span>
                  </div>
                  <div className="h-2.5 bg-th-card rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${ratio * 100}%`, background: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <h4 className="text-[10px] text-th-dim uppercase tracking-wider font-medium mt-6 mb-3">채널별 의견</h4>
          <div className="space-y-1.5">
            {Array.from(channelOpinions.values()).map((op) => {
              const color = SENTIMENT_COLORS[op.sentiment] || "#7c6cf0"
              return (
                <div key={op.name} className="flex items-center justify-between bg-th-tertiary/50 rounded-xl px-3.5 py-2.5">
                  <span className="text-sm text-th-primary font-medium">{op.name}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                    style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                    {SENTIMENT_LABELS[op.sentiment] || "중립"}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="lg:col-span-3 glass-card-elevated rounded-2xl p-6">
          <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>관련 영상</h3>
          <div className="space-y-2">
            {mentions.slice(0, 15).map((m: any, i: number) => (
              <a
                key={i}
                href={m.blog_post_url || (m.youtube_video_id ? `https://www.youtube.com/watch?v=${m.youtube_video_id}` : '#')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 bg-th-tertiary/40 rounded-xl p-3.5 hover:bg-th-tertiary/70 transition group"
              >
                {m.blog_post_url ? (
                  <div className="w-28 h-16 rounded-xl shrink-0 flex items-center justify-center" style={{ background: 'color-mix(in srgb, #03c75a 10%, var(--th-bg-card))' }}>
                    <span className="text-[10px] font-bold text-[#03c75a]">BLOG</span>
                  </div>
                ) : m.youtube_video_id ? (
                  <img src={`https://i.ytimg.com/vi/${m.youtube_video_id}/mqdefault.jpg`} alt="" className="w-28 h-16 rounded-xl object-cover shrink-0" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-th-primary font-medium line-clamp-2 group-hover:text-th-accent transition">
                    {m.video_title || m.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-th-dim">{m.channel_name}</span>
                    {m.video_published_at && (
                      <span className="text-[10px] text-th-dim tabular-nums">{timeAgo(m.video_published_at)}</span>
                    )}
                    {m.video_view_count != null && (
                      <span className="text-[10px] text-th-dim tabular-nums">조회수 {formatViewCount(m.video_view_count)}</span>
                    )}
                  </div>
                  {m.sentiment && (
                    <span className="inline-block mt-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                      style={{
                        background: `color-mix(in srgb, ${SENTIMENT_COLORS[m.sentiment] || "#7c6cf0"} 10%, transparent)`,
                        color: SENTIMENT_COLORS[m.sentiment] || "#7c6cf0",
                      }}>
                      {SENTIMENT_LABELS[m.sentiment] || "중립"}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
