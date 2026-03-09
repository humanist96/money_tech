"use client"

import Link from "next/link"
import type { AssetTimelineEntry } from "@/lib/types"
import { CATEGORY_COLORS } from "@/lib/types"

interface AssetTimelineProps {
  entries: AssetTimelineEntry[]
  assetName: string
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c997",
  negative: "#ff5757",
  neutral: "#7c6cf0",
}

const PREDICTION_BADGES: Record<string, { label: string; color: string }> = {
  buy: { label: "매수", color: "#22c997" },
  sell: { label: "매도", color: "#ff5757" },
  hold: { label: "관망", color: "#ffb84d" },
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return "방금"
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

export function AssetTimeline({ entries, assetName }: AssetTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>
          유튜버 타임라인
        </h3>
        <p className="text-sm text-th-dim">최근 30일간 데이터가 없습니다.</p>
      </div>
    )
  }

  // Group by date
  const byDate = new Map<string, AssetTimelineEntry[]>()
  for (const e of entries) {
    const dateKey = e.published_at ? new Date(e.published_at).toISOString().split("T")[0] : "unknown"
    const list = byDate.get(dateKey) || []
    list.push(e)
    byDate.set(dateKey, list)
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
          유튜버 타임라인 — {assetName}
        </h3>
        <p className="text-[11px] text-th-dim mt-0.5">어떤 유튜버가 언제 이 종목을 언급했는지</p>
      </div>
      <div className="px-6 py-4 max-h-[520px] overflow-y-auto">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gradient-to-b from-th-border via-th-border to-transparent" />

          {Array.from(byDate.entries()).map(([dateKey, items]) => (
            <div key={dateKey} className="mb-5">
              {/* Date marker */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-[37px] h-5 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-th-tertiary border-2 border-th-strong z-10" />
                </div>
                <span className="text-[11px] font-bold text-th-dim tabular-nums">
                  {dateKey !== "unknown" ? formatDate(dateKey) : "-"}
                </span>
              </div>

              {/* Entries for this date */}
              <div className="space-y-2 ml-[37px]">
                {items.map((entry, i) => {
                  const catColor = CATEGORY_COLORS[entry.category] || "#6b7280"
                  const sentColor = SENTIMENT_COLORS[entry.sentiment] || "#7c6cf0"
                  const pred = entry.prediction_type ? PREDICTION_BADGES[entry.prediction_type] : null

                  return (
                    <div key={i} className="flex items-start gap-3 bg-th-tertiary/40 rounded-xl p-3 hover:bg-th-tertiary/70 transition group">
                      {/* Channel avatar */}
                      <div className="shrink-0">
                        {entry.channel_thumbnail ? (
                          <img src={entry.channel_thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                            style={{ background: `color-mix(in srgb, ${catColor} 15%, var(--th-bg-card))`, color: catColor }}
                          >
                            {entry.channel_name[0]}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/channels/${entry.channel_id}`}
                            className="text-xs font-medium text-th-muted hover:text-th-accent transition"
                          >
                            {entry.channel_name}
                          </Link>
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                            style={{
                              background: `color-mix(in srgb, ${sentColor} 12%, transparent)`,
                              color: sentColor,
                              border: `1px solid color-mix(in srgb, ${sentColor} 25%, transparent)`,
                            }}
                          >
                            {entry.sentiment === "positive" ? "긍정" : entry.sentiment === "negative" ? "부정" : "중립"}
                          </span>
                          {pred && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{
                                background: `color-mix(in srgb, ${pred.color} 12%, transparent)`,
                                color: pred.color,
                                border: `1px solid color-mix(in srgb, ${pred.color} 25%, transparent)`,
                              }}
                            >
                              {pred.label}
                            </span>
                          )}
                        </div>
                        <a
                          href={`https://www.youtube.com/watch?v=${entry.youtube_video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-[#c8d0e0] line-clamp-1 mt-0.5 group-hover:text-th-primary transition"
                        >
                          {entry.video_title}
                        </a>
                      </div>

                      <span className="text-[10px] text-th-dim shrink-0 tabular-nums">
                        {entry.published_at ? timeAgo(entry.published_at) : "-"}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
