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

  function getSentimentColor(asset: AssetMention): string {
    const total = asset.positive_count + asset.negative_count + asset.neutral_count
    if (total === 0) return '#7c6cf0'
    const posRatio = asset.positive_count / total
    const negRatio = asset.negative_count / total
    if (posRatio > 0.5) return '#22c997'
    if (negRatio > 0.5) return '#ff5757'
    if (posRatio > negRatio) return '#34d399'
    if (negRatio > posRatio) return '#f87171'
    return '#7c6cf0'
  }

  if (assets.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-white text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <p className="text-sm text-[#5a6a88]">데이터를 수집 중입니다.</p>
      </div>
    )
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1a2744]/50 flex items-center justify-between">
        <h3 className="font-bold text-white text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
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
              className={`sort-pill ${filter === opt.value ? 'active' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-5 mb-4 text-[10px] text-[#5a6a88]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#22c997]" /> 긍정</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#ff5757]" /> 부정</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#7c6cf0]" /> 중립</span>
          <span className="ml-auto">크기 = 언급 빈도</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {filtered.map((asset) => {
            const sizeRatio = asset.mention_count / maxMention
            const color = getSentimentColor(asset)
            const minSize = 64
            const maxSize = 140
            const size = minSize + (maxSize - minSize) * Math.sqrt(sizeRatio)

            return (
              <a
                key={`${asset.asset_type}-${asset.asset_code}`}
                href={`/assets/${encodeURIComponent(asset.asset_code)}`}
                className="group relative flex flex-col items-center justify-center rounded-xl transition-all duration-200 hover:scale-105 hover:z-10 cursor-pointer"
                style={{
                  width: `${size}px`,
                  height: `${size * 0.7}px`,
                  background: `color-mix(in srgb, ${color} 10%, #0a1120)`,
                  border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
                  boxShadow: `0 0 ${10 * sizeRatio}px color-mix(in srgb, ${color} ${Math.round(12 * sizeRatio)}%, transparent)`,
                }}
              >
                <span className="text-xs font-bold truncate px-1.5" style={{ color, fontSize: `${Math.max(10, 12 * Math.sqrt(sizeRatio))}px` }}>
                  {asset.asset_name}
                </span>
                <span className="text-[9px] text-[#5a6a88] mt-0.5 tabular-nums">
                  {asset.mention_count}회
                </span>

                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover:block z-20 pointer-events-none">
                  <div className="glass-card-elevated rounded-xl px-3.5 py-2.5 text-[10px] whitespace-nowrap shadow-2xl">
                    <p className="font-bold text-white">{asset.asset_name} ({asset.asset_code})</p>
                    <p className="text-[#5a6a88] mt-0.5">{TYPE_LABELS[asset.asset_type]}</p>
                    <div className="flex gap-2.5 mt-1.5">
                      <span className="text-[#22c997]">긍정 {asset.positive_count}</span>
                      <span className="text-[#ff5757]">부정 {asset.negative_count}</span>
                      <span className="text-[#7c6cf0]">중립 {asset.neutral_count}</span>
                    </div>
                    <p className="text-[#7a8ba8] mt-1">{asset.channels.length}개 채널에서 언급</p>
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
