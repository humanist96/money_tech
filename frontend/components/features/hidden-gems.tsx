"use client"

import Link from "next/link"
import type { HiddenGemChannel } from "@/lib/types"
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/types"
import { formatViewCount } from "@/lib/queries"

interface HiddenGemsProps {
  channels: HiddenGemChannel[]
}

function RadarChart({ data, size = 120 }: { data: HiddenGemChannel['radar']; size?: number }) {
  const center = size / 2
  const radius = size / 2 - 15
  const axes = [
    { key: 'aggressiveness' as const, label: '공격성' },
    { key: 'conservatism' as const, label: '보수성' },
    { key: 'diversity' as const, label: '다양성' },
    { key: 'accuracy' as const, label: '정확도' },
    { key: 'depth' as const, label: '깊이' },
  ]
  const angleStep = (2 * Math.PI) / axes.length
  const startAngle = -Math.PI / 2

  const points = axes.map((axis, i) => {
    const angle = startAngle + i * angleStep
    const value = (data[axis.key] || 0) / 100
    return {
      x: center + radius * value * Math.cos(angle),
      y: center + radius * value * Math.sin(angle),
      labelX: center + (radius + 12) * Math.cos(angle),
      labelY: center + (radius + 12) * Math.sin(angle),
      label: axis.label,
    }
  })

  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full" style={{ maxWidth: size }}>
      {[0.25, 0.5, 0.75, 1].map(scale => (
        <polygon
          key={scale}
          points={axes.map((_, i) => {
            const angle = startAngle + i * angleStep
            return `${center + radius * scale * Math.cos(angle)},${center + radius * scale * Math.sin(angle)}`
          }).join(' ')}
          fill="none"
          stroke="var(--th-border)"
          strokeWidth="0.5"
          opacity={0.4}
        />
      ))}
      {axes.map((_, i) => {
        const angle = startAngle + i * angleStep
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + radius * Math.cos(angle)}
            y2={center + radius * Math.sin(angle)}
            stroke="var(--th-border)"
            strokeWidth="0.5"
            opacity={0.3}
          />
        )
      })}
      <polygon
        points={polygonPoints}
        fill="rgba(0, 232, 184, 0.15)"
        stroke="#00e8b8"
        strokeWidth="1.5"
      />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="2.5" fill="#00e8b8" />
          <text
            x={p.labelX}
            y={p.labelY}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--th-text-dim)"
            fontSize="7"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function HiddenGemsPanel({ channels }: HiddenGemsProps) {
  const gems = channels.filter(c =>
    (c.subscriber_count === null || c.subscriber_count < 100000) && c.hit_rate >= 0.6
  )
  const rising = channels.filter(c =>
    c.total_predictions >= 3 && c.hit_rate >= 0.6
  ).slice(0, 5)

  const display = gems.length > 0 ? gems : rising

  if (display.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>
          숨은 보석 채널
        </h3>
        <p className="text-sm text-th-dim">아직 숨은 보석 채널이 발견되지 않았습니다.</p>
      </div>
    )
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00e8b8]/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00e8b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
              숨은 보석 채널
            </h3>
            <p className="text-[10px] text-th-dim">구독자는 적지만 적중률 높은 채널</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {display.map((ch) => {
          const catColor = CATEGORY_COLORS[ch.category] ?? '#6b7280'
          const rateColor = ch.hit_rate >= 0.6 ? '#22c997' : ch.hit_rate >= 0.4 ? '#ffb84d' : '#ff5757'

          return (
            <Link
              key={ch.channel_id}
              href={`/channels/${ch.channel_id}`}
              className="bg-th-tertiary/60 rounded-xl p-4 hover:bg-th-tertiary transition border border-th-border/30 hover:border-[#00e8b8]/30 group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="rounded-lg p-[1.5px] shrink-0"
                  style={{ background: `linear-gradient(135deg, ${catColor}, color-mix(in srgb, ${catColor} 30%, transparent))` }}
                >
                  {ch.channel_thumbnail ? (
                    <img src={ch.channel_thumbnail} alt="" className="w-9 h-9 rounded-[6px] object-cover bg-th-card" />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-[6px] flex items-center justify-center text-sm font-bold"
                      style={{ background: `color-mix(in srgb, ${catColor} 15%, var(--th-bg-card))`, color: catColor }}
                    >
                      {ch.channel_name[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-th-primary truncate block group-hover:text-[#00e8b8] transition">
                    {ch.channel_name}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-th-dim">
                      {ch.subscriber_count ? formatViewCount(ch.subscriber_count) + '명' : '비공개'}
                    </span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: `color-mix(in srgb, ${catColor} 12%, transparent)`, color: catColor }}
                    >
                      {CATEGORY_LABELS[ch.category] ?? ch.category}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-outfit)', color: rateColor }}>
                    {Math.round(ch.hit_rate * 100)}%
                  </span>
                  <span className="text-[10px] text-th-dim ml-1">적중률</span>
                </div>
                <span className="text-[10px] text-th-dim">{ch.total_predictions}건 예측</span>
              </div>

              <RadarChart data={ch.radar} size={120} />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
