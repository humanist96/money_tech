'use client'

import { useState, useCallback } from 'react'
import type { AssetConsensus } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/types'
import { ChannelTypeBadge } from '@/components/ui/channel-type-badge'

interface ReferenceItem {
  channel_name: string
  channel_id: string
  channel_thumbnail: string | null
  channel_type: string
  sentiment: string
  context_text: string | null
  prediction_type: string | null
  reason: string | null
  is_accurate: boolean | null
  video_title: string
  youtube_video_id: string
  published_at: string | null
  video_thumbnail: string | null
}

interface Props {
  consensus: AssetConsensus[]
  predictorCount: number
}

type SortKey = 'consensus_score' | 'channel_count' | 'total_mentions'

export function ConsensusClient({ consensus, predictorCount }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>('channel_count')
  const [filterType, setFilterType] = useState<string>('all')
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null)
  const [references, setReferences] = useState<Record<string, ReferenceItem[]>>({})
  const [loading, setLoading] = useState<string | null>(null)

  const filtered = consensus
    .filter(item => filterType === 'all' || item.asset_type === filterType)
    .sort((a, b) => {
      if (sortBy === 'consensus_score') return b.consensus_score - a.consensus_score
      if (sortBy === 'channel_count') return b.channel_count - a.channel_count
      return b.total_mentions - a.total_mentions
    })

  const assetTypes = [...new Set(consensus.map(c => c.asset_type).filter(Boolean))]

  const toggleExpand = useCallback(async (assetName: string) => {
    if (expandedAsset === assetName) {
      setExpandedAsset(null)
      return
    }
    setExpandedAsset(assetName)
    if (!references[assetName]) {
      setLoading(assetName)
      try {
        const res = await fetch(`/api/predictions?assetName=${encodeURIComponent(assetName)}`)
        const data = await res.json()
        setReferences(prev => ({ ...prev, [assetName]: data }))
      } catch {
        setReferences(prev => ({ ...prev, [assetName]: [] }))
      }
      setLoading(null)
    }
  }, [expandedAsset, references])

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard label="분석 종목" value={consensus.length} color="#22c997" />
        <SummaryCard label="참여 채널" value={new Set(consensus.flatMap(c => c.channels ?? [])).size} color="#f97316" />
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

      {/* Info */}
      <div className="bg-[#22c997]/10 border border-[#22c997]/20 rounded-lg px-4 py-3 text-sm text-[#22c997]">
        종목별로 여러 유튜버의 감성(긍정/부정/중립)과 예측(매수/매도/보유)을 집계합니다.
        각 카드를 클릭하면 <strong>근거가 된 원본 영상</strong>을 채널별로 확인할 수 있습니다.
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-[#0a1628] border border-[#1a2744] rounded-lg p-1">
          {(['all', ...assetTypes] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterType === t ? 'bg-[#1a2744] text-white' : 'text-[#5a6a88] hover:text-white'
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
                sortBy === opt.key ? 'bg-[#1a2744] text-white' : 'text-[#5a6a88] hover:text-white'
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
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(item => (
            <div key={item.asset_code ?? item.asset_name}>
              <ConsensusCard
                item={item}
                expanded={expandedAsset === item.asset_name}
                onToggle={() => toggleExpand(item.asset_name)}
              />
              {expandedAsset === item.asset_name && (
                <ReferencePanel
                  assetName={item.asset_name}
                  refs={references[item.asset_name] ?? []}
                  isLoading={loading === item.asset_name}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ConsensusCard({ item, expanded, onToggle }: {
  item: AssetConsensus
  expanded: boolean
  onToggle: () => void
}) {
  const dominant = item.positive_pct >= item.negative_pct && item.positive_pct >= item.neutral_pct
    ? 'positive'
    : item.negative_pct >= item.positive_pct && item.negative_pct >= item.neutral_pct
      ? 'negative'
      : 'neutral'

  const dominantConfig: Record<string, { label: string; color: string }> = {
    positive: { label: '긍정 우세', color: '#22c997' },
    negative: { label: '부정 우세', color: '#ef4444' },
    neutral: { label: '중립', color: '#f97316' },
  }
  const dc = dominantConfig[dominant]

  const totalSignals = item.buy_count + item.sell_count + item.hold_count

  return (
    <button
      onClick={onToggle}
      className={`w-full card-dark p-5 text-left transition-all ${expanded ? 'border-[#2a3a5a]' : 'hover:border-[#2a3a5a]'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white">{item.asset_name}</span>
            {item.asset_code && <span className="text-[10px] text-[#5a6a88] font-mono">{item.asset_code}</span>}
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a6a88" strokeWidth="2"
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <div className="text-[10px] text-[#5a6a88] mt-0.5">
            {item.channel_count}개 채널 · {item.total_mentions}회 언급
          </div>

          {/* Sentiment Bar */}
          <div className="mt-3 max-w-md">
            <div className="flex h-2 rounded-full overflow-hidden bg-[#1a2744]">
              {item.positive_pct > 0 && <div className="h-full bg-[#22c997]" style={{ width: `${item.positive_pct}%` }} />}
              {item.neutral_pct > 0 && <div className="h-full bg-[#f97316]" style={{ width: `${item.neutral_pct}%` }} />}
              {item.negative_pct > 0 && <div className="h-full bg-[#ef4444]" style={{ width: `${item.negative_pct}%` }} />}
            </div>
            <div className="flex gap-4 mt-1 text-[10px]">
              <span className="text-[#22c997]">긍정 {Math.round(item.positive_pct)}%</span>
              <span className="text-[#f97316]">중립 {Math.round(item.neutral_pct)}%</span>
              <span className="text-[#ef4444]">부정 {Math.round(item.negative_pct)}%</span>
            </div>
          </div>

          {/* Signals + Channels inline */}
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {totalSignals > 0 && (
              <div className="flex items-center gap-1.5">
                {item.buy_count > 0 && <MiniPill label="매수" count={item.buy_count} color="#22c997" />}
                {item.sell_count > 0 && <MiniPill label="매도" count={item.sell_count} color="#ef4444" />}
                {item.hold_count > 0 && <MiniPill label="보유" count={item.hold_count} color="#f97316" />}
              </div>
            )}
            {item.channels && item.channels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.channels.slice(0, 4).map(ch => (
                  <span key={ch} className="px-1.5 py-0.5 rounded bg-[#0a1628] border border-[#1a2744] text-[9px] text-[#8a9ab8]">{ch}</span>
                ))}
                {item.channels.length > 4 && <span className="text-[9px] text-[#5a6a88]">+{item.channels.length - 4}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Score */}
        <div className="text-right flex-shrink-0">
          <div className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-outfit)', color: dc.color }}>
            {item.consensus_score}%
          </div>
          <div className="text-[10px]" style={{ color: dc.color }}>{dc.label}</div>
        </div>
      </div>
    </button>
  )
}

function ReferencePanel({ assetName, refs, isLoading }: {
  assetName: string
  refs: ReferenceItem[]
  isLoading: boolean
}) {
  if (isLoading) {
    return <div className="card-dark bg-[#060e1a] p-6 mt-1 text-center text-[#5a6a88] text-sm">근거 영상 로딩 중...</div>
  }

  if (refs.length === 0) {
    return <div className="card-dark bg-[#060e1a] p-6 mt-1 text-center text-[#5a6a88] text-sm">상세 데이터가 없습니다</div>
  }

  // Group by channel
  const byChannel = new Map<string, ReferenceItem[]>()
  for (const r of refs) {
    const list = byChannel.get(r.channel_name) ?? []
    list.push(r)
    byChannel.set(r.channel_name, list)
  }

  return (
    <div className="card-dark bg-[#060e1a] mt-1 overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1a2744]/50">
        <h3 className="text-xs font-semibold text-[#8a9ab8] uppercase tracking-wider">
          근거 영상 ({refs.length}건 / {byChannel.size}개 채널)
        </h3>
      </div>
      <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
        {Array.from(byChannel.entries()).map(([channelName, items]) => (
          <div key={channelName}>
            <div className="flex items-center gap-2 mb-2">
              {items[0].channel_thumbnail && (
                <img src={items[0].channel_thumbnail} alt="" className="w-5 h-5 rounded-full" />
              )}
              <span className="text-xs font-medium text-white">{channelName}</span>
              <ChannelTypeBadge type={items[0].channel_type as any} />
              <span className="text-[10px] text-[#5a6a88]">{items.length}건</span>
            </div>
            <div className="space-y-2 ml-7">
              {items.map((item, i) => (
                <VideoRefRow key={`${item.youtube_video_id}-${i}`} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function VideoRefRow({ item }: { item: ReferenceItem }) {
  const sentimentColor = item.sentiment === 'positive' ? '#22c997' : item.sentiment === 'negative' ? '#ef4444' : '#f97316'
  const sentimentLabel = item.sentiment === 'positive' ? '긍정' : item.sentiment === 'negative' ? '부정' : '중립'
  const predConfig: Record<string, { label: string; color: string }> = {
    buy: { label: '매수', color: '#22c997' },
    sell: { label: '매도', color: '#ef4444' },
    hold: { label: '보유', color: '#f97316' },
  }

  return (
    <div className="flex gap-3 p-2.5 rounded-lg bg-[#0a1628]/40 border border-[#1a2744]/20">
      <a
        href={`https://youtube.com/watch?v=${item.youtube_video_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 relative group"
      >
        <img
          src={item.video_thumbnail || `https://i.ytimg.com/vi/${item.youtube_video_id}/mqdefault.jpg`}
          alt=""
          className="w-24 h-14 rounded object-cover border border-[#1a2744]"
        />
        <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
        </div>
      </a>
      <div className="flex-1 min-w-0">
        <a
          href={`https://youtube.com/watch?v=${item.youtube_video_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white hover:text-[#00e8b8] transition-colors line-clamp-1"
        >
          {item.video_title}
        </a>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <span className="text-[10px] font-medium" style={{ color: sentimentColor }}>{sentimentLabel}</span>
          {item.prediction_type && predConfig[item.prediction_type] && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{
              backgroundColor: `${predConfig[item.prediction_type].color}20`,
              color: predConfig[item.prediction_type].color
            }}>
              {predConfig[item.prediction_type].label}
            </span>
          )}
          {item.reason && <span className="text-[9px] text-[#5a6a88] truncate max-w-[200px]">"{item.reason}"</span>}
        </div>
        <div className="text-[9px] text-[#3a4a6a] mt-0.5">
          {item.published_at ? new Date(item.published_at).toLocaleDateString('ko-KR') : ''}
        </div>
      </div>
    </div>
  )
}

function MiniPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ backgroundColor: `${color}15`, color }}
    >
      {label} <span className="font-bold tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>{count}</span>
    </span>
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
