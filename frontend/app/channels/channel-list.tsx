"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import type { Channel, ChannelType } from "@/lib/types"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"
import { formatViewCount } from "@/lib/queries"
import { ChannelTypeBadge } from "@/components/ui/channel-type-badge"

interface ChannelListProps {
  channels: Channel[]
}

const CATEGORIES = [
  { value: "all", label: "ALL", color: "#00e8b8" },
  { value: "stock", label: "주식", color: "#ff5757" },
  { value: "coin", label: "코인", color: "#ffb84d" },
  { value: "real_estate", label: "부동산", color: "#22c997" },
  { value: "economy", label: "경제", color: "#7c6cf0" },
]

type SortKey = "subscriber_count" | "total_view_count" | "video_count" | "name"
type ViewMode = "grid" | "list"

const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "subscriber_count",
    label: "구독자",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      </svg>
    ),
  },
  {
    key: "total_view_count",
    label: "조회수",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    key: "video_count",
    label: "영상수",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    ),
  },
  {
    key: "name",
    label: "이름순",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="M11 4h4" /><path d="M11 8h7" /><path d="M11 12h10" />
      </svg>
    ),
  },
]

function ChannelCardGrid({ channel, rank }: { channel: Channel; rank: number }) {
  const color = CATEGORY_COLORS[channel.category] ?? "#6b7280"
  const maxSub = 1000000
  const subRatio = Math.min(((channel.subscriber_count ?? 0) / maxSub) * 100, 100)

  return (
    <Link href={`/channels/${channel.id}`}>
      <div
        className={`channel-card glass-card-elevated rounded-2xl p-0 h-full group cat-${channel.category}`}
        style={{ '--cat-color': color } as React.CSSProperties}
      >
        {/* Header gradient area */}
        <div className="relative h-20 rounded-t-2xl overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${color} 15%, #0a1120) 0%, #0a1120 100%)`,
            }}
          />
          <div
            className="absolute top-3 right-4 text-[10px] font-bold tracking-widest uppercase"
            style={{ color: `color-mix(in srgb, ${color} 60%, transparent)` }}
          >
            #{String(rank).padStart(2, "0")}
          </div>
          {/* Avatar - positioned to overlap */}
          <div className="absolute -bottom-7 left-5">
            <div
              className="rounded-2xl p-[2px] shadow-lg"
              style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 40%, transparent))` }}
            >
              {channel.thumbnail_url ? (
                <img
                  src={channel.thumbnail_url}
                  alt={channel.name}
                  className="w-14 h-14 rounded-[14px] object-cover bg-[#0a1120]"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-[14px] flex items-center justify-center text-xl font-bold"
                  style={{ background: `color-mix(in srgb, ${color} 18%, #0a1120)`, color }}
                >
                  {channel.name[0]}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pt-10 pb-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-[15px] text-white truncate group-hover:text-[#00e8b8] transition-colors duration-200">
                {channel.name}
              </h3>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={`cat-badge cat-${channel.category} text-[10px] font-semibold px-2 py-0.5 rounded-md`}
                  style={{ '--cat-color': color } as React.CSSProperties}
                >
                  {CATEGORY_LABELS[channel.category]}
                </span>
                {channel.channel_type && channel.channel_type !== 'unknown' && (
                  <ChannelTypeBadge type={channel.channel_type as ChannelType} />
                )}
                <a
                  href={`https://www.youtube.com/channel/${channel.youtube_channel_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#475569] hover:text-[#ff0000] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {channel.description && (
            <p className="text-[11px] text-[#5a6a88] mt-3 line-clamp-2 leading-[1.6]">
              {channel.description}
            </p>
          )}

          {/* Stats grid */}
          <div className="mt-4 pt-4 border-t border-[#1a2744]/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#475569] uppercase tracking-wider font-medium">구독자</span>
              <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-outfit)', color }}>
                {formatViewCount(channel.subscriber_count)}
              </span>
            </div>
            <div className="stat-bar">
              <div className="stat-bar-fill" style={{ width: `${subRatio}%`, background: color }} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <span className="text-[10px] text-[#475569] uppercase tracking-wider">조회수</span>
                <p className="text-[13px] font-semibold text-[#b4c1d8] mt-0.5 tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
                  {formatViewCount(channel.total_view_count)}
                </p>
              </div>
              <div className="w-px h-6 bg-[#1a2744]" />
              <div className="flex-1 text-right">
                <span className="text-[10px] text-[#475569] uppercase tracking-wider">영상</span>
                <p className="text-[13px] font-semibold text-[#b4c1d8] mt-0.5 tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
                  {channel.video_count?.toLocaleString() ?? "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

function ChannelCardList({ channel, rank }: { channel: Channel; rank: number }) {
  const color = CATEGORY_COLORS[channel.category] ?? "#6b7280"

  return (
    <Link href={`/channels/${channel.id}`}>
      <div
        className={`channel-row cat-${channel.category} flex items-center gap-4 px-5 py-4 rounded-xl`}
        style={{ '--cat-color': color } as React.CSSProperties}
      >
        <span
          className="text-[11px] font-bold w-6 text-center tabular-nums"
          style={{ color: `color-mix(in srgb, ${color} 60%, #475569)` }}
        >
          {rank}
        </span>

        <div
          className="rounded-xl p-[2px] shrink-0"
          style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 30%, transparent))` }}
        >
          {channel.thumbnail_url ? (
            <img src={channel.thumbnail_url} alt="" className="w-11 h-11 rounded-[10px] object-cover bg-[#0a1120]" />
          ) : (
            <div
              className="w-11 h-11 rounded-[10px] flex items-center justify-center text-base font-bold"
              style={{ background: `color-mix(in srgb, ${color} 15%, #0a1120)`, color }}
            >
              {channel.name[0]}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-white truncate hover:text-[#00e8b8] transition-colors">
              {channel.name}
            </h3>
            <span
              className={`cat-badge cat-${channel.category} text-[9px] font-semibold px-1.5 py-0.5 rounded-md shrink-0`}
              style={{ '--cat-color': color } as React.CSSProperties}
            >
              {CATEGORY_LABELS[channel.category]}
            </span>
          </div>
          {channel.description && (
            <p className="text-[11px] text-[#475569] mt-0.5 line-clamp-1">{channel.description}</p>
          )}
        </div>

        <div className="hidden md:flex items-center gap-8 shrink-0">
          <div className="text-right min-w-[72px]">
            <p className="text-[13px] font-bold tabular-nums" style={{ fontFamily: 'var(--font-outfit)', color }}>
              {formatViewCount(channel.subscriber_count)}
            </p>
            <p className="text-[9px] text-[#475569] uppercase tracking-wider">구독자</p>
          </div>
          <div className="text-right min-w-[72px]">
            <p className="text-[13px] font-semibold text-[#94a3b8] tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
              {formatViewCount(channel.total_view_count)}
            </p>
            <p className="text-[9px] text-[#475569] uppercase tracking-wider">조회수</p>
          </div>
          <div className="text-right min-w-[56px]">
            <p className="text-[13px] font-semibold text-[#94a3b8] tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
              {channel.video_count?.toLocaleString() ?? "-"}
            </p>
            <p className="text-[9px] text-[#475569] uppercase tracking-wider">영상</p>
          </div>
        </div>

        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2a3a5c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </div>
    </Link>
  )
}

export function ChannelList({ channels }: ChannelListProps) {
  const [category, setCategory] = useState("all")
  const [sortBy, setSortBy] = useState<SortKey>("subscriber_count")
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")

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

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: channels.length }
    for (const ch of channels) {
      counts[ch.category] = (counts[ch.category] ?? 0) + 1
    }
    return counts
  }, [channels])

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="search-glow glass-card-elevated rounded-2xl px-5 py-4 flex items-center gap-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="채널명, 설명, 카테고리로 검색..."
          className="flex-1 bg-transparent text-sm text-[#e2e8f0] placeholder:text-[#3a4a6a] outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1a2744] text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#2a3a5c] transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        )}
        {search && (
          <span className="text-[11px] text-[#475569] tabular-nums shrink-0">
            {filtered.length}건
          </span>
        )}
      </div>

      {/* Controls row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Category pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => {
            const isActive = category === cat.value
            const count = catCounts[cat.value] ?? 0
            return (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200"
                style={
                  isActive
                    ? {
                        background: `color-mix(in srgb, ${cat.color} 12%, transparent)`,
                        color: cat.color,
                        border: `1px solid color-mix(in srgb, ${cat.color} 30%, transparent)`,
                        boxShadow: `0 0 16px color-mix(in srgb, ${cat.color} 10%, transparent)`,
                      }
                    : {
                        background: 'transparent',
                        color: '#5a6a88',
                        border: '1px solid #1a2744',
                      }
                }
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color, opacity: isActive ? 1 : 0.4 }} />
                {cat.label}
                <span
                  className="text-[10px] tabular-nums ml-0.5"
                  style={{ opacity: isActive ? 0.8 : 0.5 }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Sort + View toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`sort-pill flex items-center gap-1 ${sortBy === opt.key ? 'active' : ''}`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-[#1a2744] mx-1" />
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
              title="그리드 보기"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
              title="리스트 보기"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Shimmer divider */}
      <div className="shimmer-line h-px" />

      {/* Results */}
      {viewMode === "grid" ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-in">
          {filtered.map((channel, i) => (
            <ChannelCardGrid key={channel.id} channel={channel} rank={i + 1} />
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden divide-y divide-[#1a2744]/40 stagger-in">
          {filtered.map((channel, i) => (
            <ChannelCardList key={channel.id} channel={channel} rank={i + 1} />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="glass-card rounded-2xl py-20 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0e1a30] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2a3a5c" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <p className="text-[#5a6a88] text-sm font-medium">검색 결과가 없습니다</p>
          <p className="text-[#3a4a6a] text-xs mt-1">다른 키워드나 카테고리를 시도해보세요</p>
          <button
            onClick={() => { setSearch(""); setCategory("all") }}
            className="mt-4 text-xs text-[#00e8b8] hover:text-[#00ffc8] transition font-medium"
          >
            필터 초기화
          </button>
        </div>
      )}
    </div>
  )
}
