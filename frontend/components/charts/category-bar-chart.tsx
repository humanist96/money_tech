"use client"

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"

interface CategoryBarChartProps {
  data: { category: string; count: number }[]
  title?: string
}

export function CategoryBarChart({ data, title = "카테고리별 영상 수" }: CategoryBarChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    name: CATEGORY_LABELS[item.category] ?? item.category,
    fill: CATEGORY_COLORS[item.category] ?? "#6b7280",
  }))

  return (
    <div className="glass-card-elevated rounded-2xl p-6">
      <h3 className="font-bold text-th-primary text-[15px] mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--th-border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'var(--th-text-dim)', fontSize: 12 }} axisLine={{ stroke: 'var(--th-border)' }} tickLine={false} />
            <YAxis tick={{ fill: 'var(--th-text-dim)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--th-bg-card)', border: '1px solid var(--th-border)', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              labelStyle={{ color: '#e2e8f0' }}
              itemStyle={{ color: '#94a3b8' }}
              cursor={{ fill: 'rgba(0, 232, 184, 0.03)' }}
            />
            <Bar dataKey="count" name="영상 수" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} fillOpacity={0.75} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-center text-th-dim text-sm py-12">데이터를 수집 중입니다...</p>
      )}
    </div>
  )
}
