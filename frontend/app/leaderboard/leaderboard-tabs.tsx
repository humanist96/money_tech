'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { HitRateLeaderboardItem, HiddenGemChannel, WeeklyReportItem, Horizon } from '@/lib/types'
import { LeaderboardClient } from './leaderboard-client'
import { WeeklyReportPanel, type WeeklyCall } from '@/components/features/weekly-report'
import { HiddenGemsPanel } from '@/components/features/hidden-gems'

type View = 'all' | 'weekly' | 'gems'

const VIEWS: Array<{ key: View; label: string; hint: string }> = [
  { key: 'all', label: '전체 랭킹', hint: '예측 채널 전체를 적중률·예측 건수로 정렬' },
  { key: 'weekly', label: '주간 리포트', hint: '이번 주 적중왕과 최고/최악의 콜' },
  { key: 'gems', label: '숨은 보석', hint: '구독자는 적지만 적중률이 높은 채널' },
]

interface Props {
  leaderboard: HitRateLeaderboardItem[]
  typeStats: Array<{ channel_type: string; count: number; avg_pis: number | null; avg_hit_rate: number | null }>
  weekly: {
    winners: WeeklyReportItem[]; losers: WeeklyReportItem[]; bestCall: WeeklyCall; worstCall: WeeklyCall
    periodStart: string | null; periodEnd: string | null
  }
  hiddenGems: HiddenGemChannel[]
  horizon: Horizon
}

const HORIZON_TABS: Array<{ key: Horizon; label: string }> = [
  { key: '1w', label: '1주' },
  { key: '1m', label: '1개월' },
  { key: '3m', label: '3개월' },
]

export function LeaderboardTabs({ leaderboard, typeStats, weekly, hiddenGems, horizon }: Props) {
  const [view, setView] = useState<View>('all')
  const active = VIEWS.find((v) => v.key === view)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3.5 py-2 text-sm rounded-lg border transition-colors ${
              view === v.key
                ? 'bg-th-tertiary border-th-accent/40 text-th-accent'
                : 'bg-th-secondary border-th-border text-th-dim hover:text-th-primary'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {active && <p className="text-xs text-th-dim">{active.hint}</p>}

      {/* Horizons are scored independently — a call can be right at one month
          and wrong at three, so they are never averaged together. */}
      {view === 'all' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-th-dim">평가 구간</span>
          <div className="filter-group flex items-center gap-1.5">
            {HORIZON_TABS.map((h) => (
              <Link
                key={h.key}
                href={`/leaderboard?horizon=${h.key}`}
                scroll={false}
                className={`filter-btn ${horizon === h.key ? 'active' : ''}`}
              >
                {h.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {view === 'all' && <LeaderboardClient leaderboard={leaderboard} typeStats={typeStats} />}
      {view === 'weekly' && (
        <WeeklyReportPanel
          winners={weekly.winners}
          losers={weekly.losers}
          bestCall={weekly.bestCall}
          worstCall={weekly.worstCall}
          periodStart={weekly.periodStart}
          periodEnd={weekly.periodEnd}
        />
      )}
      {view === 'gems' && <HiddenGemsPanel channels={hiddenGems} />}
    </div>
  )
}
