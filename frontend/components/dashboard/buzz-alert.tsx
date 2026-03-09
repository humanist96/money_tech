"use client"

import Link from "next/link"
import type { BuzzAlert } from "@/lib/types"

interface BuzzAlertProps {
  alerts: BuzzAlert[]
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c997",
  negative: "#ff5757",
  neutral: "#7c6cf0",
}

const TYPE_ICONS: Record<string, string> = {
  stock: "S",
  coin: "C",
  real_estate: "R",
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "-"
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

export function BuzzAlertBanner({ alerts }: BuzzAlertProps) {
  if (alerts.length === 0) return null

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden border border-[#ffb84d]/20">
      <div className="px-6 py-3 border-b border-[#1a2744]/50 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffb84d] opacity-50" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ffb84d]" />
          </span>
          <h3 className="font-bold text-[#ffb84d] text-[14px]" style={{ fontFamily: 'var(--font-outfit)' }}>
            Buzz Alert
          </h3>
        </div>
        <span className="text-[10px] text-[#5a6a88]">
          다수 채널이 동시에 언급하는 종목
        </span>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {alerts.map((alert) => {
          const sentColor = SENTIMENT_COLORS[alert.dominant_sentiment] || "#7c6cf0"
          return (
            <Link
              key={alert.asset_code}
              href={`/assets/${encodeURIComponent(alert.asset_code || alert.asset_name)}`}
              className="bg-[#0e1a30]/60 rounded-xl p-3.5 hover:bg-[#0e1a30] transition border border-[#1a2744]/30 hover:border-[#ffb84d]/30 group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[9px] font-bold w-5 h-5 rounded flex items-center justify-center"
                    style={{
                      background: `color-mix(in srgb, ${sentColor} 15%, #0a1120)`,
                      color: sentColor,
                    }}
                  >
                    {TYPE_ICONS[alert.asset_type] || "?"}
                  </span>
                  <span className="text-sm font-bold text-white group-hover:text-[#ffb84d] transition">
                    {alert.asset_name}
                  </span>
                </div>
                <span className="text-[10px] text-[#3a4a6a] tabular-nums">{timeAgo(alert.latest_at)}</span>
              </div>

              <div className="flex items-center gap-1.5 mb-2">
                <div className="flex -space-x-1">
                  {Array.from({ length: Math.min(alert.channel_count, 4) }).map((_, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full border border-[#0a1120] flex items-center justify-center text-[7px] font-bold"
                      style={{
                        background: `color-mix(in srgb, ${sentColor} 20%, #1a2744)`,
                        color: sentColor,
                      }}
                    >
                      {alert.channels[i]?.[0] || "?"}
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-[#5a6a88]">
                  {alert.channel_count}개 채널
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#3a4a6a]">{alert.mention_count}회 언급</span>
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{
                    background: `color-mix(in srgb, ${sentColor} 12%, transparent)`,
                    color: sentColor,
                  }}
                >
                  {alert.dominant_sentiment === "positive" ? "긍정" : alert.dominant_sentiment === "negative" ? "부정" : "중립"}
                </span>
              </div>

              <div className="mt-2 pt-2 border-t border-[#1a2744]/30">
                <p className="text-[9px] text-[#3a4a6a] line-clamp-1">
                  {alert.channels.join(", ")}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
