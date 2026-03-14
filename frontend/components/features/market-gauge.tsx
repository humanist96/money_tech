"use client"

import type { MarketSentimentGauge } from "@/lib/types"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"

interface MarketGaugeProps {
  data: MarketSentimentGauge
}

function FearGreedGauge({ score, size = 240 }: { score: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, score))
  const angle = -90 + (clamped / 100) * 180
  const label = clamped >= 80 ? "극도의 탐욕"
    : clamped >= 60 ? "탐욕"
    : clamped >= 45 ? "중립"
    : clamped >= 25 ? "공포"
    : "극도의 공포"
  const color = clamped >= 80 ? "#22c997"
    : clamped >= 60 ? "#7ce8c4"
    : clamped >= 45 ? "#ffb84d"
    : clamped >= 25 ? "#ff8c57"
    : "#ff5757"

  const cx = size / 2
  const cy = size * 0.55
  const r = size * 0.38

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size * 0.65}`} className="w-full" style={{ maxWidth: size }}>
        <defs>
          <linearGradient id="fear-greed-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff5757" />
            <stop offset="25%" stopColor="#ff8c57" />
            <stop offset="50%" stopColor="#ffb84d" />
            <stop offset="75%" stopColor="#7ce8c4" />
            <stop offset="100%" stopColor="#22c997" />
          </linearGradient>
        </defs>

        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--th-border)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="url(#fear-greed-gradient)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * Math.PI * r} ${Math.PI * r}`}
        />

        <line
          x1={cx}
          y1={cy}
          x2={cx + (r - 20) * Math.cos((angle * Math.PI) / 180)}
          y2={cy + (r - 20) * Math.sin((angle * Math.PI) / 180)}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="5" fill={color} />

        <text
          x={cx} y={cy - 25}
          textAnchor="middle"
          fill={color}
          fontSize="32"
          fontWeight="800"
          fontFamily="var(--font-outfit)"
        >
          {Math.round(clamped)}
        </text>

        <text x={cx - r + 5} y={cy + 20} textAnchor="start" fill="var(--th-text-dim)" fontSize="10">
          공포
        </text>
        <text x={cx + r - 5} y={cy + 20} textAnchor="end" fill="var(--th-text-dim)" fontSize="10">
          탐욕
        </text>
      </svg>

      <span className="text-lg font-bold mt-1" style={{ color }}>{label}</span>
      <span className="text-xs text-th-dim mt-0.5">재테크 콘텐츠 감성 지수</span>
    </div>
  )
}

function MiniGauge({ label, score, color }: { label: string; score: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, score))
  const sentiment = clamped >= 60 ? "탐욕" : clamped >= 40 ? "중립" : "공포"
  const sentColor = clamped >= 60 ? "#22c997" : clamped >= 40 ? "#ffb84d" : "#ff5757"

  return (
    <div className="flex flex-col items-center bg-th-tertiary/40 rounded-xl p-3">
      <div className="w-full h-2 rounded-full bg-th-bg mb-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clamped}%`, background: `linear-gradient(90deg, #ff5757, #ffb84d, #22c997)` }}
        />
      </div>
      <div className="flex items-center justify-between w-full">
        <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
        <div className="flex items-center gap-1">
          <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-outfit)', color: sentColor }}>
            {Math.round(clamped)}
          </span>
          <span className="text-[9px]" style={{ color: sentColor }}>{sentiment}</span>
        </div>
      </div>
    </div>
  )
}

export function MarketGaugePanel({ data }: MarketGaugeProps) {
  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff5757]/10 to-[#22c997]/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffb84d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
              시장 온도계
            </h3>
            <p className="text-[10px] text-th-dim">재테크 콘텐츠 생태계 종합 감성 지수</p>
          </div>
        </div>
        <span className="text-[10px] text-th-dim">최근 7일</span>
      </div>

      <div className="p-5">
        <FearGreedGauge score={data.overall_score} />

        {data.current_warning && (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-[#ffb84d]/8 border border-[#ffb84d]/15 text-center">
            <p className="text-xs text-[#ffb84d] font-medium">{data.current_warning}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4">
          {data.category_scores.map((cat) => (
            <MiniGauge
              key={cat.category}
              label={CATEGORY_LABELS[cat.category] ?? cat.category}
              score={cat.temperature}
              color={CATEGORY_COLORS[cat.category] ?? '#6b7280'}
            />
          ))}
        </div>

        {data.historical_extremes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-th-border/30">
            <h4 className="text-[11px] font-semibold text-th-dim mb-2">최근 극단값 기록</h4>
            <div className="space-y-1">
              {data.historical_extremes.map((ext, i) => {
                const isGreed = ext.score >= 80
                return (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <span className="text-th-dim">{new Date(ext.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                    <span className="font-bold tabular-nums" style={{ color: isGreed ? '#22c997' : '#ff5757' }}>
                      {ext.score} ({isGreed ? '탐욕' : '공포'})
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
