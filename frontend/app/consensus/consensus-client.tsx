'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AssetConsensus } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/types'

interface Props {
  consensus: AssetConsensus[]
  predictorCount: number
}

type SortKey = 'consensus_score' | 'channel_count' | 'total_mentions'

export function ConsensusClient({ consensus, predictorCount }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>('channel_count')
  const [filterType, setFilterType] = useState<string>('all')

  const filtered = consensus
    .filter(item => filterType === 'all' || item.asset_type === filterType)
    .sort((a, b) => {
      if (sortBy === 'consensus_score') return b.consensus_score - a.consensus_score
      if (sortBy === 'channel_count') return b.channel_count - a.channel_count
      return b.total_mentions - a.total_mentions
    })

  const assetTypes = [...new Set(consensus.map(c => c.asset_type).filter(Boolean))]

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard label="분석 종목" value={consensus.length} color="#22c997" />
        <SummaryCard label="예측 채널" value={predictorCount} color="#f97316" />
        <SummaryCard
          label="강한 컨센서스"
          value={consensus.filter(c => c.consensus_score >= 70).length}
          color="#7c6cf0"
        />
        <SummaryCard
          label="의견 분열"
          value={consensus.filter(c => c.consensus_score < 50).length}
          color="#ef4444"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-[#0a1628] border border-[#1a2744] rounded-lg p-1">
          {(['all', ...assetTypes] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterType === t
                  ? 'bg-[#1a2744] text-white'
                  : 'text-[#5a6a88] hover:text-white'
              }`}
            >
              {t === 'all' ? '전체' : CATEGORY_LABELS[t] ?? t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 bg-[#0a1628] border border-[#1a2744] rounded-lg p-1">
          {([
            { key: 'channel_count' as SortKey, label: '채널수순' },
            { key: 'consensus_score' as SortKey, label: '일치도순' },
            { key: 'total_mentions' as SortKey, label: '언급수순' },
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

      {/* Consensus Cards */}
      {filtered.length === 0 ? (
        <div className="card-dark p-12 text-center">
          <p className="text-[#5a6a88] text-sm">아직 컨센서스 데이터가 없습니다</p>
          <p className="text-[#3a4a6a] text-xs mt-1">예측 채널들이 동일 종목을 언급하면 자동으로 생성됩니다</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(item => (
            <ConsensusCard key={item.asset_code ?? item.asset_name} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function ConsensusCard({ item }: { item: AssetConsensus }) {
  const dominant = item.positive_pct >= item.negative_pct && item.positive_pct >= item.neutral_pct
    ? 'positive'
    : item.negative_pct >= item.positive_pct && item.negative_pct >= item.neutral_pct
      ? 'negative'
      : 'neutral'

  const dominantConfig: Record<string, { label: string; color: string; emoji: string }> = {
    positive: { label: '긍정 우세', color: '#22c997', emoji: '📈' },
    negative: { label: '부정 우세', color: '#ef4444', emoji: '📉' },
    neutral: { label: '중립', color: '#f97316', emoji: '➡️' },
  }
  const dc = dominantConfig[dominant]

  const totalSignals = item.buy_count + item.sell_count + item.hold_count
  const signalDominant = totalSignals > 0
    ? item.buy_count >= item.sell_count && item.buy_count >= item.hold_count
      ? 'buy'
      : item.sell_count >= item.buy_count && item.sell_count >= item.hold_count
        ? 'sell'
        : 'hold'
    : null

  return (
    <div className="card-dark p-5 hover:border-[#2a3a5a] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <Link
            href={item.asset_code ? `/assets/${item.asset_code}` : '#'}
            className="text-base font-bold text-white hover:text-[#00e8b8] transition-colors"
          >
            {item.asset_name}
          </Link>
          {item.asset_code && (
            <span className="ml-2 text-[10px] text-[#5a6a88] font-mono">{item.asset_code}</span>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-[#5a6a88]">
              {item.channel_count}개 채널 · {item.total_mentions}회 언급
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-outfit)', color: dc.color }}>
            {item.consensus_score}%
          </div>
          <div className="text-[10px]" style={{ color: dc.color }}>
            {dc.emoji} {dc.label}
          </div>
        </div>
      </div>

      {/* Sentiment Bar */}
      <div className="mb-3">
        <div className="flex h-2 rounded-full overflow-hidden bg-[#1a2744]">
          {item.positive_pct > 0 && (
            <div className="h-full bg-[#22c997]" style={{ width: `${item.positive_pct}%` }} />
          )}
          {item.neutral_pct > 0 && (
            <div className="h-full bg-[#f97316]" style={{ width: `${item.neutral_pct}%` }} />
          )}
          {item.negative_pct > 0 && (
            <div className="h-full bg-[#ef4444]" style={{ width: `${item.negative_pct}%` }} />
          )}
        </div>
        <div className="flex justify-between mt-1 text-[10px]">
          <span className="text-[#22c997]">긍정 {Math.round(item.positive_pct)}%</span>
          <span className="text-[#f97316]">중립 {Math.round(item.neutral_pct)}%</span>
          <span className="text-[#ef4444]">부정 {Math.round(item.negative_pct)}%</span>
        </div>
      </div>

      {/* Buy/Sell/Hold Signals */}
      {totalSignals > 0 && (
        <div className="mb-3">
          <div className="text-[10px] text-[#5a6a88] mb-1.5 uppercase tracking-wider">예측 시그널</div>
          <div className="flex items-center gap-2">
            <SignalPill type="buy" count={item.buy_count} active={signalDominant === 'buy'} />
            <SignalPill type="sell" count={item.sell_count} active={signalDominant === 'sell'} />
            <SignalPill type="hold" count={item.hold_count} active={signalDominant === 'hold'} />
          </div>
        </div>
      )}

      {/* Channels */}
      {item.channels && item.channels.length > 0 && (
        <div className="pt-3 border-t border-[#1a2744]/50">
          <div className="text-[10px] text-[#5a6a88] mb-1">언급 채널</div>
          <div className="flex flex-wrap gap-1">
            {item.channels.slice(0, 5).map(ch => (
              <span key={ch} className="px-2 py-0.5 rounded-full bg-[#0a1628] border border-[#1a2744] text-[10px] text-[#8a9ab8]">
                {ch}
              </span>
            ))}
            {item.channels.length > 5 && (
              <span className="px-2 py-0.5 text-[10px] text-[#5a6a88]">
                +{item.channels.length - 5}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SignalPill({ type, count, active }: { type: string; count: number; active: boolean }) {
  const config: Record<string, { label: string; color: string }> = {
    buy: { label: '매수', color: '#22c997' },
    sell: { label: '매도', color: '#ef4444' },
    hold: { label: '보유', color: '#f97316' },
  }
  const c = config[type] ?? { label: type, color: '#5a6a88' }

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium ${
        active ? 'border-opacity-60' : 'border-opacity-20 opacity-50'
      }`}
      style={{
        backgroundColor: `${c.color}15`,
        borderColor: c.color,
        color: c.color,
      }}
    >
      {c.label} <span className="font-bold tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>{count}</span>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card-dark p-4">
      <div className="text-[10px] uppercase tracking-wider text-[#5a6a88] mb-1">{label}</div>
      <div className="text-2xl font-bold tabular-nums text-white" style={{ fontFamily: 'var(--font-outfit)', color }}>
        {value}
      </div>
    </div>
  )
}
