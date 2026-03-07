"use client"

import type { KeywordEntry } from "@/lib/types"

interface KeywordCloudProps {
  keywords: KeywordEntry[]
  title?: string
}

const KEYWORD_COLORS = [
  "#00d4aa", "#6366f1", "#f59e0b", "#ef4444", "#ec4899",
  "#14b8a6", "#8b5cf6", "#f97316", "#06b6d4", "#84cc16",
]

export function KeywordCloud({ keywords, title = "인기 키워드" }: KeywordCloudProps) {
  if (keywords.length === 0) {
    return (
      <div className="glass-card rounded-xl p-6">
        <h3 className="font-semibold text-white mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <p className="text-center text-[#64748b] text-sm py-8">데이터를 수집 중입니다...</p>
      </div>
    )
  }

  const maxCount = Math.max(...keywords.map((k) => k.count))
  const minCount = Math.min(...keywords.map((k) => k.count))

  return (
    <div className="glass-card rounded-xl p-6">
      <h3 className="font-semibold text-white mb-5" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
      <div className="flex flex-wrap gap-2 stagger-in">
        {keywords.map((kw, i) => {
          const ratio = maxCount === minCount ? 0.5 : (kw.count - minCount) / (maxCount - minCount)
          const fontSize = 11 + ratio * 14
          const color = KEYWORD_COLORS[i % KEYWORD_COLORS.length]
          return (
            <span
              key={kw.keyword}
              className="inline-block px-2.5 py-1 rounded-lg cursor-default transition-all duration-200 hover:scale-105"
              style={{
                fontSize: `${fontSize}px`,
                background: `color-mix(in srgb, ${color} ${8 + ratio * 12}%, transparent)`,
                color: color,
                border: `1px solid color-mix(in srgb, ${color} ${15 + ratio * 20}%, transparent)`,
                fontWeight: ratio > 0.5 ? 600 : 400,
              }}
              title={`${kw.keyword}: ${kw.count}회`}
            >
              {kw.keyword}
            </span>
          )
        })}
      </div>
    </div>
  )
}
