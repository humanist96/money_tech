'use client'

import { useState } from 'react'
import type { HitRateLeaderboardItem, HiddenGemChannel, WeeklyReportItem } from '@/lib/types'
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
  weekly: { winners: WeeklyReportItem[]; losers: WeeklyReportItem[]; bestCall: WeeklyCall; worstCall: WeeklyCall }
  hiddenGems: HiddenGemChannel[]
}

export function LeaderboardTabs({ leaderboard, typeStats, weekly, hiddenGems }: Props) {
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

      {view === 'all' && <LeaderboardClient leaderboard={leaderboard} typeStats={typeStats} />}
      {view === 'weekly' && (
        <WeeklyReportPanel
          winners={weekly.winners}
          losers={weekly.losers}
          bestCall={weekly.bestCall}
          worstCall={weekly.worstCall}
        />
      )}
      {view === 'gems' && <HiddenGemsPanel channels={hiddenGems} />}
    </div>
  )
}
