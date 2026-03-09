"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"
import type { DailyStat } from "@/lib/types"

interface TrendLineChartProps {
  stats: DailyStat[]
  title?: string
}

export function TrendLineChart({ stats, title = "업로드 빈도 추이" }: TrendLineChartProps) {
  const dateMap = new Map<string, Record<string, number>>()

  for (const stat of stats) {
    const dateKey = new Date(stat.date).toISOString().split("T")[0]
    const existing = dateMap.get(dateKey) ?? {}
    dateMap.set(dateKey, {
      ...existing,
      [stat.category]: stat.total_videos ?? 0,
    })
  }

  const chartData = Array.from(dateMap.entries())
    .map(([date, categories]) => ({
      date: date.slice(5),
      ...categories,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const categories = ["stock", "coin", "real_estate", "economy"]

  return (
    <div className="glass-card-elevated rounded-2xl p-6">
      <h3 className="font-bold text-th-primary text-[15px] mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--th-border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--th-text-dim)', fontSize: 11 }} axisLine={{ stroke: 'var(--th-border)' }} tickLine={false} />
            <YAxis tick={{ fill: 'var(--th-text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--th-bg-card)', border: '1px solid var(--th-border)', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value) => <span style={{ color: '#7a8ba8' }}>{value}</span>}
            />
            {categories.map((cat) => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                name={CATEGORY_LABELS[cat]}
                stroke={CATEGORY_COLORS[cat]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-center text-th-dim text-sm py-12">데이터를 수집 중입니다...</p>
      )}
    </div>
  )
}
