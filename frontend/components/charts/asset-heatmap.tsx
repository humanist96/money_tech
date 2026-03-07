"use client"

import { useMemo, useState } from "react"

interface AssetMention {
  asset_name: string
  asset_code: string
  asset_type: 'stock' | 'coin' | 'real_estate'
  mention_count: number
  positive_count: number
  negative_count: number
  neutral_count: number
  channels: string[]
}

interface AssetHeatmapProps {
  assets: AssetMention[]
  title?: string
}

const TYPE_LABELS: Record<string, string> = {
  stock: '주식',
  coin: '코인',
  real_estate: '부동산',
}

export function AssetHeatmap({ assets, title = "종목 언급 히트맵" }: AssetHeatmapProps) {
  const [filter, setFilter] = useState<string>("all")

  const filtered = useMemo(() => {
    const list = filter === "all" ? assets : assets.filter(a => a.asset_type === filter)
    return list.slice(0, 30)
  }, [assets, filter])

  const maxMention = Math.max(...filtered.map(a => a.mention_count), 1)

  // Get sentiment color: green for positive, red for negative, blue for neutral
  function getSentimentColor(asset: AssetMention): string {
    const total = asset.positive_count + asset.negative_count + asset.neutral_count
    if (total === 0) return '#6366f1'
    const posRatio = asset.positive_count / total
    const negRatio = asset.negative_count / total
    if (posRatio > 0.5) return '#10b981'  // green - positive
    if (negRatio > 0.5) return '#ef4444'  // red - negative
    if (posRatio > negRatio) return '#34d399' // light green
    if (negRatio > posRatio) return '#f87171' // light red
    return '#6366f1' // indigo - neutral
  }

  if (assets.length === 0) {
    return (
      <div className="glass-card rounded-xl p-6">
        <h3 className="font-semibold text-white mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <p className="text-sm text-[#475569]">데이터를 수집 중입니다.</p>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e293b]/60 flex items-center justify-between">
        <h3 className="font-semibold text-white" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <div className="flex items-center gap-1">
          {[
            { value: "all", label: "전체" },
            { value: "stock", label: "주식" },
            { value: "coin", label: "코인" },
            { value: "real_estate", label: "부동산" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                filter === opt.value
                  ? "bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30"
                  : "text-[#475569] hover:text-[#94a3b8] border border-transparent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-[10px] text-[#64748b]">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#10b981]" /> 긍정</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#ef4444]" /> 부정</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#6366f1]" /> 중립</span>
          <span className="ml-auto">크기 = 언급 빈도</span>
        </div>

        {/* Heatmap grid - treemap style */}
        <div className="flex flex-wrap gap-1.5">
          {filtered.map((asset) => {
            const sizeRatio = asset.mention_count / maxMention
            const color = getSentimentColor(asset)
            const minSize = 60
            const maxSize = 140
            const size = minSize + (maxSize - minSize) * Math.sqrt(sizeRatio)

            return (
              <a
                key={`${asset.asset_type}-${asset.asset_code}`}
                href={`/assets/${encodeURIComponent(asset.asset_code)}`}
                className="group relative flex flex-col items-center justify-center rounded-lg transition-all duration-200 hover:scale-105 hover:z-10 cursor-pointer"
                style={{
                  width: `${size}px`,
                  height: `${size * 0.7}px`,
                  background: `color-mix(in srgb, ${color} 15%, #0c1324)`,
                  border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                  boxShadow: `0 0 ${8 * sizeRatio}px color-mix(in srgb, ${color} ${Math.round(15 * sizeRatio)}%, transparent)`,
                }}
              >
                <span className="text-xs font-bold truncate px-1" style={{ color, fontSize: `${Math.max(10, 12 * Math.sqrt(sizeRatio))}px` }}>
                  {asset.asset_name}
                </span>
                <span className="text-[9px] text-[#64748b] mt-0.5">
                  {asset.mention_count}회
                </span>

                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                  <div className="glass-card rounded-lg px-3 py-2 text-[10px] whitespace-nowrap shadow-xl border border-[#1e293b]">
                    <p className="font-bold text-white">{asset.asset_name} ({asset.asset_code})</p>
                    <p className="text-[#64748b] mt-0.5">{TYPE_LABELS[asset.asset_type]}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[#10b981]">긍정 {asset.positive_count}</span>
                      <span className="text-[#ef4444]">부정 {asset.negative_count}</span>
                      <span className="text-[#6366f1]">중립 {asset.neutral_count}</span>
                    </div>
                    <p className="text-[#94a3b8] mt-0.5">{asset.channels.length}개 채널에서 언급</p>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
