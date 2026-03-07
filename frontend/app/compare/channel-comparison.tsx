"use client"

import { useState, useMemo } from "react"
import type { Channel } from "@/lib/types"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"
import { formatViewCount } from "@/lib/queries"

interface Props {
  channels: Channel[]
}

export function ChannelComparison({ channels }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState("")

  const selected = useMemo(
    () => channels.filter((ch) => selectedIds.includes(ch.id)),
    [channels, selectedIds]
  )

  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return channels
      .filter((ch) => ch.name.toLowerCase().includes(q) && !selectedIds.includes(ch.id))
      .slice(0, 5)
  }, [channels, search, selectedIds])

  const addChannel = (id: string) => {
    if (selectedIds.length < 3 && !selectedIds.includes(id)) {
      setSelectedIds([...selectedIds, id])
      setSearch("")
    }
  }

  const removeChannel = (id: string) => {
    setSelectedIds(selectedIds.filter((i) => i !== id))
  }

  // Calculate max values for relative bars
  const maxSubs = Math.max(...selected.map((c) => c.subscriber_count ?? 0), 1)
  const maxViews = Math.max(...selected.map((c) => c.total_view_count ?? 0), 1)
  const maxVideos = Math.max(...selected.map((c) => c.video_count ?? 0), 1)

  return (
    <div className="space-y-6">
      {/* Channel selector */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <span className="text-xs text-[#64748b]">비교할 채널 선택 (최대 3개):</span>
          {selected.map((ch) => {
            const color = CATEGORY_COLORS[ch.category] ?? "#6b7280"
            return (
              <div
                key={ch.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: `color-mix(in srgb, ${color} 15%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
                  color,
                }}
              >
                {ch.name}
                <button onClick={() => removeChannel(ch.id)} className="hover:opacity-70">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>

        {selectedIds.length < 3 && (
          <div className="relative">
            <div className="search-glow glass-card rounded-lg px-4 py-2.5 flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="채널명으로 검색..."
                className="flex-1 bg-transparent text-sm text-[#e2e8f0] placeholder:text-[#475569] outline-none"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 glass-card rounded-lg border border-[#1e293b] shadow-xl z-10 overflow-hidden">
                {searchResults.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => addChannel(ch.id)}
                    className="w-full px-4 py-2.5 text-left text-sm text-[#e2e8f0] hover:bg-[#1e293b]/50 flex items-center gap-3 transition"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: `color-mix(in srgb, ${CATEGORY_COLORS[ch.category]} 18%, #0c1324)`,
                        color: CATEGORY_COLORS[ch.category],
                      }}
                    >
                      {ch.name[0]}
                    </div>
                    <span>{ch.name}</span>
                    <span className="ml-auto text-[10px] text-[#64748b]">{CATEGORY_LABELS[ch.category]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comparison area */}
      {selected.length >= 2 ? (
        <div className="space-y-6">
          {/* Side by side cards */}
          <div className={`grid gap-4 ${selected.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {selected.map((ch) => {
              const color = CATEGORY_COLORS[ch.category] ?? "#6b7280"
              return (
                <div key={ch.id} className="glass-card rounded-xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: color }} />
                  <div className="flex items-center gap-3 mb-4">
                    {ch.thumbnail_url ? (
                      <img src={ch.thumbnail_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                        style={{ background: `color-mix(in srgb, ${color} 18%, #0c1324)`, color }}
                      >
                        {ch.name[0]}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-white text-sm">{ch.name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                        background: `color-mix(in srgb, ${color} 15%, transparent)`, color
                      }}>
                        {CATEGORY_LABELS[ch.category]}
                      </span>
                    </div>
                  </div>
                  {ch.description && (
                    <p className="text-[11px] text-[#475569] line-clamp-2 mb-4">{ch.description}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Metric bars */}
          {[
            { label: "구독자 수", key: "subscriber_count" as const, max: maxSubs, color: "#00d4aa" },
            { label: "총 조회수", key: "total_view_count" as const, max: maxViews, color: "#6366f1" },
            { label: "영상 수", key: "video_count" as const, max: maxVideos, color: "#f59e0b" },
          ].map((metric) => (
            <div key={metric.label} className="glass-card rounded-xl p-5">
              <h4 className="text-xs text-[#64748b] uppercase tracking-wider mb-4">{metric.label}</h4>
              <div className="space-y-3">
                {selected.map((ch) => {
                  const val = (ch[metric.key] ?? 0) as number
                  const ratio = val / metric.max
                  return (
                    <div key={ch.id} className="flex items-center gap-3">
                      <span className="text-xs text-[#94a3b8] w-24 truncate">{ch.name}</span>
                      <div className="flex-1 h-6 bg-[#0f1a2e] rounded-full overflow-hidden relative">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${ratio * 100}%`,
                            background: `linear-gradient(90deg, color-mix(in srgb, ${metric.color} 60%, transparent), ${metric.color})`,
                          }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
                          {formatViewCount(val)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-xl py-16 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" className="mx-auto mb-3">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <p className="text-[#64748b] text-sm">비교할 채널을 2개 이상 선택해주세요.</p>
        </div>
      )}
    </div>
  )
}
