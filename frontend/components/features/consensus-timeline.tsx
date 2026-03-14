"use client"

import { useState } from "react"
import type { ConsensusTimelineEntry } from "@/lib/types"

interface PricePoint {
  date: string
  price: number
}

interface ConsensusTimelineProps {
  data: ConsensusTimelineEntry[]
  assetName: string
  priceHistory?: PricePoint[]
}

const SENTIMENT_CONFIG = {
  positive: { color: '#22c997', label: '긍정', bg: 'bg-[#22c997]/12' },
  negative: { color: '#ff5757', label: '부정', bg: 'bg-[#ff5757]/12' },
  neutral: { color: '#ffb84d', label: '중립', bg: 'bg-[#ffb84d]/12' },
}

const PREDICTION_CONFIG: Record<string, { color: string; label: string }> = {
  buy: { color: '#22c997', label: '매수' },
  sell: { color: '#ff5757', label: '매도' },
  hold: { color: '#ffb84d', label: '관망' },
}

function PriceOverlayChart({ priceHistory, minDate, maxDate }: { priceHistory: PricePoint[]; minDate: number; maxDate: number }) {
  if (priceHistory.length < 2) return null

  const prices = priceHistory.map(p => p.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const priceRange = maxPrice - minPrice || 1
  const dateRange = maxDate - minDate || 1

  const width = 500
  const height = 60
  const padding = { left: 50, right: 10 }
  const chartW = width - padding.left - padding.right

  const points = priceHistory.map(p => {
    const x = padding.left + ((new Date(p.date).getTime() - minDate) / dateRange) * chartW
    const y = 5 + (1 - (p.price - minPrice) / priceRange) * (height - 10)
    return { x, y, price: p.price }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const isPositive = points[points.length - 1].price >= points[0].price
  const lineColor = isPositive ? '#22c997' : '#ff5757'

  return (
    <div className="px-4 pb-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] text-th-dim">가격 추이</span>
        <span className="text-[9px] font-medium tabular-nums" style={{ fontFamily: 'var(--font-outfit)', color: lineColor }}>
          {minPrice.toLocaleString()} ~ {maxPrice.toLocaleString()}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 60 }}>
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.5" fill={lineColor} />
        <text x={padding.left - 5} y={10} textAnchor="end" fill="var(--th-text-dim)" fontSize="7" fontFamily="var(--font-outfit)">
          {maxPrice.toLocaleString()}
        </text>
        <text x={padding.left - 5} y={height - 3} textAnchor="end" fill="var(--th-text-dim)" fontSize="7" fontFamily="var(--font-outfit)">
          {minPrice.toLocaleString()}
        </text>
      </svg>
    </div>
  )
}

export function ConsensusTimelinePanel({ data, assetName, priceHistory }: ConsensusTimelineProps) {
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null)

  if (data.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>
          {assetName} 컨센서스 타임라인
        </h3>
        <p className="text-sm text-th-dim">타임라인 데이터가 없습니다.</p>
      </div>
    )
  }

  // Group by channel
  const channelMap = new Map<string, ConsensusTimelineEntry[]>()
  for (const entry of data) {
    const list = channelMap.get(entry.channel_name) || []
    list.push(entry)
    channelMap.set(entry.channel_name, list)
  }

  const channels = Array.from(channelMap.entries())
    .sort((a, b) => b[1].length - a[1].length)

  // Date range
  const dates = data.map(d => new Date(d.published_at).getTime()).filter(d => !isNaN(d))
  const minDate = Math.min(...dates)
  const maxDate = Math.max(...dates)
  const range = maxDate - minDate || 1

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#7c6cf0]/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c6cf0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
              {assetName} 컨센서스 타임라인
            </h3>
            <p className="text-[10px] text-th-dim">크리에이터별 의견 변화 추적</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[9px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#22c997]" /> 매수/긍정
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#ffb84d]" /> 관망/중립
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#ff5757]" /> 매도/부정
          </span>
        </div>
      </div>

      {/* Price Chart Overlay */}
      {priceHistory && priceHistory.length >= 2 && (
        <PriceOverlayChart priceHistory={priceHistory} minDate={minDate} maxDate={maxDate} />
      )}

      <div className="p-4 space-y-1">
        {channels.map(([channelName, entries]) => {
          const isExpanded = expandedChannel === channelName
          const latestEntry = entries[entries.length - 1]
          const latestSentiment = SENTIMENT_CONFIG[latestEntry.sentiment as keyof typeof SENTIMENT_CONFIG] ?? SENTIMENT_CONFIG.neutral

          return (
            <div key={channelName} className="rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedChannel(isExpanded ? null : channelName)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-th-hover/40 transition"
              >
                {/* Channel Avatar */}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold bg-th-tertiary text-th-muted shrink-0">
                  {latestEntry.channel_thumbnail ? (
                    <img src={latestEntry.channel_thumbnail} alt="" className="w-7 h-7 rounded-lg object-cover" />
                  ) : (
                    channelName[0]
                  )}
                </div>

                {/* Channel name */}
                <span className="text-xs font-medium text-th-primary w-24 truncate text-left shrink-0">
                  {channelName}
                </span>

                {/* Timeline dots */}
                <div className="flex-1 relative h-6">
                  {entries.map((entry, i) => {
                    const date = new Date(entry.published_at).getTime()
                    const position = ((date - minDate) / range) * 100
                    const color = entry.prediction_type
                      ? (PREDICTION_CONFIG[entry.prediction_type]?.color ?? latestSentiment.color)
                      : (SENTIMENT_CONFIG[entry.sentiment as keyof typeof SENTIMENT_CONFIG]?.color ?? '#7c6cf0')

                    return (
                      <div
                        key={i}
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-th-card transition-transform hover:scale-150"
                        style={{
                          left: `${Math.min(Math.max(position, 2), 98)}%`,
                          background: color,
                        }}
                        title={`${new Date(entry.published_at).toLocaleDateString('ko-KR')} - ${entry.prediction_type ? PREDICTION_CONFIG[entry.prediction_type]?.label : SENTIMENT_CONFIG[entry.sentiment as keyof typeof SENTIMENT_CONFIG]?.label}`}
                      />
                    )
                  })}
                  <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-th-border/30 -translate-y-1/2" />
                </div>

                {/* Latest status */}
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-md shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${latestSentiment.color} 12%, transparent)`,
                    color: latestSentiment.color,
                  }}
                >
                  {latestEntry.prediction_type
                    ? PREDICTION_CONFIG[latestEntry.prediction_type]?.label ?? latestSentiment.label
                    : latestSentiment.label}
                </span>

                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`text-th-dim transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pl-12 space-y-1.5">
                  {entries.map((entry, i) => {
                    const config = entry.prediction_type
                      ? PREDICTION_CONFIG[entry.prediction_type]
                      : SENTIMENT_CONFIG[entry.sentiment as keyof typeof SENTIMENT_CONFIG]
                    const finalConfig = config ?? { color: '#7c6cf0', label: '미분류' }

                    return (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className="text-th-dim tabular-nums w-16 shrink-0">
                          {new Date(entry.published_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: finalConfig.color }}
                        />
                        <span className="font-medium" style={{ color: finalConfig.color }}>
                          {finalConfig.label}
                        </span>
                        <span className="text-th-dim truncate">
                          {entry.video_title}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
