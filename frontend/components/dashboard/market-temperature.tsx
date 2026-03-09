"use client"

import type { MarketTemperature } from "@/lib/types"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"

interface MarketTemperatureProps {
  data: MarketTemperature[]
}

function GaugeChart({ temperature, color, label }: { temperature: number; color: string; label: string }) {
  const clampedTemp = Math.max(0, Math.min(100, temperature))
  const angle = -90 + (clampedTemp / 100) * 180
  const sentiment = clampedTemp >= 70 ? "탐욕" : clampedTemp >= 55 ? "낙관" : clampedTemp >= 45 ? "중립" : clampedTemp >= 30 ? "비관" : "공포"
  const sentimentColor = clampedTemp >= 70 ? "#22c997" : clampedTemp >= 55 ? "#7ce8c4" : clampedTemp >= 45 ? "#ffb84d" : clampedTemp >= 30 ? "#ff8c57" : "#ff5757"

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full max-w-[180px]">
        <defs>
          <linearGradient id={`gauge-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff5757" />
            <stop offset="25%" stopColor="#ff8c57" />
            <stop offset="50%" stopColor="#ffb84d" />
            <stop offset="75%" stopColor="#7ce8c4" />
            <stop offset="100%" stopColor="#22c997" />
          </linearGradient>
        </defs>
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#1a2744"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={`url(#gauge-${label})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(clampedTemp / 100) * 251.3} 251.3`}
        />
        <line
          x1="100"
          y1="100"
          x2={100 + 55 * Math.cos((angle * Math.PI) / 180)}
          y2={100 + 55 * Math.sin((angle * Math.PI) / 180)}
          stroke={sentimentColor}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="4" fill={sentimentColor} />
        <text x="100" y="85" textAnchor="middle" fill={sentimentColor} fontSize="18" fontWeight="700" fontFamily="var(--font-outfit)">
          {Math.round(clampedTemp)}
        </text>
        <text x="20" y="115" textAnchor="middle" fill="#5a6a88" fontSize="8">공포</text>
        <text x="180" y="115" textAnchor="middle" fill="#5a6a88" fontSize="8">탐욕</text>
      </svg>
      <div className="text-center mt-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>{label}</span>
        <p className="text-xs font-bold mt-0.5" style={{ color: sentimentColor }}>{sentiment}</p>
      </div>
    </div>
  )
}

export function MarketTemperatureWidget({ data }: MarketTemperatureProps) {
  if (data.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-white text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>시장 온도계</h3>
        <p className="text-sm text-[#5a6a88]">감성 데이터를 수집 중입니다.</p>
      </div>
    )
  }

  const overallTemp = data.reduce((sum, d) => sum + d.temperature * d.total_count, 0) /
    Math.max(data.reduce((sum, d) => sum + d.total_count, 0), 1)

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1a2744]/50 flex items-center justify-between">
        <h3 className="font-bold text-white text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
          시장 온도계
        </h3>
        <span className="text-[10px] text-[#5a6a88]">최근 7일 감성 기반</span>
      </div>
      <div className="p-5">
        <div className="flex justify-center mb-4">
          <GaugeChart temperature={overallTemp} color="#00e8b8" label="전체" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {data.map((d) => (
            <GaugeChart
              key={d.category}
              temperature={d.temperature}
              color={CATEGORY_COLORS[d.category] ?? "#6b7280"}
              label={CATEGORY_LABELS[d.category] ?? d.category}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
