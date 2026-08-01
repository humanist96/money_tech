"use client"

import { useState } from "react"
import type { DailyMover } from "@/lib/types"
import { MoverCard } from "@/components/features/mover-card"

type Tab = "all" | "up" | "down" | "creator"

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "all", label: "전체" },
  { key: "up", label: "상승" },
  { key: "down", label: "하락" },
  { key: "creator", label: "크리에이터 관심" },
]

export function MoversClient({
  movers,
  tradeDate,
}: {
  movers: DailyMover[]
  tradeDate: string | null
}) {
  const [tab, setTab] = useState<Tab>("all")

  if (!tradeDate || movers.length === 0) {
    return (
      <div className="card-dark p-12 text-center">
        <p className="text-th-dim text-sm">
          아직 분석된 등락 데이터가 없습니다. 장 마감 후 집계됩니다.
        </p>
      </div>
    )
  }

  const filtered = movers.filter((m) => {
    if (tab === "up") return m.change_pct >= 0
    if (tab === "down") return m.change_pct < 0
    if (tab === "creator") return m.selection_reason === "creator_pick"
    return true
  })

  const withCreator = movers.filter(
    (m) => (m.creator_context?.predictions?.length ?? 0) > 0
  ).length
  const explained = movers.filter((m) => m.cause_type !== "unexplained").length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="filter-group flex items-center gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`filter-btn ${tab === t.key ? "active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-th-dim">
          {movers.length}개 종목 · 크리에이터 언급 {withCreator}건 · 원인 규명 {explained}건
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="card-dark p-10 text-center">
          <p className="text-th-dim text-sm">해당 조건의 종목이 없습니다</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((mover) => (
            <MoverCard key={mover.id} mover={mover} />
          ))}
        </div>
      )}
    </div>
  )
}
