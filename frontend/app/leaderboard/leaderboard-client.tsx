'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { HitRateLeaderboardItem } from '@/lib/types'
import { CATEGORY_LABELS, CHANNEL_TYPE_CONFIG } from '@/lib/types'
import { ChannelTypeBadge } from '@/components/ui/channel-type-badge'

interface Props {
  leaderboard: HitRateLeaderboardItem[]
  typeStats: Array<{ channel_type: string; count: number; avg_pis: number | null; avg_hit_rate: number | null }>
}

type SortKey = 'hit_rate' | 'total_predictions' | 'pis'

export function LeaderboardClient({ leaderboard, typeStats }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>('hit_rate')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const filtered = leaderboard
    .filter(item => filterCategory === 'all' || item.category === filterCategory)
    .sort((a, b) => {
      if (sortBy === 'hit_rate') return (b.hit_rate ?? 0) - (a.hit_rate ?? 0)
      if (sortBy === 'total_predictions') return b.all_predictions - a.all_predictions
      return (b.pis ?? 0) - (a.pis ?? 0)
    })

  const categories = [...new Set(leaderboard.map(l => l.category))]

  const predictorStats = typeStats.find(s => s.channel_type === 'predictor')
  const leaderStats = typeStats.find(s => s.channel_type === 'leader')

  return (
    <div className="space-y-6">
      {/* Type Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="예측형 채널"
          value={predictorStats?.count ?? 0}
          sub={`평균 PIS ${predictorStats?.avg_pis ?? 0}`}
          color="#f97316"
        />
        <StatCard
          label="리딩방 채널"
          value={leaderStats?.count ?? 0}
          sub={`평균 PIS ${leaderStats?.avg_pis ?? 0}`}
          color="#ef4444"
        />
        <StatCard
          label="평가 완료"
          value={leaderboard.reduce((s, l) => s + l.total_predictions, 0)}
          sub="건의 예측 검증됨"
          color="#22c997"
        />
        <StatCard
          label="평균 적중률"
          value={leaderboard.length > 0
            ? `${Math.round(leaderboard.filter(l => l.total_predictions > 0).reduce((s, l) => s + l.hit_rate, 0) / Math.max(leaderboard.filter(l => l.total_predictions > 0).length, 1) * 100)}%`
            : '-'}
          sub="평가된 채널 기준"
          color="#7c6cf0"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-[#0a1628] border border-[#1a2744] rounded-lg p-1">
          {(['all', ...categories] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterCategory === cat
                  ? 'bg-[#1a2744] text-white'
                  : 'text-[#5a6a88] hover:text-white'
              }`}
            >
              {cat === 'all' ? '전체' : CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 bg-[#0a1628] border border-[#1a2744] rounded-lg p-1">
          {([
            { key: 'hit_rate' as SortKey, label: '적중률순' },
            { key: 'total_predictions' as SortKey, label: '예측수순' },
            { key: 'pis' as SortKey, label: 'PIS순' },
          ]).map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                sortBy === opt.key
                  ? 'bg-[#1a2744] text-white'
                  : 'text-[#5a6a88] hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table */}
      {filtered.length === 0 ? (
        <div className="card-dark p-12 text-center">
          <p className="text-[#5a6a88] text-sm">아직 예측 데이터가 없습니다</p>
          <p className="text-[#3a4a6a] text-xs mt-1">크롤링이 진행되면 자동으로 표시됩니다</p>
        </div>
      ) : (
        <div className="card-dark overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a2744]">
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-[#5a6a88] font-medium">순위</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-[#5a6a88] font-medium">채널</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-[#5a6a88] font-medium">유형</th>
                  <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-[#5a6a88] font-medium">적중률</th>
                  <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-[#5a6a88] font-medium">예측</th>
                  <th className="text-center px-4 py-3 text-[10px] uppercase tracking-wider text-[#5a6a88] font-medium">PIS</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-[#5a6a88] font-medium hidden lg:table-cell">최근 예측</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, index) => (
                  <LeaderboardRow key={item.channel_id} item={item} rank={index + 1} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function LeaderboardRow({ item, rank }: { item: HitRateLeaderboardItem; rank: number }) {
  const hitPct = Math.round(item.hit_rate * 100)
  const medalColors: Record<number, string> = {
    1: 'text-yellow-400',
    2: 'text-gray-300',
    3: 'text-amber-600',
  }

  return (
    <tr className="border-b border-[#1a2744]/50 hover:bg-[#0d1b2a]/50 transition-colors">
      <td className="px-4 py-3">
        <span className={`text-lg font-bold tabular-nums ${medalColors[rank] ?? 'text-[#5a6a88]'}`} style={{ fontFamily: 'var(--font-outfit)' }}>
          {rank <= 3 ? ['', '🥇', '🥈', '🥉'][rank] : rank}
        </span>
      </td>
      <td className="px-4 py-3">
        <Link href={`/channels/${item.channel_id}`} className="flex items-center gap-3 group">
          {item.channel_thumbnail ? (
            <img src={item.channel_thumbnail} alt={item.channel_name} className="w-8 h-8 rounded-full border border-[#1a2744]" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#1a2744] flex items-center justify-center text-xs text-[#5a6a88]">
              {item.channel_name[0]}
            </div>
          )}
          <div>
            <span className="text-sm font-medium text-white group-hover:text-[#00e8b8] transition-colors">
              {item.channel_name}
            </span>
            <span className="block text-[10px] text-[#5a6a88]">
              {CATEGORY_LABELS[item.category] ?? item.category}
            </span>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3">
        <ChannelTypeBadge type={item.channel_type} />
      </td>
      <td className="px-4 py-3 text-right">
        {item.total_predictions > 0 ? (
          <div className="flex items-center justify-end gap-2">
            <div className="w-16 h-1.5 rounded-full bg-[#1a2744] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${hitPct}%`,
                  backgroundColor: hitPct >= 60 ? '#22c997' : hitPct >= 40 ? '#f97316' : '#ef4444',
                }}
              />
            </div>
            <span className="text-sm font-semibold tabular-nums text-white" style={{ fontFamily: 'var(--font-outfit)' }}>
              {hitPct}%
            </span>
          </div>
        ) : (
          <span className="text-xs text-[#3a4a6a]">미평가</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="text-sm tabular-nums text-white" style={{ fontFamily: 'var(--font-outfit)' }}>
          {item.accurate_count}/{item.total_predictions}
        </div>
        <div className="text-[10px] text-[#5a6a88]">총 {item.all_predictions}건</div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#0a1628] border border-[#1a2744] text-sm font-bold tabular-nums"
          style={{
            fontFamily: 'var(--font-outfit)',
            color: (item.pis ?? 0) >= 50 ? '#ef4444' : (item.pis ?? 0) >= 30 ? '#f97316' : '#3b82f6',
          }}
        >
          {Math.round(item.pis ?? 0)}
        </span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <div className="flex items-center gap-1">
          {item.recent_predictions.slice(0, 5).map((pred, i) => (
            <PredictionDot key={i} type={pred.prediction_type} accurate={pred.is_accurate} asset={pred.asset_name} />
          ))}
        </div>
      </td>
    </tr>
  )
}

function PredictionDot({ type, accurate, asset }: { type: string; accurate: boolean | null; asset: string }) {
  const typeColors: Record<string, string> = {
    buy: '#22c997',
    sell: '#ef4444',
    hold: '#f97316',
  }
  const bg = typeColors[type] ?? '#5a6a88'

  return (
    <div className="relative group">
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold border"
        style={{
          backgroundColor: `${bg}20`,
          borderColor: `${bg}40`,
          color: bg,
        }}
      >
        {type === 'buy' ? 'B' : type === 'sell' ? 'S' : 'H'}
        {accurate === true && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#22c997]" />}
        {accurate === false && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#ef4444]" />}
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#1a2744] rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {asset} - {type === 'buy' ? '매수' : type === 'sell' ? '매도' : '보유'}
        {accurate === true ? ' ✓' : accurate === false ? ' ✗' : ''}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub: string; color: string }) {
  return (
    <div className="card-dark p-4">
      <div className="text-[10px] uppercase tracking-wider text-[#5a6a88] mb-1">{label}</div>
      <div className="text-2xl font-bold tabular-nums text-white" style={{ fontFamily: 'var(--font-outfit)', color }}>
        {value}
      </div>
      <div className="text-[10px] text-[#3a4a6a] mt-0.5">{sub}</div>
    </div>
  )
}
