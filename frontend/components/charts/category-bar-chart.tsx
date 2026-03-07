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
    <div className="glass-card rounded-xl p-6">
      <h3 className="font-semibold text-white mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#1e293b' }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#0c1324', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }}
              labelStyle={{ color: '#e2e8f0' }}
              itemStyle={{ color: '#94a3b8' }}
            />
            <Bar dataKey="count" name="영상 수" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-center text-[#64748b] text-sm py-12">데이터를 수집 중입니다...</p>
      )}
    </div>
  )
}
