"use client"

import Link from "next/link"
import type { PredictionProfile } from "@/lib/types"

interface ChannelPredictionProfileProps {
  data: PredictionProfile[]
  title?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  stock: "#ff5757",
  coin: "#ffb84d",
  real_estate: "#22c997",
  economy: "#7c6cf0",
}

export function ChannelPredictionProfile({ data, title = "채널별 예측 성향" }: ChannelPredictionProfileProps) {
  if (data.length === 0) {
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
        <div className="flex items-center gap-3 text-[9px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#22c997]" />매수</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#ff5757]" />매도</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#ffb84d]" />관망</span>
        </div>
      </div>
      <div className="p-4 space-y-1">
        {data.map((ch) => {
          const catColor = CATEGORY_COLORS[ch.category] ?? "#6b7280"
          const buyPct = ch.total > 0 ? (ch.buy_count / ch.total) * 100 : 0
          const sellPct = ch.total > 0 ? (ch.sell_count / ch.total) * 100 : 0
          const holdPct = ch.total > 0 ? (ch.hold_count / ch.total) * 100 : 0
          const dominantLabel = buyPct >= sellPct && buyPct >= holdPct ? "공격적"
            : sellPct >= buyPct && sellPct >= holdPct ? "방어적"
            : "균형적"
          const dominantColor = buyPct >= sellPct && buyPct >= holdPct ? "#22c997"
            : sellPct >= buyPct && sellPct >= holdPct ? "#ff5757"
            : "#ffb84d"

          return (
            <Link
              key={ch.channel_id}
              href={`/channels/${ch.channel_id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-th-hover/50 transition group"
            >
              {/* Avatar */}
              <div
                className="rounded-lg p-[1px] shrink-0"
                style={{ background: `linear-gradient(135deg, ${catColor}, color-mix(in srgb, ${catColor} 30%, transparent))` }}
              >
                {ch.channel_thumbnail ? (
                  <img src={ch.channel_thumbnail} alt="" className="w-7 h-7 rounded-[6px] object-cover bg-th-card" />
                ) : (
                  <div
                    className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[10px] font-bold"
                    style={{ background: `color-mix(in srgb, ${catColor} 15%, var(--th-bg-card))`, color: catColor }}
                  >
                    {ch.channel_name[0]}
                  </div>
                )}
              </div>

              {/* Name + Label */}
              <div className="w-24 shrink-0 min-w-0">
                <span className="text-[12px] font-medium text-th-primary group-hover:text-th-accent transition truncate block leading-tight">
                  {ch.channel_name}
                </span>
                <span className="text-[9px] font-semibold" style={{ color: dominantColor }}>
                  {dominantLabel}
                </span>
              </div>

              {/* Stacked bar */}
              <div className="flex-1">
                <div className="h-5 rounded-md overflow-hidden flex bg-th-card">
                  {buyPct > 0 && (
                    <div
                      className="h-full flex items-center justify-center text-[8px] font-bold text-th-primary/80 transition-all"
                      style={{ width: `${buyPct}%`, background: "#22c997" }}
                    >
                      {buyPct >= 15 && `${Math.round(buyPct)}%`}
                    </div>
                  )}
                  {sellPct > 0 && (
                    <div
                      className="h-full flex items-center justify-center text-[8px] font-bold text-th-primary/80 transition-all"
                      style={{ width: `${sellPct}%`, background: "#ff5757" }}
                    >
                      {sellPct >= 15 && `${Math.round(sellPct)}%`}
                    </div>
                  )}
                  {holdPct > 0 && (
                    <div
                      className="h-full flex items-center justify-center text-[8px] font-bold text-th-primary/80 transition-all"
                      style={{ width: `${holdPct}%`, background: "#ffb84d" }}
                    >
                      {holdPct >= 15 && `${Math.round(holdPct)}%`}
                    </div>
                  )}
                </div>
              </div>

              {/* Total count */}
              <span className="text-[10px] text-th-dim tabular-nums w-8 text-right shrink-0">
                {ch.total}건
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
