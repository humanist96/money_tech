"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import type { Channel } from "@/lib/types"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"
import { formatViewCount } from "@/lib/queries"

interface ChannelListProps {
  channels: Channel[]
}

const CATEGORIES = [
  { value: "all", label: "전체", color: "#00d4aa" },
  { value: "stock", label: "주식", color: "#ef4444" },
  { value: "coin", label: "코인", color: "#f59e0b" },
  { value: "real_estate", label: "부동산", color: "#10b981" },
  { value: "economy", label: "경제", color: "#6366f1" },
]

type SortKey = "subscriber_count" | "total_view_count" | "video_count" | "name"

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "subscriber_count", label: "구독자순" },
  { key: "total_view_count", label: "조회수순" },
  { key: "video_count", label: "영상수순" },
  { key: "name", label: "이름순" },
]

export function ChannelList({ channels }: ChannelListProps) {
  const [category, setCategory] = useState("all")
  const [sortBy, setSortBy] = useState<SortKey>("subscriber_count")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    return channels
      .filter((ch) => category === "all" || ch.category === category)
      .filter((ch) => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (
          ch.name.toLowerCase().includes(q) ||
          (ch.description ?? "").toLowerCase().includes(q) ||
          CATEGORY_LABELS[ch.category].includes(q)
        )
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name)
        return ((b[sortBy] ?? 0) as number) - ((a[sortBy] ?? 0) as number)
      })
  }, [channels, category, sortBy, search])

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="search-glow glass-card rounded-xl px-4 py-3 flex items-center gap-3 transition-all">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="채널명, 키워드로 검색..."
          className="flex-1 bg-transparent text-sm text-[#e2e8f0] placeholder:text-[#475569] outline-none"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-[#64748b] hover:text-[#94a3b8]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Category pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
              style={
                category === cat.value
                  ? {
                      background: `color-mix(in srgb, ${cat.color} 20%, transparent)`,
                      color: cat.color,
                      border: `1px solid color-mix(in srgb, ${cat.color} 40%, transparent)`,
                      boxShadow: `0 0 12px color-mix(in srgb, ${cat.color} 15%, transparent)`,
                    }
                  : {
                      background: 'transparent',
                      color: '#64748b',
                      border: '1px solid #1e293b',
                    }
              }
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sort options */}
        <div className="flex items-center gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                sortBy === opt.key
                  ? "bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/30"
                  : "text-[#64748b] hover:text-[#94a3b8] border border-transparent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-[#475569]">
        {filtered.length}개 채널
        {search && <span className="text-[#00d4aa]"> &quot;{search}&quot;</span>}
      </p>

      {/* Channel grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-in">
        {filtered.map((channel) => {
          const color = CATEGORY_COLORS[channel.category] ?? "#6b7280"
          return (
            <Link key={channel.id} href={`/channels/${channel.id}`}>
              <div className="glass-card rounded-xl p-5 h-full group relative overflow-hidden">
                {/* Accent line */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px] opacity-60 group-hover:opacity-100 transition"
                  style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
                />

                <div className="flex items-start gap-3.5">
                  {/* Avatar */}
                  <div className={`avatar-ring cat-${channel.category} shrink-0`} style={{ '--cat-color': color } as React.CSSProperties}>
                    {channel.thumbnail_url ? (
                      <img src={channel.thumbnail_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                        style={{ background: `color-mix(in srgb, ${color} 18%, #0c1324)`, color }}
                      >
                        {channel.name[0]}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-white text-sm truncate group-hover:text-[#00d4aa] transition">
                      {channel.name}
                    </h3>
                    <span
                      className={`cat-badge cat-${channel.category} text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-block mt-1`}
                      style={{ '--cat-color': color } as React.CSSProperties}
                    >
                      {CATEGORY_LABELS[channel.category]}
                    </span>
                    {channel.description && (
                      <p className="text-[11px] text-[#475569] mt-2 line-clamp-2 leading-relaxed">
                        {channel.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mt-4 pt-3.5 border-t border-[#1e293b]/50">
                  <div>
                    <p className="text-[10px] text-[#475569] uppercase tracking-wider">구독자</p>
                    <p className="text-sm font-bold text-white mt-0.5 tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
                      {formatViewCount(channel.subscriber_count)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#475569] uppercase tracking-wider">조회수</p>
                    <p className="text-sm font-bold text-[#94a3b8] mt-0.5 tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
                      {formatViewCount(channel.total_view_count)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#475569] uppercase tracking-wider">영상</p>
                    <p className="text-sm font-bold text-[#94a3b8] mt-0.5 tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
                      {channel.video_count?.toLocaleString() ?? "-"}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="glass-card rounded-xl py-16 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" className="mx-auto mb-3">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <p className="text-[#64748b] text-sm">검색 결과가 없습니다.</p>
          <button
            onClick={() => { setSearch(""); setCategory("all") }}
            className="text-xs text-[#00d4aa] hover:underline mt-2"
          >
            필터 초기화
          </button>
        </div>
      )}
    </div>
  )
}
