"use client"

import { useState } from "react"
import type { DailyStat } from "@/lib/types"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"

interface TrendDetailsProps {
  stats: DailyStat[]
}

export function TrendDetails({ stats }: TrendDetailsProps) {
  const categories = ["stock", "coin", "real_estate", "economy"] as const
  const [active, setActive] = useState<string>("stock")

  const categoryDetails = categories.map((cat) => {
    const catStats = stats.filter((s) => s.category === cat)
    const latest = catStats[catStats.length - 1]
    return {
      category: cat,
      label: CATEGORY_LABELS[cat],
      color: CATEGORY_COLORS[cat],
      topChannels: latest?.top_channels ?? [],
      topKeywords: latest?.top_keywords ?? [],
      totalVideos: catStats.reduce((sum, s) => sum + (s.total_videos ?? 0), 0),
    }
  })

  const current = categoryDetails.find((c) => c.category === active)!

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e293b]/60">
        <h3 className="font-semibold text-white" style={{ fontFamily: 'var(--font-outfit)' }}>카테고리별 상세</h3>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1e293b]/40">
        {categoryDetails.map((cd) => (
          <button
            key={cd.category}
            onClick={() => setActive(cd.category)}
            className="flex-1 px-4 py-3 text-xs font-medium transition-all relative"
            style={{
              color: active === cd.category ? cd.color : '#64748b',
              background: active === cd.category ? `color-mix(in srgb, ${cd.color} 5%, transparent)` : 'transparent',
            }}
          >
            {cd.label}
            {active === cd.category && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: cd.color }} />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-3">활발한 채널</h4>
            {current.topChannels.length > 0 ? (
              <div className="space-y-2">
                {current.topChannels.slice(0, 5).map((ch, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#111d35]/50 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-bold text-[#475569] w-4">{i + 1}</span>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: `color-mix(in srgb, ${current.color} 15%, transparent)`, color: current.color }}
                      >
                        {ch.channel_name[0]}
                      </div>
                      <span className="text-sm text-white font-medium">{ch.channel_name}</span>
                    </div>
                    <span className="text-xs text-[#64748b]">{ch.video_count}개 영상</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#475569]">데이터를 수집 중입니다.</p>
            )}
          </div>

          <div>
            <h4 className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-3">주요 키워드</h4>
            {current.topKeywords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {current.topKeywords.slice(0, 15).map((kw, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs"
                    style={{
                      background: `color-mix(in srgb, ${current.color} 10%, transparent)`,
                      color: current.color,
                      border: `1px solid color-mix(in srgb, ${current.color} 20%, transparent)`,
                    }}
                  >
                    {kw.keyword}
                    <span className="ml-1 opacity-50">({kw.count})</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#475569]">데이터를 수집 중입니다.</p>
            )}
          </div>
        </div>

        <p className="text-[10px] text-[#475569] mt-6 pt-4 border-t border-[#1e293b]/30">
          최근 30일 총 <span style={{ color: current.color }}>{current.totalVideos}</span>개 영상 수집됨
        </p>
      </div>
    </div>
  )
}
