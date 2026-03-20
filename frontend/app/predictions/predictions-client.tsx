'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import type { ActivePrediction } from '@/lib/types'

interface Props {
  predictions: ActivePrediction[]
}

type DirectionFilter = 'all' | 'buy' | 'sell' | 'hold'
type StatusFilter = 'all' | 'active' | 'hit' | 'miss'
type SortKey = 'newest' | 'closest' | 'furthest'

function getStatus(p: ActivePrediction): 'hit' | 'miss' | 'active' {
  if (p.is_accurate === true || (p.direction_score != null && p.direction_score >= 0.5)) return 'hit'
  if (p.is_accurate === false || (p.direction_score != null && p.direction_score < 0.5 && p.direction_score > -1)) return 'miss'
  return 'active'
}

function getStatusLabel(status: 'hit' | 'miss' | 'active') {
  if (status === 'hit') return { icon: '\u2705', label: '\uc801\uc911' }
  if (status === 'miss') return { icon: '\u274C', label: '\uc2e4\ud328' }
  return { icon: '\u23F3', label: '\uc9c4\ud589\uc911' }
}

function formatPrice(price: number | null): string {
  if (price == null) return '-'
  if (price >= 1000) return price.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
  return price.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
}

function DirectionBadge({ type }: { type: string | null }) {
  if (type === 'buy') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
        매수
      </span>
    )
  }
  if (type === 'sell') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/25">
        매도
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/15 text-gray-400 border border-gray-500/25">
      보유
    </span>
  )
}

function ProgressBar({ prediction }: { prediction: ActivePrediction }) {
  const { mentioned_price, current_price, target_price, progress_pct } = prediction

  if (mentioned_price == null || target_price == null || progress_pct == null) {
    return (
      <div className="space-y-2">
        <div className="h-2 rounded-full bg-th-border/30 overflow-hidden">
          <div className="h-full rounded-full bg-gray-500/40 w-0" />
        </div>
        <div className="flex justify-between text-[10px] text-th-dim">
          <span>데이터 부족</span>
        </div>
      </div>
    )
  }

  const isMovingToward = progress_pct >= 0
  const clampedPct = Math.max(0, Math.min(100, Math.abs(progress_pct)))
  const barColor = isMovingToward ? 'bg-emerald-500' : 'bg-red-500'

  return (
    <div className="space-y-1.5">
      <div className="h-2 rounded-full bg-th-border/30 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-th-dim">
        <div className="flex flex-col">
          <span className="text-th-dim/60">진입가</span>
          <span className="text-th-secondary font-medium tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
            {formatPrice(mentioned_price)}
          </span>
        </div>
        {current_price != null && (
          <div className="flex flex-col items-center">
            <span className="text-th-dim/60">현재가</span>
            <span className={`font-semibold tabular-nums ${isMovingToward ? 'text-emerald-400' : 'text-red-400'}`} style={{ fontFamily: 'var(--font-outfit)' }}>
              {formatPrice(current_price)}
            </span>
          </div>
        )}
        <div className="flex flex-col items-end">
          <span className="text-th-dim/60">목표가</span>
          <span className="text-th-secondary font-medium tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
            {formatPrice(target_price)}
          </span>
        </div>
      </div>
    </div>
  )
}

function PredictionCard({ prediction }: { prediction: ActivePrediction }) {
  const status = getStatus(prediction)
  const { icon, label } = getStatusLabel(status)

  return (
    <div className="bg-th-card border border-th-border rounded-2xl p-4 hover:border-[#a855f7]/30 transition-colors">
      {/* Header: Channel + Direction */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {prediction.channel_thumbnail ? (
            <Image
              src={prediction.channel_thumbnail}
              alt={prediction.channel_name}
              width={24}
              height={24}
              className="rounded-full shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-th-border/50 shrink-0" />
          )}
          <span className="text-xs text-th-secondary truncate">
            {prediction.channel_name}
          </span>
        </div>
        <DirectionBadge type={prediction.prediction_type} />
      </div>

      {/* Asset name */}
      <div className="mb-3">
        <h3 className="text-base font-bold text-th-primary truncate" style={{ fontFamily: 'var(--font-outfit)' }}>
          {prediction.asset_name}
        </h3>
        {prediction.asset_code && (
          <span className="text-[11px] text-th-dim">{prediction.asset_code}</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <ProgressBar prediction={prediction} />
      </div>

      {/* Footer: Days + Progress % + Status */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-th-dim">
          {prediction.days_since}일 경과
        </span>
        {prediction.progress_pct != null && (
          <span
            className={`font-semibold tabular-nums ${prediction.progress_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            {prediction.progress_pct > 0 ? '+' : ''}{prediction.progress_pct.toFixed(1)}%
          </span>
        )}
        <span className="flex items-center gap-1 text-th-secondary">
          <span>{icon}</span>
          <span>{label}</span>
        </span>
      </div>
    </div>
  )
}

export function PredictionsClient({ predictions }: Props) {
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('newest')

  const filtered = useMemo(() => {
    let result = predictions.filter(p => {
      if (directionFilter !== 'all' && p.prediction_type !== directionFilter) return false
      if (statusFilter !== 'all') {
        const status = getStatus(p)
        if (statusFilter !== status) return false
      }
      return true
    })

    result = [...result].sort((a, b) => {
      if (sortKey === 'newest') {
        return new Date(b.predicted_at ?? 0).getTime() - new Date(a.predicted_at ?? 0).getTime()
      }
      if (sortKey === 'closest') {
        const aPct = a.progress_pct != null ? Math.abs(100 - a.progress_pct) : Infinity
        const bPct = b.progress_pct != null ? Math.abs(100 - b.progress_pct) : Infinity
        return aPct - bPct
      }
      // furthest
      const aPct = a.progress_pct ?? 0
      const bPct = b.progress_pct ?? 0
      return aPct - bPct
    })

    return result
  }, [predictions, directionFilter, statusFilter, sortKey])

  const directionOptions: { value: DirectionFilter; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'buy', label: '매수' },
    { value: 'sell', label: '매도' },
    { value: 'hold', label: '보유' },
  ]

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'active', label: '진행중' },
    { value: 'hit', label: '적중' },
    { value: 'miss', label: '실패' },
  ]

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: 'newest', label: '최신순' },
    { value: 'closest', label: '목표 근접순' },
    { value: 'furthest', label: '목표 이탈순' },
  ]

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Direction filter */}
        <div className="flex items-center gap-1 bg-th-card border border-th-border rounded-xl p-1">
          {directionOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDirectionFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                directionFilter === opt.value
                  ? 'bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/30'
                  : 'text-th-dim hover:text-th-secondary border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 bg-th-card border border-th-border rounded-xl p-1">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/30'
                  : 'text-th-dim hover:text-th-secondary border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="ml-auto bg-th-card border border-th-border rounded-xl px-3 py-2 text-xs text-th-secondary focus:outline-none focus:border-[#a855f7]/40"
        >
          {sortOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <div className="text-xs text-th-dim">
        <span className="tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>{filtered.length}</span>개 예측
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-th-dim text-sm">
          조건에 맞는 예측이 없습니다
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(prediction => (
            <PredictionCard key={prediction.id} prediction={prediction} />
          ))}
        </div>
      )}
    </div>
  )
}
