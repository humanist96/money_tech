import { notFound } from "next/navigation"
import Link from "next/link"
import { getAssetDetail, formatViewCount, timeAgo } from "@/lib/queries"

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
  positive: "#10b981",
  negative: "#ef4444",
  neutral: "#6366f1",
}

const TYPE_LABELS: Record<string, string> = {
  stock: "주식",
  coin: "코인",
  real_estate: "부동산",
}

export default async function AssetDetailPage({ params }: PageProps) {
  const { code } = await params
  const decodedCode = decodeURIComponent(code)
  const mentions = await getAssetDetail(decodedCode)

  if (!mentions || mentions.length === 0) notFound()

  const assetName = mentions[0].asset_name
  const assetType = mentions[0].asset_type

  // Aggregate sentiment
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
      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#00d4aa] transition">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        대시보드
      </Link>

      {/* Header */}
      <div className="glass-card rounded-2xl p-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold"
            style={{
              background: "linear-gradient(135deg, #00d4aa20, #6366f120)",
              color: "#00d4aa",
            }}>
            {assetName[0]}
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white" style={{ fontFamily: 'var(--font-outfit)' }}>
              {assetName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-[#64748b]">{decodedCode}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1e293b] text-[#94a3b8]">
                {TYPE_LABELS[assetType] || assetType}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-6 mt-8 pt-6 border-t border-[#1e293b]/60">
          <div>
            <p className="text-[10px] text-[#475569] uppercase tracking-wider">총 언급</p>
            <p className="text-2xl font-bold text-[#00d4aa] mt-1 tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
              {mentions.length}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#475569] uppercase tracking-wider">언급 채널</p>
            <p className="text-2xl font-bold text-[#6366f1] mt-1 tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
              {channelOpinions.size}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#475569] uppercase tracking-wider">합의도</p>
            <p className="text-lg font-bold text-white mt-1">{consensus}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#475569] uppercase tracking-wider">유형</p>
            <p className="text-lg font-bold text-[#f59e0b] mt-1">{TYPE_LABELS[assetType]}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Sentiment breakdown */}
        <div className="lg:col-span-2 glass-card rounded-xl p-6">
          <h3 className="font-semibold text-white mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>유튜버 의견 종합</h3>
          <div className="space-y-3">
            {(["positive", "negative", "neutral"] as const).map((s) => {
              const count = sentimentCounts[s]
              const ratio = total > 0 ? count / total : 0
              const color = SENTIMENT_COLORS[s]
              return (
                <div key={s}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color }}>{SENTIMENT_LABELS[s]}</span>
                    <span className="text-[#64748b]">{count}건 ({Math.round(ratio * 100)}%)</span>
                  </div>
                  <div className="h-3 bg-[#0f1a2e] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${ratio * 100}%`, background: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Channel opinions */}
          <h4 className="text-xs text-[#64748b] uppercase tracking-wider mt-6 mb-3">채널별 의견</h4>
          <div className="space-y-2">
            {Array.from(channelOpinions.values()).map((op) => {
              const color = SENTIMENT_COLORS[op.sentiment] || "#6366f1"
              return (
                <div key={op.name} className="flex items-center justify-between bg-[#111d35]/50 rounded-lg px-3 py-2">
                  <span className="text-sm text-white">{op.name}</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
                    {SENTIMENT_LABELS[op.sentiment] || "중립"}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Related videos */}
        <div className="lg:col-span-3 glass-card rounded-xl p-6">
          <h3 className="font-semibold text-white mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>관련 영상</h3>
          <div className="space-y-3">
            {mentions.slice(0, 15).map((m: any, i: number) => (
              <a
                key={i}
                href={`https://www.youtube.com/watch?v=${m.youtube_video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 bg-[#111d35]/50 rounded-lg p-3 hover:bg-[#111d35] transition group"
              >
                {m.video_thumbnail && (
                  <img src={m.video_thumbnail} alt="" className="w-28 h-16 rounded object-cover shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium line-clamp-2 group-hover:text-[#00d4aa] transition">
                    {m.video_title || m.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-[#64748b]">{m.channel_name}</span>
                    {m.video_published_at && (
                      <span className="text-[10px] text-[#475569]">{timeAgo(m.video_published_at)}</span>
                    )}
                    {m.video_view_count != null && (
                      <span className="text-[10px] text-[#475569]">조회수 {formatViewCount(m.video_view_count)}</span>
                    )}
                  </div>
                  {m.sentiment && (
                    <span className="inline-block mt-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{
                        background: `color-mix(in srgb, ${SENTIMENT_COLORS[m.sentiment] || "#6366f1"} 15%, transparent)`,
                        color: SENTIMENT_COLORS[m.sentiment] || "#6366f1",
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
