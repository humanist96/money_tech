"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { useState } from "react"
import type { SentimentTrendPoint } from "@/lib/types"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"

interface SentimentTrendChartProps {
  data: SentimentTrendPoint[]
  title?: string
}

export function SentimentTrendChart({ data, title = "카테고리별 감성 트렌드" }: SentimentTrendChartProps) {
  const categories = [...new Set(data.map((d) => d.category))]
  const [activeCategory, setActiveCategory] = useState<string>(categories[0] ?? "stock")

  if (data.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <p className="text-sm text-th-dim">감성 트렌드 데이터를 수집 중입니다.</p>
      </div>
    )
  }

  const filtered = data
    .filter((d) => d.category === activeCategory)
    .map((d) => ({
      ...d,
      date: new Date(d.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }),
    }))

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50 flex items-center justify-between">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
      </div>
      <div className="px-4 pt-3 flex items-center gap-1.5">
        {categories.map((cat) => {
          const color = CATEGORY_COLORS[cat] ?? "#6b7280"
          const isActive = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-all"
              style={isActive ? {
                background: `color-mix(in srgb, ${color} 12%, transparent)`,
                color,
                border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
              } : {
                color: 'var(--th-text-dim)',
                border: '1px solid transparent',
              }}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          )
        })}
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={filtered}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--th-border)" />
            <XAxis dataKey="date" tick={{ fill: 'var(--th-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--th-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
            <Tooltip
              contentStyle={{
                background: 'var(--th-bg-tertiary)',
                border: '1px solid var(--th-border)',
                borderRadius: '12px',
                fontSize: '11px',
                color: '#e2e8f0',
              }}
              formatter={(value) => [`${Math.round(Number(value))}%`]}
            />
            <Legend wrapperStyle={{ fontSize: '10px', color: '#7a8ba8' }} />
            <Line type="monotone" dataKey="positive_pct" name="긍정" stroke="#22c997" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="neutral_pct" name="중립" stroke="#ffb84d" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="negative_pct" name="부정" stroke="#ff5757" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
