"use client"

import type { HotKeyword } from "@/lib/types"

interface HotKeywordsRankingProps {
  keywords: HotKeyword[]
  title?: string
}

export function HotKeywordsRanking({ keywords, title = "핫 키워드 랭킹" }: HotKeywordsRankingProps) {
  if (keywords.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <p className="text-sm text-th-dim">키워드 데이터를 수집 중입니다.</p>
      </div>
    )
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
      </div>
      <div className="p-3 space-y-0.5">
        {keywords.map((kw, i) => {
          const isNew = kw.rank_change === 99
          const isUp = kw.rank_change > 0
          const isDown = kw.rank_change < 0
          const changeColor = isNew ? "var(--th-accent)" : isUp ? "#22c997" : isDown ? "#ff5757" : "var(--th-text-dim)"

          return (
            <div key={kw.keyword} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-th-hover/50 transition">
              <span className="text-[11px] font-bold tabular-nums w-5 text-center" style={{ fontFamily: 'var(--font-outfit)', color: i < 3 ? 'var(--th-accent)' : 'var(--th-text-dim)' }}>
                {i + 1}
              </span>
              <span className="flex-1 text-sm text-th-primary font-medium truncate">{kw.keyword}</span>
              <span className="text-[10px] tabular-nums text-th-dim" style={{ fontFamily: 'var(--font-outfit)' }}>
                {kw.count}회
              </span>
              <div className="w-12 flex items-center justify-end gap-0.5" style={{ color: changeColor }}>
                {isNew ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-th-accent/10 text-th-accent">NEW</span>
                ) : kw.rank_change !== 0 ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      {isUp ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
                    </svg>
                    <span className="text-[10px] font-bold tabular-nums">{Math.abs(kw.rank_change)}</span>
                  </>
                ) : (
                  <span className="text-[10px] text-th-dim">-</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
