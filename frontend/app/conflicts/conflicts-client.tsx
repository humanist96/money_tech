"use client"

import { useState, useMemo } from "react"
import type { ConflictingOpinion } from "@/lib/types"

type SortKey = "conflict" | "opinions" | "recent"
type MinFilter = 2 | 3 | 5

interface ConflictsClientProps {
  conflicts: ConflictingOpinion[]
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "conflict", label: "충돌 강도" },
  { key: "opinions", label: "의견 수" },
  { key: "recent", label: "최신순" },
]

const MIN_FILTER_OPTIONS: { value: MinFilter; label: string }[] = [
  { value: 2, label: "2+" },
  { value: 3, label: "3+" },
  { value: 5, label: "5+" },
]

function ConflictBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-th-dim">충돌 강도</span>
        <span
          className="text-xs font-bold tabular-nums"
          style={{
            fontFamily: "var(--font-outfit)",
            color: pct >= 80 ? "#ff5757" : pct >= 50 ? "#ffb84d" : "#7c6cf0",
          }}
        >
          {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-th-border/30 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, #ffb84d, ${pct >= 70 ? "#ff5757" : "#ffb84d"})`,
          }}
        />
      </div>
    </div>
  )
}

function ChannelBadge({ name, variant }: { name: string; variant: "bullish" | "bearish" }) {
  const styles = variant === "bullish"
    ? "bg-[#22c997]/10 text-[#22c997] border-[#22c997]/20"
    : "bg-[#ff5757]/10 text-[#ff5757] border-[#ff5757]/20"

  return (
    <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-md border ${styles}`}>
      {name}
    </span>
  )
}

function ConflictCard({ item }: { item: ConflictingOpinion }) {
  return (
    <div className="glass-card-elevated rounded-2xl p-5 border border-th-border/50 hover:border-[#ff5757]/20 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-th-primary" style={{ fontFamily: "var(--font-outfit)" }}>
            {item.asset_name}
          </h3>
          <span className="text-[11px] text-th-dim">{item.asset_code}</span>
        </div>
        <div className="text-right shrink-0">
          <div
            className="text-xl font-bold tabular-nums"
            style={{
              fontFamily: "var(--font-outfit)",
              color: item.conflict_score >= 0.8 ? "#ff5757" : item.conflict_score >= 0.5 ? "#ffb84d" : "#7c6cf0",
            }}
          >
            {Math.round(item.conflict_score * 100)}%
          </div>
          <div className="text-[10px] text-th-dim">{item.total_opinions}건 의견</div>
        </div>
      </div>

      <ConflictBar score={item.conflict_score} />

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c997" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            </svg>
            <span className="text-[11px] font-semibold text-[#22c997]">
              강세 ({item.bullish_channels.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {item.bullish_channels.map((ch) => (
              <ChannelBadge key={ch} name={ch} variant="bullish" />
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff5757" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
            </svg>
            <span className="text-[11px] font-semibold text-[#ff5757]">
              약세 ({item.bearish_channels.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {item.bearish_channels.map((ch) => (
              <ChannelBadge key={ch} name={ch} variant="bearish" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ConflictsClient({ conflicts }: ConflictsClientProps) {
  const [sortKey, setSortKey] = useState<SortKey>("conflict")
  const [minFilter, setMinFilter] = useState<MinFilter>(2)

  const filtered = useMemo(() => {
    const items = conflicts.filter((c) => c.total_opinions >= minFilter)

    return [...items].sort((a, b) => {
      if (sortKey === "conflict") return b.conflict_score - a.conflict_score
      if (sortKey === "opinions") return b.total_opinions - a.total_opinions
      return new Date(b.recent_date).getTime() - new Date(a.recent_date).getTime()
    })
  }, [conflicts, sortKey, minFilter])

  if (conflicts.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-10 text-center">
        <div className="w-12 h-12 rounded-xl bg-th-border/20 flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-th-dim">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 15h8" />
            <path d="M9 9h.01" />
            <path d="M15 9h.01" />
          </svg>
        </div>
        <p className="text-sm text-th-dim">현재 의견이 크게 갈리는 종목이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-th-card/50 rounded-lg p-0.5 border border-th-border/30">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortKey(opt.key)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                sortKey === opt.key
                  ? "bg-th-accent/10 text-th-accent font-semibold"
                  : "text-th-dim hover:text-th-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-th-dim">최소 의견 수:</span>
          <div className="flex items-center gap-1 bg-th-card/50 rounded-lg p-0.5 border border-th-border/30">
            {MIN_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMinFilter(opt.value)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  minFilter === opt.value
                    ? "bg-th-accent/10 text-th-accent font-semibold"
                    : "text-th-dim hover:text-th-secondary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <span className="text-[11px] text-th-dim ml-auto tabular-nums" style={{ fontFamily: "var(--font-outfit)" }}>
          {filtered.length}건
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card-elevated rounded-2xl p-10 text-center">
          <p className="text-sm text-th-dim">해당 조건에 맞는 충돌 종목이 없습니다</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <ConflictCard key={item.asset_code} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
