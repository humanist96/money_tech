'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import type { HitRateLeaderboardItem } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/types'
import { ChannelTypeBadge } from '@/components/ui/channel-type-badge'

interface PredictionDetail {
  id: string
  prediction_type: string
  reason: string | null
  predicted_at: string | null
  is_accurate: boolean | null
  target_price: number | null
  asset_name: string
  asset_code: string | null
  sentiment: string | null
  context_text: string | null
  price_at_mention: number | null
  video_title: string
  youtube_video_id: string
  video_published_at: string | null
  video_thumbnail: string | null
}

interface Props {
  leaderboard: HitRateLeaderboardItem[]
  typeStats: Array<{ channel_type: string; count: number; avg_pis: number | null; avg_hit_rate: number | null }>
}

type SortKey = 'all_predictions' | 'hit_rate' | 'pis'

export function LeaderboardClient({ leaderboard, typeStats }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>('all_predictions')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, PredictionDetail[]>>({})
  const [loading, setLoading] = useState<string | null>(null)

  const filtered = leaderboard
    .filter(item => filterCategory === 'all' || item.category === filterCategory)
    .sort((a, b) => {
      if (sortBy === 'hit_rate') return (b.hit_rate ?? 0) - (a.hit_rate ?? 0)
      if (sortBy === 'all_predictions') return b.all_predictions - a.all_predictions
      return (b.pis ?? 0) - (a.pis ?? 0)
    })

  const categories = [...new Set(leaderboard.map(l => l.category))]

  const toggleExpand = useCallback(async (channelId: string) => {
    if (expandedId === channelId) {
      setExpandedId(null)
      return
    }
    setExpandedId(channelId)
    if (!details[channelId]) {
      setLoading(channelId)
      try {
        const res = await fetch(`/api/predictions?channelId=${channelId}`)
        const data = await res.json()
        setDetails(prev => ({ ...prev, [channelId]: data }))
      } catch {
        setDetails(prev => ({ ...prev, [channelId]: [] }))
      }
      setLoading(null)
    }
  }, [expandedId, details])

  const totalPredictions = leaderboard.reduce((s, l) => s + l.all_predictions, 0)
  const channelsWithEval = leaderboard.filter(l => l.total_predictions > 0)
  const avgHitRate = channelsWithEval.length > 0
    ? Math.round(channelsWithEval.reduce((s, l) => s + l.hit_rate, 0) / channelsWithEval.length * 100)
    : null

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="예측 채널" value={leaderboard.length} sub="예측 데이터 보유" color="#f97316" />
        <StatCard label="총 예측" value={totalPredictions} sub="건 감지됨" color="#22c997" />
        <StatCard label="평가 완료" value={leaderboard.reduce((s, l) => s + l.total_predictions, 0)} sub="건 적중 검증" color="#7c6cf0" />
        <StatCard label="평균 적중률" value={avgHitRate != null ? `${avgHitRate}%` : '미평가'} sub={channelsWithEval.length > 0 ? `${channelsWithEval.length}개 채널 기준` : '가격 데이터 수집 중'} color="#3b82f6" />
      </div>

      {/* Info Banner */}
      {leaderboard.reduce((s, l) => s + l.total_predictions, 0) === 0 && (
        <div className="bg-[#f97316]/10 border border-[#f97316]/20 rounded-lg px-4 py-3 text-sm text-[#f97316]">
          아직 적중률 평가가 완료된 예측이 없습니다. 예측 후 1주~3개월 경과 시 실제 가격과 비교하여 자동 평가됩니다.
          현재는 <strong>예측 건수</strong> 기준으로 정렬됩니다. 각 행을 클릭하면 근거 영상을 확인할 수 있습니다.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-[#0a1628] border border-[#1a2744] rounded-lg p-1">
          {(['all', ...categories] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterCategory === cat ? 'bg-[#1a2744] text-white' : 'text-[#5a6a88] hover:text-white'
              }`}
            >
              {cat === 'all' ? '전체' : CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 bg-[#0a1628] border border-[#1a2744] rounded-lg p-1">
          {([
            { key: 'all_predictions' as SortKey, label: '예측수순' },
            { key: 'hit_rate' as SortKey, label: '적중률순' },
            { key: 'pis' as SortKey, label: 'PIS순' },
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

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card-dark p-12 text-center">
          <p className="text-[#5a6a88] text-sm">아직 예측 데이터가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item, index) => (
            <div key={item.channel_id}>
              <button
                onClick={() => toggleExpand(item.channel_id)}
                className="w-full card-dark hover:border-[#2a3a5a] transition-all"
              >
                <div className="flex items-center gap-4 px-4 py-3">
                  {/* Rank */}
                  <span className={`text-lg font-bold tabular-nums w-8 text-center ${
                    index < 3 ? ['text-yellow-400', 'text-gray-300', 'text-amber-600'][index] : 'text-[#5a6a88]'
                  }`} style={{ fontFamily: 'var(--font-outfit)' }}>
                    {index + 1}
                  </span>

                  {/* Channel */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {item.channel_thumbnail ? (
                      <img src={item.channel_thumbnail} alt="" className="w-9 h-9 rounded-full border border-[#1a2744] flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#1a2744] flex items-center justify-center text-xs text-[#5a6a88] flex-shrink-0">
                        {item.channel_name[0]}
                      </div>
                    )}
                    <div className="text-left min-w-0">
                      <div className="text-sm font-medium text-white truncate">{item.channel_name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[#5a6a88]">{CATEGORY_LABELS[item.category] ?? item.category}</span>
                        <ChannelTypeBadge type={item.channel_type} />
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-xs text-[#5a6a88]">예측</div>
                      <div className="text-base font-bold tabular-nums text-white" style={{ fontFamily: 'var(--font-outfit)' }}>
                        {item.all_predictions}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[#5a6a88]">적중</div>
                      <div className="text-base font-bold tabular-nums" style={{
                        fontFamily: 'var(--font-outfit)',
                        color: item.total_predictions > 0
                          ? Math.round(item.hit_rate * 100) >= 50 ? '#22c997' : '#ef4444'
                          : '#3a4a6a'
                      }}>
                        {item.total_predictions > 0 ? `${Math.round(item.hit_rate * 100)}%` : '-'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[#5a6a88]">PIS</div>
                      <div className="text-base font-bold tabular-nums" style={{
                        fontFamily: 'var(--font-outfit)',
                        color: (item.pis ?? 0) >= 30 ? '#f97316' : '#5a6a88'
                      }}>
                        {Math.round(item.pis ?? 0)}
                      </div>
                    </div>
                  </div>

                  {/* Expand icon */}
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5a6a88" strokeWidth="2"
                    className={`transition-transform flex-shrink-0 ${expandedId === item.channel_id ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Expanded Detail Panel */}
              {expandedId === item.channel_id && (
                <div className="mt-1 card-dark border-[#1a2744] bg-[#060e1a]">
                  <div className="px-4 py-3 border-b border-[#1a2744]/50">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-[#8a9ab8] uppercase tracking-wider">
                        예측 근거 영상 ({details[item.channel_id]?.length ?? '...'})
                      </h3>
                      <Link href={`/channels/${item.channel_id}`} className="text-[10px] text-[#00e8b8] hover:underline">
                        채널 상세 보기 →
                      </Link>
                    </div>
                  </div>
                  <div className="p-4">
                    {loading === item.channel_id ? (
                      <div className="text-center py-6 text-[#5a6a88] text-sm">로딩 중...</div>
                    ) : (details[item.channel_id] ?? []).length === 0 ? (
                      <div className="text-center py-6 text-[#5a6a88] text-sm">예측 상세 데이터가 없습니다</div>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {(details[item.channel_id] ?? []).map((pred, i) => (
                          <PredictionDetailRow key={pred.id ?? i} pred={pred} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PredictionDetailRow({ pred }: { pred: PredictionDetail }) {
  const typeConfig: Record<string, { label: string; color: string }> = {
    buy: { label: '매수', color: '#22c997' },
    sell: { label: '매도', color: '#ef4444' },
    hold: { label: '보유', color: '#f97316' },
  }
  const tc = typeConfig[pred.prediction_type] ?? { label: pred.prediction_type, color: '#5a6a88' }

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-[#0a1628]/60 border border-[#1a2744]/30">
      {/* Video Thumbnail */}
      <a
        href={`https://youtube.com/watch?v=${pred.youtube_video_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 relative group"
      >
        {pred.video_thumbnail ? (
          <img src={pred.video_thumbnail} alt="" className="w-28 h-16 rounded object-cover border border-[#1a2744]" />
        ) : (
          <div className="w-28 h-16 rounded bg-[#1a2744] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#5a6a88"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
        </div>
      </a>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <a
          href={`https://youtube.com/watch?v=${pred.youtube_video_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-white hover:text-[#00e8b8] transition-colors line-clamp-1"
        >
          {pred.video_title}
        </a>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {/* Asset */}
          <span className="px-2 py-0.5 rounded bg-[#1a2744] text-[11px] text-white font-medium">
            {pred.asset_name}
            {pred.asset_code && <span className="text-[#5a6a88] ml-1">{pred.asset_code}</span>}
          </span>
          {/* Prediction Type */}
          <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{
            backgroundColor: `${tc.color}20`, color: tc.color
          }}>
            {tc.label}
          </span>
          {/* Sentiment */}
          {pred.sentiment && (
            <span className={`text-[10px] ${
              pred.sentiment === 'positive' ? 'text-[#22c997]' :
              pred.sentiment === 'negative' ? 'text-[#ef4444]' : 'text-[#f97316]'
            }`}>
              {pred.sentiment === 'positive' ? '긍정' : pred.sentiment === 'negative' ? '부정' : '중립'}
            </span>
          )}
          {/* Accuracy */}
          {pred.is_accurate === true && <span className="text-[10px] text-[#22c997] font-bold">적중</span>}
          {pred.is_accurate === false && <span className="text-[10px] text-[#ef4444] font-bold">빗나감</span>}
        </div>
        {/* Reason */}
        {pred.reason && (
          <div className="mt-1 text-[11px] text-[#5a6a88] line-clamp-1">
            사유: {pred.reason}
          </div>
        )}
        {/* Date */}
        <div className="mt-1 text-[10px] text-[#3a4a6a]">
          {pred.video_published_at ? new Date(pred.video_published_at).toLocaleDateString('ko-KR') : ''}
          {pred.price_at_mention ? ` · 언급 시 가격: ${pred.price_at_mention.toLocaleString()}원` : ''}
        </div>
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
