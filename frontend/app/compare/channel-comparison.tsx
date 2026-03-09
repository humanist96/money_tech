"use client"

import { useState, useMemo, useEffect } from "react"
import type { Channel } from "@/lib/types"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"
import { formatViewCount } from "@/lib/queries"
import { ComparisonSections } from "./comparison-sections"

interface Props {
  channels: Channel[]
}

type CategoryKey = "stock" | "coin" | "real_estate" | "economy"

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "stock", label: "주식" },
  { key: "coin", label: "코인" },
  { key: "real_estate", label: "부동산" },
  { key: "economy", label: "경제" },
]

export function ChannelComparison({ channels }: Props) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("stock")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [comparisonData, setComparisonData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const categoryChannels = useMemo(
    () => channels.filter((ch) => ch.category === activeCategory),
    [channels, activeCategory]
  )

  // Reset selection when category changes
  useEffect(() => {
    setSelectedIds([])
    setComparisonData(null)
  }, [activeCategory])

  // Fetch comparison data when 2+ channels selected
  useEffect(() => {
    if (selectedIds.length < 2) {
      setComparisonData(null)
      return
    }
    setLoading(true)
    fetch(`/api/compare?ids=${selectedIds.join(",")}`)
      .then((res) => res.json())
      .then((data) => setComparisonData(data))
      .catch(() => setComparisonData(null))
      .finally(() => setLoading(false))
  }, [selectedIds])

  const toggleChannel = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id))
    } else if (selectedIds.length < 3) {
      setSelectedIds([...selectedIds, id])
    }
  }

  const selected = channels.filter((ch) => selectedIds.includes(ch.id))

  return (
    <div className="space-y-6">
      {/* #1 Category Tabs */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORIES.map((cat) => {
            const isActive = cat.key === activeCategory
            const color = CATEGORY_COLORS[cat.key]
            const count = channels.filter((ch) => ch.category === cat.key).length
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: isActive
                    ? `color-mix(in srgb, ${color} 20%, transparent)`
                    : "transparent",
                  border: `1px solid ${isActive ? `color-mix(in srgb, ${color} 50%, transparent)` : "#1e293b"}`,
                  color: isActive ? color : "#64748b",
                }}
              >
                {cat.label}
                <span className="ml-1.5 text-[10px] opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Channel checkbox list */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {categoryChannels.map((ch) => {
            const isSelected = selectedIds.includes(ch.id)
            const color = CATEGORY_COLORS[ch.category]
            const disabled = !isSelected && selectedIds.length >= 3
            return (
              <button
                key={ch.id}
                onClick={() => !disabled && toggleChannel(ch.id)}
                disabled={disabled}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left"
                style={{
                  background: isSelected
                    ? `color-mix(in srgb, ${color} 12%, #0c1324)`
                    : "transparent",
                  border: `1px solid ${isSelected ? `color-mix(in srgb, ${color} 40%, transparent)` : "#1a2744"}`,
                  opacity: disabled ? 0.4 : 1,
                }}
              >
                {/* Checkbox */}
                <div
                  className="w-4 h-4 rounded shrink-0 flex items-center justify-center transition-all"
                  style={{
                    background: isSelected ? color : "transparent",
                    border: `1.5px solid ${isSelected ? color : "#3a4a6a"}`,
                  }}
                >
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </div>

                {/* Channel info */}
                {ch.thumbnail_url ? (
                  <img src={ch.thumbnail_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: `color-mix(in srgb, ${color} 18%, #0c1324)`, color }}
                  >
                    {ch.name[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-xs font-medium text-white truncate block">{ch.name}</span>
                  <span className="text-[10px] text-[#5a6a88]">
                    {ch.subscriber_count ? formatViewCount(ch.subscriber_count) : "-"}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {selectedIds.length < 2 && (
          <p className="text-[11px] text-[#5a6a88] text-center pt-2">
            같은 카테고리 채널을 2~3개 선택하여 비교하세요
          </p>
        )}

        {/* Cross-category warning */}
        {selected.length >= 2 && new Set(selected.map((s) => s.category)).size > 1 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#ffb84d]/10 border border-[#ffb84d]/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffb84d" strokeWidth="2">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" /><path d="M12 17h.01" />
            </svg>
            <span className="text-[11px] text-[#ffb84d]">서로 다른 카테고리 채널을 비교하고 있습니다</span>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="glass-card rounded-xl py-12 text-center">
          <div className="w-8 h-8 border-2 border-[#00e8b8]/30 border-t-[#00e8b8] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#5a6a88]">비교 데이터를 불러오는 중...</p>
        </div>
      )}

      {/* Comparison results */}
      {!loading && comparisonData && selected.length >= 2 && (
        <ComparisonSections
          data={comparisonData}
          selected={selected}
          category={activeCategory}
        />
      )}

      {/* Empty state */}
      {!loading && !comparisonData && selectedIds.length < 2 && (
        <div className="glass-card rounded-xl py-16 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" className="mx-auto mb-3">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <p className="text-[#64748b] text-sm">비교할 채널을 2개 이상 선택해주세요</p>
        </div>
      )}
    </div>
  )
}
