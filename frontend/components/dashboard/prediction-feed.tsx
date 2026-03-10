"use client"

import type { PredictionFeedItem } from "@/lib/types"
import { CATEGORY_COLORS } from "@/lib/types"

interface PredictionFeedProps {
  predictions: PredictionFeedItem[]
  title?: string
}

const PREDICTION_BADGES: Record<string, { label: string; color: string }> = {
  buy: { label: "매수", color: "#22c997" },
  sell: { label: "매도", color: "#ff5757" },
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "-"
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

function DirectionIndicator({ d1w, d1m, d3m }: { d1w: boolean | null; d1m: boolean | null; d3m: boolean | null }) {
  const periods = [
    { label: '1주', value: d1w },
    { label: '1월', value: d1m },
    { label: '3월', value: d3m },
  ]
  const evaluated = periods.filter(p => p.value !== null)
  if (evaluated.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {periods.map((p) => (
        <span
          key={p.label}
          className={`text-[8px] px-1 py-0.5 rounded font-medium ${
            p.value === null
              ? 'text-th-dim'
              : p.value
                ? 'bg-[#22c997]/12 text-[#22c997]'
                : 'bg-[#ff5757]/12 text-[#ff5757]'
          }`}
        >
          {p.label}{p.value === null ? '' : p.value ? '↑' : '↓'}
        </span>
      ))}
    </div>
  )
}

export function PredictionFeed({ predictions, title = "최근 예측" }: PredictionFeedProps) {
  if (predictions.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <p className="text-sm text-th-dim">예측 데이터를 수집 중입니다.</p>
      </div>
    )
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50 flex items-center justify-between">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <span className="text-[10px] text-th-dim">{predictions.length}건</span>
      </div>
      <div className="divide-y divide-th-border/25 max-h-[480px] overflow-y-auto">
        {predictions.map((pred) => {
          const badge = PREDICTION_BADGES[pred.prediction_type ?? "buy"] ?? PREDICTION_BADGES.buy
          const catColor = CATEGORY_COLORS[pred.channel_category] ?? "#6b7280"
          const score = pred.direction_score

          return (
            <div key={pred.id} className="px-5 py-3.5 hover:bg-th-hover/40 transition">
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={{ background: `color-mix(in srgb, ${catColor} 15%, var(--th-bg-card))`, color: catColor }}
                >
                  {pred.channel_thumbnail ? (
                    <img src={pred.channel_thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover" />
                  ) : (
                    pred.channel_name[0]
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-th-muted font-medium">{pred.channel_name}</span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                      style={{
                        background: `color-mix(in srgb, ${badge.color} 12%, transparent)`,
                        color: badge.color,
                        border: `1px solid color-mix(in srgb, ${badge.color} 25%, transparent)`,
                      }}
                    >
                      {badge.label}
                    </span>
                    {score !== null && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${score >= 0.5 ? 'bg-[#22c997]/10 text-[#22c997]' : 'bg-[#ff5757]/10 text-[#ff5757]'}`}>
                        {score >= 0.5 ? "적중" : "빗나감"}
                      </span>
                    )}
                  </div>
                  <a
                    href={`/assets/${encodeURIComponent(pred.asset_code || pred.asset_name)}`}
                    className="text-sm font-semibold text-th-primary hover:text-th-accent transition mt-0.5 block truncate"
                  >
                    {pred.asset_name}
                  </a>
                  <div className="flex items-center gap-2 mt-1">
                    <DirectionIndicator d1w={pred.direction_1w} d1m={pred.direction_1m} d3m={pred.direction_3m} />
                    {pred.reason && (
                      <p className="text-[11px] text-th-dim line-clamp-1">{pred.reason}</p>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-th-dim shrink-0 tabular-nums">
                  {timeAgo(pred.predicted_at)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
