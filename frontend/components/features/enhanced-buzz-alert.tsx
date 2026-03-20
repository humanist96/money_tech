"use client"

import Link from "next/link"
import type { BuzzAlertEnhanced } from "@/lib/types"

interface EnhancedBuzzAlertProps {
  alerts: BuzzAlertEnhanced[]
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c997",
  negative: "#ff5757",
  neutral: "#7c6cf0",
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

export function EnhancedBuzzAlertPanel({ alerts }: EnhancedBuzzAlertProps) {
  if (alerts.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>
          떡상 조기경보
        </h3>
        <p className="text-sm text-th-dim">현재 급등 종목이 감지되지 않았습니다.</p>
      </div>
    )
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden border border-[#ff5757]/15">
      <div className="px-6 py-3 border-b border-th-border/50 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff5757] opacity-50" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ff5757]" />
          </span>
          <h3 className="font-bold text-[#ff5757] text-[14px]" style={{ fontFamily: 'var(--font-outfit)' }}>
            떡상 조기경보
          </h3>
        </div>
        <span className="text-[10px] text-th-dim">
          다수 채널 동시 언급 + 급등 감지
        </span>
      </div>

      <div className="divide-y divide-th-border/25">
        {alerts.map((alert) => {
          const sentColor = SENTIMENT_COLORS[alert.dominant_sentiment] || "#7c6cf0"
          const growthRate = Number(alert.growth_rate) || 0
          const isNewBuzz = growthRate >= 999
          const growthLabel = isNewBuzz ? "NEW" : `+${Math.round(growthRate)}%`
          const growthColor = growthRate >= 300 ? "#ff5757" : growthRate >= 100 ? "#ffb84d" : "#7c6cf0"

          return (
            <Link
              key={alert.asset_code}
              href={`/assets/${encodeURIComponent(alert.asset_code || alert.asset_name)}`}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-th-hover/40 transition group"
            >
              {/* Growth Badge */}
              <div className="shrink-0 text-center">
                <div
                  className="text-xs font-bold px-2 py-1 rounded-lg"
                  style={{ background: `color-mix(in srgb, ${growthColor} 12%, transparent)`, color: growthColor }}
                >
                  {growthLabel}
                </div>
                <span className="text-[8px] text-th-dim mt-0.5 block">전주 대비</span>
              </div>

              {/* Asset Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-th-primary group-hover:text-[#ff5757] transition">
                    {alert.asset_name}
                  </span>
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                    style={{ background: `color-mix(in srgb, ${sentColor} 12%, transparent)`, color: sentColor }}
                  >
                    {alert.dominant_sentiment === "positive" ? "긍정" : alert.dominant_sentiment === "negative" ? "부정" : "중립"}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-th-dim">
                  <span>{alert.channel_count}개 채널</span>
                  <span>|</span>
                  <span>{alert.mention_count}회 언급</span>
                  <span>|</span>
                  <span>{timeAgo(alert.latest_at)}</span>
                </div>
                <p className="text-[9px] text-th-dim mt-1 line-clamp-1">{alert.channels?.join(", ")}</p>
              </div>

              {/* Weighted Score */}
              <div className="shrink-0 text-right">
                <div
                  className="text-lg font-bold tabular-nums"
                  style={{ fontFamily: 'var(--font-outfit)', color: '#ff5757' }}
                >
                  {Math.round(Number(alert.weighted_score) || 0)}
                </div>
                <span className="text-[8px] text-th-dim">가중 점수</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
