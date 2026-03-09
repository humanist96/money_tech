"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { useState } from "react"
import type { MentionSpikeData } from "@/lib/types"

interface MentionSpikeChartProps {
  data: { asset_name: string; asset_code: string; data: MentionSpikeData[] }[]
  title?: string
}

export function MentionSpikeChart({ data, title = "급등 언급 종목" }: MentionSpikeChartProps) {
  const [activeAsset, setActiveAsset] = useState<string>(data[0]?.asset_code ?? "")

  if (data.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <p className="text-sm text-th-dim">언급 스파이크 데이터가 없습니다.</p>
      </div>
    )
  }

  const activeEntry = data.find((d) => d.asset_code === activeAsset) ?? data[0]
  const chartData = activeEntry.data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }),
  }))
  const avgCount = chartData[0]?.avg_count ?? 0

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
      </div>
      <div className="px-4 pt-3 flex items-center gap-1.5 flex-wrap">
        {data.map((d) => {
          const isActive = d.asset_code === (activeEntry.asset_code)
          const hasSpike = d.data.some((p) => p.is_spike)
          return (
            <button
              key={d.asset_code}
              onClick={() => setActiveAsset(d.asset_code)}
              className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
              style={isActive ? {
                background: 'color-mix(in srgb, #00e8b8 12%, transparent)',
                color: '#00e8b8',
                border: '1px solid color-mix(in srgb, #00e8b8 30%, transparent)',
              } : {
                color: 'var(--th-text-dim)',
                border: '1px solid var(--th-border)',
              }}
            >
              {hasSpike && <span className="w-1.5 h-1.5 rounded-full bg-[#ff5757]" />}
              {d.asset_name}
            </button>
          )
        })}
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--th-border)" />
            <XAxis dataKey="date" tick={{ fill: 'var(--th-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--th-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: 'var(--th-bg-tertiary)',
                border: '1px solid var(--th-border)',
                borderRadius: '12px',
                fontSize: '11px',
                color: '#e2e8f0',
              }}
            />
            <ReferenceLine y={avgCount} stroke="#ffb84d" strokeDasharray="5 5" label={{ value: `평균 ${avgCount}`, fill: '#ffb84d', fontSize: 10 }} />
            <Bar
              dataKey="mention_count"
              name="언급 수"
              radius={[4, 4, 0, 0]}
              fill="#00e8b8"
              fillOpacity={0.7}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
