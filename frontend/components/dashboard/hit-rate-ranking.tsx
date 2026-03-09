"use client"

import Link from "next/link"
import type { HitRateLeaderboardItem } from "@/lib/types"

interface HitRateRankingProps {
  data: HitRateLeaderboardItem[]
  title?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  stock: '#ff5757', coin: '#ffb84d', real_estate: '#22c997', economy: '#7c6cf0',
}

const PREDICTION_ICONS: Record<string, { emoji: string; color: string }> = {
  buy: { emoji: "B", color: "#22c997" },
  sell: { emoji: "S", color: "#ff5757" },
  hold: { emoji: "H", color: "#ffb84d" },
}

export function HitRateRanking({ data, title = "적중률 리더보드" }: HitRateRankingProps) {
  if (data.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-white text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <p className="text-sm text-[#5a6a88]">예측 데이터를 수집 중입니다.</p>
      </div>
    )
  }

  const maxRate = Math.max(...data.map(d => d.hit_rate), 0.01)

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1a2744]/50">
        <h3 className="font-bold text-white text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
      </div>
      <div className="p-4 space-y-1.5">
        {data.map((ch, i) => {
          const rate = Math.round(ch.hit_rate * 100)
          const color = CATEGORY_COLORS[ch.category] ?? '#6b7280'
          const barWidth = maxRate > 0 ? (ch.hit_rate / maxRate) * 100 : 0
          const rateColor = rate >= 60 ? '#22c997' : rate >= 40 ? '#ffb84d' : '#ff5757'
          return (
            <Link key={ch.channel_id} href={`/channels/${ch.channel_id}`}>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#0e1a30]/50 transition group">
                <span className="text-[10px] font-bold text-[#3a4a6a] w-4 tabular-nums">{i + 1}</span>
                <div
                  className="rounded-lg p-[1.5px] shrink-0"
                  style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 30%, transparent))` }}
                >
                  {ch.channel_thumbnail ? (
                    <img src={ch.channel_thumbnail} alt="" className="w-7 h-7 rounded-[6px] object-cover bg-[#0a1120]" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-[6px] flex items-center justify-center text-xs font-bold"
                      style={{ background: `color-mix(in srgb, ${color} 15%, #0a1120)`, color }}
                    >
                      {ch.channel_name[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white font-medium truncate block group-hover:text-[#00e8b8] transition">
                    {ch.channel_name}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {ch.recent_predictions.slice(0, 5).map((pred, j) => {
                      const icon = PREDICTION_ICONS[pred.prediction_type] ?? PREDICTION_ICONS.hold
                      return (
                        <span
                          key={j}
                          className="text-[8px] font-bold w-4 h-4 rounded flex items-center justify-center"
                          style={{
                            background: `color-mix(in srgb, ${icon.color} 15%, transparent)`,
                            color: icon.color,
                            border: pred.is_accurate === true
                              ? `1px solid ${icon.color}`
                              : pred.is_accurate === false
                                ? '1px solid #ff575730'
                                : '1px solid #1a2744',
                          }}
                          title={`${pred.asset_name} - ${pred.prediction_type}${pred.is_accurate !== null ? (pred.is_accurate ? ' (적중)' : ' (빗나감)') : ''}`}
                        >
                          {icon.emoji}
                        </span>
                      )
                    })}
                    <span className="text-[9px] text-[#3a4a6a] ml-1">{ch.total_predictions}건</span>
                  </div>
                </div>
                <div className="w-16 stat-bar">
                  <div className="stat-bar-fill" style={{ width: `${barWidth}%`, background: rateColor }} />
                </div>
                <span className="text-xs font-bold tabular-nums w-10 text-right" style={{ color: rateColor, fontFamily: 'var(--font-outfit)' }}>
                  {rate}%
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
