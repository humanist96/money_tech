'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import type { HitRateLeaderboardItem, SkillGrade } from '@/lib/types'
import { MIN_SAMPLE_FOR_RANKING } from '@/lib/queries/predictions'
import { CATEGORY_LABELS } from '@/lib/types'
import { ChannelTypeBadge } from '@/components/ui/channel-type-badge'

interface PredictionEvaluation {
  horizon: string
  outcome: string
  eval_date: string | null
  price_t0: number | null
  price_th: number | null
  asset_return: number | null
  benchmark_code: string | null
  benchmark_return: number | null
  excess_return: number | null
  unevaluable_reason: string | null
}

interface PredictionDetail {
  id: string
  prediction_type: string
  reason: string | null
  predicted_at: string | null
  target_price: number | null
  is_duplicate: boolean
  evaluation_status: string | null
  evaluations: PredictionEvaluation[]
  asset_name: string
  asset_code: string | null
  sentiment: string | null
  context_text: string | null
  price_at_mention: number | null
  video_title: string
  youtube_video_id: string | null
  blog_post_url: string | null
  video_published_at: string | null
  video_thumbnail: string | null
}

interface Props {
  leaderboard: HitRateLeaderboardItem[]
  typeStats: Array<{ channel_type: string; count: number; avg_pis: number | null; avg_hit_rate: number | null }>
}

type SortKey = 'all_predictions' | 'hit_rate' | 'pis'


const GRADE_LABELS: Record<SkillGrade, { label: string; color: string; hint: string }> = {
  beats_market: { label: '시장보다 잘 맞힘', color: '#22c997', hint: '신뢰구간 전체가 50%를 넘습니다' },
  market_level: { label: '시장 수준', color: '#5a6a88', hint: '우연과 구분되지 않는 범위입니다' },
  below_market: { label: '시장보다 못 맞힘', color: '#ef4444', hint: '신뢰구간 전체가 50% 아래입니다' },
  insufficient: { label: '평가 유보', color: '#3a4a6a', hint: `표본 ${MIN_SAMPLE_FOR_RANKING}건 미만` },
}

/** 리더보드 배지의 공통 껍데기. 색만 받고 나머지는 한 곳에서 관리한다. */
function Pill({ color, title, children }: { color: string; title?: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ background: `${color}1a`, color }}
      title={title}
    >
      {children}
    </span>
  )
}

/** 이 위로는 표본이 충분해 표시하지 않는다. */
const LOW_SAMPLE_CEILING = 30

/** Shows the interval, not just the point estimate: width is the uncertainty. */
function ConfidenceBar({ low, high, point }: { low: number | null; high: number | null; point: number | null }) {
  if (low == null || high == null || point == null) {
    return <div className="h-1.5 rounded bg-th-tertiary" />
  }
  const pct = (v: number) => `${Math.max(0, Math.min(100, v * 100))}%`
  return (
    <div className="relative h-1.5 rounded bg-th-tertiary overflow-hidden" title={`95% 신뢰구간 ${Math.round(low * 100)}~${Math.round(high * 100)}%`}>
      <div className="absolute inset-y-0 left-1/2 w-px bg-th-border" />
      <div
        className="absolute inset-y-0 rounded"
        style={{ left: pct(low), width: pct(high - low), background: low > 0.5 ? '#22c997' : high < 0.5 ? '#ef4444' : '#5a6a88' }}
      />
      <div className="absolute inset-y-0 w-0.5 bg-th-primary" style={{ left: pct(point) }} />
    </div>
  )
}

function GradeBadge({ grade }: { grade: SkillGrade }) {
  const g = GRADE_LABELS[grade]
  return <Pill color={g.color} title={g.hint}>{g.label}</Pill>
}

/**
 * 표본이 랭킹 문턱을 갓 넘긴 구간(10 <= n < 30)을 표시한다. Wilson 하한이
 * 50%를 넘겨 "시장보다 잘 맞힘"으로 분류되더라도 n=11에서의 그 판정과
 * n=76에서의 판정은 무게가 다르다 — 등급만 보고 같게 읽히는 것을 막는다
 * (계획 3.5).
 */
function SampleBadge({ n }: { n: number }) {
  if (n >= LOW_SAMPLE_CEILING || n < MIN_SAMPLE_FOR_RANKING) return null
  return (
    <Pill color="#f59e0b" title={`평가 표본 ${n}건. ${LOW_SAMPLE_CEILING}건 미만이라 순위가 쉽게 흔들립니다.`}>
      표본 적음 {n}건
    </Pill>
  )
}

/**
 * BTC는 벤치마크 없이 절대수익으로 판정되므로, BTC 비중이 높은 채널의 적중률은
 * 다른 채널과 척도가 다르다. 20% 이상일 때 배지로 가시화한다 (계획 §3.2).
 */
function BtcShareBadge({ share }: { share: number | null }) {
  if (share == null || share < 0.2) return null
  return (
    <Pill color="#f7931a" title="이 채널 예측 중 BTC 비율입니다. BTC는 벤치마크 없이 절대수익으로 판정되어 다른 예측과 척도가 다릅니다.">
      BTC {Math.round(share * 100)}%
    </Pill>
  )
}

export function LeaderboardClient({ leaderboard, typeStats }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>('all_predictions')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, PredictionDetail[]>>({})
  const [loading, setLoading] = useState<string | null>(null)

  const filtered = leaderboard
    .filter(item => filterCategory === 'all' || item.category === filterCategory)
    .sort((a, b) => {
      if (sortBy === 'hit_rate') return (Number(b.wilson_low) || 0) - (Number(a.wilson_low) || 0)
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
  const totalEvaluated = leaderboard.reduce((s, l) => s + l.n_effective, 0)
  const ranked = leaderboard.filter(l => l.grade !== 'insufficient')
  // Pooled, not an average of per-channel rates: channels with three calls
  // should not weigh as much as channels with three hundred.
  const pooledHits = ranked.reduce((s, l) => s + l.n_hits, 0)
  const pooledN = ranked.reduce((s, l) => s + l.n_effective, 0)
  const avgHitRate = pooledN > 0 ? Math.round((pooledHits / pooledN) * 100) : null
  const beatsMarket = leaderboard.filter(l => l.grade === 'beats_market').length

  // The methodology change invalidated every previously published figure, and
  // re-scoring runs as price history loads. Saying so is better than showing a
  // half-filled board with no explanation.
  const rebuilding = leaderboard.length > 0 && ranked.length / leaderboard.length < 0.3

  return (
    <div className="space-y-6">
      {rebuilding && (
        <div className="rounded-xl border border-[#ffb84d]/30 bg-[#ffb84d]/5 px-4 py-3 text-xs text-th-secondary">
          <span className="font-semibold text-[#ffb84d]">재검증 중</span>
          {' · '}
          적중률 산정 기준을 <strong>벤치마크 대비 초과수익</strong>으로 바꾸면서 과거 수치를 전부 무효화하고 다시 계산하고 있습니다.
          가격 이력이 채워지는 대로 평가가 완료되며, 표본 {MIN_SAMPLE_FOR_RANKING}건을 넘긴 채널부터 순위에 반영됩니다
          (현재 {ranked.length}/{leaderboard.length}개 채널).
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="예측 채널" value={leaderboard.length} sub="예측 데이터 보유" color="#f97316" />
        <StatCard label="총 예측" value={totalPredictions} sub="건 감지됨" color="#22c997" />
        <StatCard label="평가 완료" value={totalEvaluated} sub="건 (중복·판정보류 제외)" color="#7c6cf0" />
        <StatCard label="시장 대비 적중률" value={avgHitRate != null ? `${avgHitRate}%` : '평가중'} sub={ranked.length > 0 ? `${beatsMarket}개 채널이 시장 상회` : `표본 ${MIN_SAMPLE_FOR_RANKING}건 이상 채널 없음`} color="#3b82f6" />
      </div>

      {/* Info Banner - evaluation methodology */}
      <div className="info-banner space-y-1">
        <div className="font-semibold text-th-primary text-sm mb-1">평가 방법론</div>
        <div className="flex items-start gap-2">
          <span className="text-[#3b82f6] font-bold shrink-0">A. 적중 판정</span>
          <span>
            발행일 종가와 1주/1개월/3개월 후 종가를 비교하되, <strong>KOSPI·KOSDAQ(코인은 BTC) 대비 초과수익</strong>으로 판정합니다.
            시장 전체가 오른 만큼은 실력이 아니기 때문입니다. 거래비용 밴드(1주 ±1.5%, 1개월 ±2.5%, 3개월 ±4%) 안의 움직임은
            적중도 실패도 아닌 &lsquo;판정 보류&rsquo;로 표본에서 제외합니다.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[#22c997] font-bold shrink-0">B. 신뢰구간</span>
          <span>
            적중률 옆 괄호는 95% 신뢰구간(Wilson)입니다. 순위는 점추정치가 아니라 구간의 <strong>하한</strong>으로 매깁니다.
            운 좋은 5건이 꾸준한 50건을 앞지르지 않게 하기 위함입니다. 같은 채널이 30일 내 같은 종목에 반복한 콜은 1건으로 셉니다.
          </span>
        </div>
        <div className="text-th-dim mt-1">각 행을 클릭하면 예측 근거 영상과 판정 내역을 확인할 수 있습니다.</div>
        <div className="flex items-start gap-2 mt-2 pt-2 border-t border-th-border/50">
          <span className="text-[#f97316] font-bold shrink-0">C. PIS (Prediction Intensity Score)</span>
          <span>채널의 예측 적극성을 0~100으로 수치화. 5가지 지표 가중합산: 예측밀도(30%) + 액션키워드강도(25%) + 종목집중도(20%) + 목표가제시율(15%) + 감성편향도(10%). 높을수록 명확한 매매 의견을 자주 제시하는 채널</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="filter-group flex items-center gap-1.5">
          {(['all', ...categories] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`filter-btn ${filterCategory === cat ? 'active' : ''}`}
            >
              {cat === 'all' ? '전체' : CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
        <div className="filter-group flex items-center gap-1.5">
          {([
            { key: 'all_predictions' as SortKey, label: '예측수순' },
            { key: 'hit_rate' as SortKey, label: '신뢰하한순' },
            { key: 'pis' as SortKey, label: 'PIS순' },
          ]).map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`filter-btn ${sortBy === opt.key ? 'active' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card-dark p-12 text-center">
          <p className="text-th-dim text-sm">아직 예측 데이터가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item, index) => (
            <div key={item.channel_id}>
              <button
                onClick={() => toggleExpand(item.channel_id)}
                className="w-full card-dark hover:border-th-strong transition-all"
              >
                <div className="flex items-center gap-4 px-4 py-3">
                  {/* Rank */}
                  <span className={`text-lg font-bold tabular-nums w-8 text-center ${
                    index < 3 ? ['text-yellow-400', 'text-gray-300', 'text-amber-600'][index] : 'text-th-dim'
                  }`} style={{ fontFamily: 'var(--font-outfit)' }}>
                    {index + 1}
                  </span>

                  {/* Channel */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {item.channel_thumbnail ? (
                      <img src={item.channel_thumbnail} alt="" className="w-9 h-9 rounded-full border border-th-border flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-th-tertiary flex items-center justify-center text-xs text-th-dim flex-shrink-0">
                        {item.channel_name[0]}
                      </div>
                    )}
                    <div className="text-left min-w-0">
                      <div className="text-sm font-medium text-th-primary truncate">{item.channel_name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-th-dim">{CATEGORY_LABELS[item.category] ?? item.category}</span>
                        <ChannelTypeBadge type={item.channel_type} />
                        <GradeBadge grade={item.grade} />
                        <SampleBadge n={item.n_effective} />
                        <BtcShareBadge share={item.btc_share} />
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-5">
                    <div className="text-right w-12">
                      <div className="text-[10px] text-th-dim">예측</div>
                      <div className="text-base font-bold tabular-nums text-th-primary" style={{ fontFamily: 'var(--font-outfit)' }}>
                        {item.all_predictions}
                      </div>
                    </div>
                    <div className="text-right w-36">
                      <div className="text-[10px] text-th-dim">
                        적중률 · 평가 {item.n_effective}건
                      </div>
                      <div className="text-base font-bold tabular-nums" style={{
                        fontFamily: 'var(--font-outfit)',
                        color: GRADE_LABELS[item.grade].color,
                      }}>
                        {item.hit_rate != null ? `${Math.round(item.hit_rate * 100)}%` : '-'}
                        {item.wilson_low != null && item.wilson_high != null && (
                          <span className="ml-1 text-[10px] font-normal text-th-dim">
                            ({Math.round(item.wilson_low * 100)}~{Math.round(item.wilson_high * 100)}%)
                          </span>
                        )}
                      </div>
                      <div className="mt-1">
                        <ConfidenceBar low={item.wilson_low} high={item.wilson_high} point={item.hit_rate} />
                      </div>
                    </div>
                    <div className="text-right w-16">
                      <div className="text-[10px] text-th-dim">초과수익</div>
                      <div className="text-sm font-bold tabular-nums" style={{
                        fontFamily: 'var(--font-outfit)',
                        color: (item.avg_excess_return ?? 0) > 0 ? '#22c997' : (item.avg_excess_return ?? 0) < 0 ? '#ef4444' : '#5a6a88',
                      }}>
                        {item.avg_excess_return != null
                          ? `${item.avg_excess_return >= 0 ? '+' : ''}${(item.avg_excess_return * 100).toFixed(1)}%p`
                          : '-'}
                      </div>
                    </div>
                    <div className="text-right w-10">
                      <div className="text-[10px] text-th-dim">PIS</div>
                      <div className="text-sm font-bold tabular-nums" style={{
                        fontFamily: 'var(--font-outfit)',
                        color: (item.pis ?? 0) >= 30 ? '#f97316' : '#5a6a88'
                      }}>
                        {Math.round(item.pis ?? 0)}
                      </div>
                    </div>
                  </div>

                  {/* Expand icon */}
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`transition-transform flex-shrink-0 text-th-dim ${expandedId === item.channel_id ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Expanded Detail Panel */}
              {expandedId === item.channel_id && (
                <div className="mt-1 expand-panel">
                  <div className="px-4 py-3 expand-panel-header">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-th-muted uppercase tracking-wider">
                        예측 근거 영상 ({details[item.channel_id]?.length ?? '...'})
                      </h3>
                      <Link href={`/channels/${item.channel_id}`} className="text-[10px] text-th-accent hover:underline">
                        채널 상세 보기 →
                      </Link>
                    </div>
                  </div>
                  <div className="p-4">
                    {loading === item.channel_id ? (
                      <div className="text-center py-6 text-th-dim text-sm">로딩 중...</div>
                    ) : (details[item.channel_id] ?? []).length === 0 ? (
                      <div className="text-center py-6 text-th-dim text-sm">예측 상세 데이터가 없습니다</div>
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

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  hit: { label: '적중', color: '#22c997' },
  miss: { label: '빗나감', color: '#ef4444' },
  push: { label: '판정보류', color: '#5a6a88' },
  unevaluable: { label: '평가불가', color: '#3a4a6a' },
}

const HORIZON_LABELS: Record<string, string> = { '1w': '1주', '1m': '1개월', '3m': '3개월' }

const pct = (v: number | null) =>
  v == null ? '-' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`

/**
 * Shows how each verdict was reached — base price, later price, benchmark and
 * the resulting excess. A rating nobody can audit is just an assertion.
 */
function EvaluationEvidence({ evaluations }: { evaluations: PredictionEvaluation[] }) {
  if (!evaluations.length) {
    return <div className="mt-1.5 text-[10px] text-th-dim opacity-70">아직 평가 시점이 도래하지 않았습니다</div>
  }

  return (
    <div className="mt-2 rounded border border-th-border/50 overflow-hidden">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-th-dim">
            <th className="text-left py-1 px-2 font-medium">구간</th>
            <th className="text-right py-1 px-1 font-medium">발행일가</th>
            <th className="text-right py-1 px-1 font-medium">평가일가</th>
            <th className="text-right py-1 px-1 font-medium">종목</th>
            <th className="text-right py-1 px-1 font-medium">시장</th>
            <th className="text-right py-1 px-1 font-medium">초과</th>
            <th className="text-right py-1 px-2 font-medium">판정</th>
          </tr>
        </thead>
        <tbody>
          {evaluations.map((e) => {
            const oc = OUTCOME_LABELS[e.outcome] ?? { label: e.outcome, color: '#5a6a88' }
            return (
              <tr key={e.horizon} className="border-t border-th-border/30">
                <td className="py-1 px-2 text-th-primary">{HORIZON_LABELS[e.horizon] ?? e.horizon}</td>
                <td className="py-1 px-1 text-right tabular-nums text-th-dim">
                  {e.price_t0 != null ? e.price_t0.toLocaleString() : '-'}
                </td>
                <td className="py-1 px-1 text-right tabular-nums text-th-dim">
                  {e.price_th != null ? e.price_th.toLocaleString() : '-'}
                </td>
                <td className="py-1 px-1 text-right tabular-nums">{pct(e.asset_return)}</td>
                <td className="py-1 px-1 text-right tabular-nums text-th-dim" title={e.benchmark_code ?? '절대수익 기준'}>
                  {pct(e.benchmark_return)}
                </td>
                <td className="py-1 px-1 text-right tabular-nums font-medium" style={{
                  color: (e.excess_return ?? 0) > 0 ? '#22c997' : (e.excess_return ?? 0) < 0 ? '#ef4444' : '#5a6a88',
                }}>
                  {pct(e.excess_return)}
                </td>
                <td className="py-1 px-2 text-right font-bold" style={{ color: oc.color }} title={e.unevaluable_reason ?? undefined}>
                  {oc.label}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
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

  const postUrl = pred.blog_post_url || (pred.youtube_video_id ? `https://youtube.com/watch?v=${pred.youtube_video_id}` : '#')

  return (
    <div className="expand-row flex gap-3">
      {/* Thumbnail */}
      <a
        href={postUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 relative group"
      >
        {pred.blog_post_url ? (
          <div className="w-28 h-16 rounded flex items-center justify-center border border-th-border" style={{ background: 'color-mix(in srgb, #03c75a 8%, var(--th-bg-card))' }}>
            <span className="text-[10px] font-bold text-[#03c75a]">BLOG</span>
          </div>
        ) : (
          <>
            <img
              src={pred.video_thumbnail || `https://i.ytimg.com/vi/${pred.youtube_video_id}/mqdefault.jpg`}
              alt=""
              className="w-28 h-16 rounded object-cover border border-th-border"
            />
            <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            </div>
          </>
        )}
      </a>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <a
          href={postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-th-primary hover:text-th-accent transition-colors line-clamp-1"
        >
          {pred.video_title}
        </a>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {/* Asset */}
          <span className="tag">
            {pred.asset_name}
            {pred.asset_code && <span className="tag-dim">{pred.asset_code}</span>}
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
          {pred.is_duplicate && (
            <span className="text-[10px] text-th-dim" title="30일 내 같은 종목·방향 반복 콜은 표본에서 1건으로 셉니다">
              반복 콜 (표본 제외)
            </span>
          )}
        </div>
        {/* Reason */}
        {pred.reason && (
          <div className="mt-1 text-[11px] text-th-dim line-clamp-1">
            사유: {pred.reason}
          </div>
        )}

        <EvaluationEvidence evaluations={pred.evaluations ?? []} />
        {/* Per-horizon returns now live in the evidence table above. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px]">
          <span className="text-th-dim opacity-70">
            {pred.video_published_at ? new Date(pred.video_published_at).toLocaleDateString('ko-KR') : ''}
          </span>
          {pred.target_price != null && (
            <span className="text-th-dim">목표가: {pred.target_price.toLocaleString()}원</span>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub: string; color: string }) {
  return (
    <div className="stat-card">
      <div className="text-[10px] uppercase tracking-wider text-th-dim mb-1">{label}</div>
      <div className="text-2xl font-bold tabular-nums text-th-primary" style={{ fontFamily: 'var(--font-outfit)', color }}>
        {value}
      </div>
      <div className="text-[10px] text-th-dim opacity-70 mt-0.5">{sub}</div>
    </div>
  )
}
