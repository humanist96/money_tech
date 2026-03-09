"use client"

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import type { TopAssetSentiment } from "@/lib/types"

interface AssetSentimentGridProps {
  data: TopAssetSentiment[]
  title?: string
}

const SENTIMENT_COLORS = {
  positive: "#22c997",
  neutral: "#ffb84d",
  negative: "#ff5757",
}

function MiniDonut({ asset }: { asset: TopAssetSentiment }) {
  const chartData = [
    { name: "긍정", value: asset.positive_pct, color: SENTIMENT_COLORS.positive },
    { name: "중립", value: asset.neutral_pct, color: SENTIMENT_COLORS.neutral },
    { name: "부정", value: asset.negative_pct, color: SENTIMENT_COLORS.negative },
  ].filter((d) => d.value > 0)

  const dominant = asset.positive_pct >= asset.negative_pct ? "positive" : "negative"
  const dominantColor = SENTIMENT_COLORS[dominant]

  return (
    <div className="flex flex-col items-center p-3 rounded-xl hover:bg-th-hover/50 transition">
      <div className="relative w-[80px] h-[80px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={25}
              outerRadius={36}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} opacity={0.85} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-bold tabular-nums" style={{ fontFamily: 'var(--font-outfit)', color: dominantColor }}>
            {asset.total_mentions}
          </span>
        </div>
      </div>
      <a
        href={`/assets/${encodeURIComponent(asset.asset_code || asset.asset_name)}`}
        className="text-xs font-semibold text-th-primary hover:text-th-accent transition mt-1 text-center truncate max-w-full"
      >
        {asset.asset_name}
      </a>
      <span className="text-[9px] text-th-dim mt-0.5">{asset.asset_type === 'stock' ? '주식' : asset.asset_type === 'coin' ? '코인' : '부동산'}</span>
    </div>
  )
}

export function AssetSentimentGrid({ data, title = "인기 종목 감성 분포" }: AssetSentimentGridProps) {
  if (data.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <p className="text-sm text-th-dim">종목 감성 데이터를 수집 중입니다.</p>
      </div>
    )
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50 flex items-center justify-between">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <div className="flex items-center gap-3">
          {Object.entries(SENTIMENT_COLORS).map(([key, color]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[9px] text-th-dim">{key === 'positive' ? '긍정' : key === 'negative' ? '부정' : '중립'}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 grid grid-cols-5 gap-1">
        {data.map((asset) => (
          <MiniDonut key={asset.asset_code || asset.asset_name} asset={asset} />
        ))}
      </div>
    </div>
  )
}
