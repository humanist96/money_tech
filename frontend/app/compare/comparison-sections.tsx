"use client"

import { useMemo } from "react"
import Link from "next/link"
import type { Channel } from "@/lib/types"
import { CATEGORY_COLORS } from "@/lib/types"
import { formatViewCount } from "@/lib/queries"
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Legend,
} from "recharts"

interface Props {
  data: any
  selected: Channel[]
  category: string
}

const COLORS = ["#00e8b8", "#7c6cf0", "#ff5757"]
const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c997",
  negative: "#ff5757",
  neutral: "#64748b",
}
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"]

export function ComparisonSections({ data, selected, category }: Props) {
  const channelMap = useMemo(() => {
    const map = new Map<string, Channel>()
    for (const ch of selected) map.set(ch.id, ch)
    return map
  }, [selected])

  const colorMap = useMemo(() => {
    const map = new Map<string, string>()
    selected.forEach((ch, i) => map.set(ch.id, COLORS[i % COLORS.length]))
    return map
  }, [selected])

  return (
    <div className="space-y-6">
      <ScoreCard data={data} selected={selected} colorMap={colorMap} />
      <BullBearProfile data={data} selected={selected} colorMap={colorMap} />
      <SentimentFaceoff data={data} selected={selected} colorMap={colorMap} channelMap={channelMap} />
      <AssetCoverage data={data} selected={selected} colorMap={colorMap} channelMap={channelMap} />
      <EngagementRate data={data} selected={selected} colorMap={colorMap} />
      <MentionDensity data={data} selected={selected} colorMap={colorMap} />
      <UploadPattern data={data} selected={selected} colorMap={colorMap} />
      <TopVideos data={data} selected={selected} colorMap={colorMap} />
      <ReactionSpeed data={data} selected={selected} colorMap={colorMap} channelMap={channelMap} />
      <ProfileRadarOverlay data={data} selected={selected} colorMap={colorMap} />
    </div>
  )
}

/* ─── #10 Scorecard Summary ─── */
function ScoreCard({ data, selected, colorMap }: { data: any; selected: Channel[]; colorMap: Map<string, string> }) {
  const metrics = useMemo(() => {
    return selected.map((ch) => {
      const eng = (data.engagement as any[]).find((e: any) => e.channel_id === ch.id)
      const prof = (data.profiles as any[]).find((p: any) => p.channel_id === ch.id)
      const preds = (data.predictions as any[]).filter((p: any) => p.channel_id === ch.id)
      const assets = (data.assetCoverage as any[]).filter((a: any) => a.channel_id === ch.id)

      const buyCount = preds.find((p: any) => p.prediction_type === "buy")?.count ?? 0
      const sellCount = preds.find((p: any) => p.prediction_type === "sell")?.count ?? 0
      const holdCount = preds.find((p: any) => p.prediction_type === "hold")?.count ?? 0
      const totalPred = buyCount + sellCount + holdCount

      const engRate = ch.subscriber_count && eng?.avg_views
        ? (eng.avg_views / ch.subscriber_count) * 100
        : 0

      return {
        id: ch.id,
        name: ch.name,
        subscribers: ch.subscriber_count ?? 0,
        totalVideos: eng?.total_videos ?? 0,
        avgViews: eng?.avg_views ?? 0,
        engagementRate: engRate,
        uniqueAssets: assets.length,
        totalMentions: prof?.total_mentions ?? 0,
        mentionDensity: eng?.total_videos ? (prof?.total_mentions ?? 0) / eng.total_videos : 0,
        bullRatio: totalPred > 0 ? (buyCount / totalPred) * 100 : 0,
        totalPredictions: totalPred,
        positiveRatio: prof?.total_mentions
          ? ((prof.positive_count ?? 0) / prof.total_mentions) * 100
          : 0,
      }
    })
  }, [data, selected])

  const scoreDimensions = [
    { label: "구독자", key: "subscribers" as const, higherBetter: true },
    { label: "참여율", key: "engagementRate" as const, higherBetter: true },
    { label: "종목 다양성", key: "uniqueAssets" as const, higherBetter: true },
    { label: "멘션 밀도", key: "mentionDensity" as const, higherBetter: true },
    { label: "평균 조회수", key: "avgViews" as const, higherBetter: true },
    { label: "예측 수", key: "totalPredictions" as const, higherBetter: true },
  ]

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: "var(--font-outfit)" }}>
          종합 스코어카드
        </h3>
        <p className="text-[10px] text-th-dim mt-0.5">주요 지표별 우위 비교</p>
      </div>
      <div className="p-4">
        {/* Channel headers */}
        <div className={`grid gap-3 mb-4 ${selected.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {selected.map((ch, i) => (
            <div key={ch.id} className="text-center">
              <div
                className="w-10 h-10 rounded-full mx-auto mb-1.5 flex items-center justify-center text-sm font-bold"
                style={{
                  background: `color-mix(in srgb, ${COLORS[i]} 20%, var(--th-bg-card-deep))`,
                  border: `2px solid ${COLORS[i]}`,
                  color: COLORS[i],
                }}
              >
                {ch.thumbnail_url ? (
                  <img src={ch.thumbnail_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : ch.name[0]}
              </div>
              <span className="text-xs font-semibold text-th-primary">{ch.name}</span>
            </div>
          ))}
        </div>

        {/* Score rows */}
        <div className="space-y-2">
          {scoreDimensions.map((dim) => {
            const values = metrics.map((m) => (m as any)[dim.key] as number)
            const best = dim.higherBetter ? Math.max(...values) : Math.min(...values)
            const maxVal = Math.max(...values, 1)

            return (
              <div key={dim.label} className="glass-card rounded-lg p-3">
                <div className="text-[10px] text-th-dim mb-2 uppercase tracking-wider">{dim.label}</div>
                <div className={`grid gap-2 ${selected.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                  {metrics.map((m, i) => {
                    const val = (m as any)[dim.key] as number
                    const isWinner = val === best && val > 0
                    return (
                      <div key={m.id} className="relative">
                        <div className="h-6 bg-th-card rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${(val / maxVal) * 100}%`,
                              background: isWinner
                                ? COLORS[i]
                                : `color-mix(in srgb, ${COLORS[i]} 40%, transparent)`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] tabular-nums" style={{ color: COLORS[i], fontFamily: "var(--font-outfit)" }}>
                            {dim.key === "engagementRate"
                              ? `${val.toFixed(1)}%`
                              : dim.key === "mentionDensity"
                                ? val.toFixed(2)
                                : formatViewCount(Math.round(val))}
                          </span>
                          {isWinner && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#22c997]/15 text-[#22c997] font-bold">
                              WIN
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Win count summary */}
        <div className={`grid gap-3 mt-4 ${selected.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {metrics.map((m, i) => {
            const wins = scoreDimensions.filter((dim) => {
              const values = metrics.map((mm) => (mm as any)[dim.key] as number)
              const best = dim.higherBetter ? Math.max(...values) : Math.min(...values)
              return (m as any)[dim.key] === best && best > 0
            }).length
            return (
              <div key={m.id} className="text-center py-2 rounded-lg" style={{ background: `color-mix(in srgb, ${COLORS[i]} 10%, transparent)` }}>
                <span className="text-xl font-extrabold tabular-nums" style={{ color: COLORS[i], fontFamily: "var(--font-outfit)" }}>
                  {wins}
                </span>
                <span className="text-[10px] text-th-dim block">/ {scoreDimensions.length} 항목 우위</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── #5 Bull vs Bear Profile ─── */
function BullBearProfile({ data, selected, colorMap }: { data: any; selected: Channel[]; colorMap: Map<string, string> }) {
  const predData = useMemo(() => {
    return selected.map((ch) => {
      const preds = (data.predictions as any[]).filter((p: any) => p.channel_id === ch.id)
      const buy = preds.find((p: any) => p.prediction_type === "buy")?.count ?? 0
      const sell = preds.find((p: any) => p.prediction_type === "sell")?.count ?? 0
      const hold = preds.find((p: any) => p.prediction_type === "hold")?.count ?? 0
      const total = buy + sell + hold
      return { ...ch, buy, sell, hold, total }
    })
  }, [data, selected])

  const hasPredictions = predData.some((p) => p.total > 0)

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: "var(--font-outfit)" }}>
          매수/매도 성향 비교
        </h3>
        <p className="text-[10px] text-th-dim mt-0.5">채널별 예측 유형 분포</p>
      </div>
      <div className="p-5 space-y-4">
        {!hasPredictions ? (
          <p className="text-sm text-th-dim text-center py-4">선택한 채널에 예측 데이터가 없습니다</p>
        ) : (
          predData.map((ch, i) => {
            const buyPct = ch.total > 0 ? (ch.buy / ch.total) * 100 : 0
            const sellPct = ch.total > 0 ? (ch.sell / ch.total) * 100 : 0
            const holdPct = ch.total > 0 ? (ch.hold / ch.total) * 100 : 0
            const label = buyPct > sellPct && buyPct > holdPct ? "공격적"
              : sellPct > buyPct && sellPct > holdPct ? "방어적"
              : holdPct > 0 ? "균형적" : "-"
            const labelColor = label === "공격적" ? "#22c997" : label === "방어적" ? "#ff5757" : "#ffb84d"

            return (
              <div key={ch.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                    <span className="text-xs font-medium text-th-primary">{ch.name}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{
                      background: `color-mix(in srgb, ${labelColor} 15%, transparent)`, color: labelColor
                    }}>
                      {label}
                    </span>
                  </div>
                  <span className="text-[10px] text-th-dim tabular-nums">{ch.total}건</span>
                </div>
                {ch.total > 0 ? (
                  <div className="h-7 rounded-lg overflow-hidden flex bg-th-card">
                    {buyPct > 0 && (
                      <div className="h-full flex items-center justify-center text-[9px] font-bold text-white/80"
                        style={{ width: `${buyPct}%`, background: "#22c997" }}>
                        {buyPct >= 12 && `매수 ${Math.round(buyPct)}%`}
                      </div>
                    )}
                    {sellPct > 0 && (
                      <div className="h-full flex items-center justify-center text-[9px] font-bold text-white/80"
                        style={{ width: `${sellPct}%`, background: "#ff5757" }}>
                        {sellPct >= 12 && `매도 ${Math.round(sellPct)}%`}
                      </div>
                    )}
                    {holdPct > 0 && (
                      <div className="h-full flex items-center justify-center text-[9px] font-bold text-white/80"
                        style={{ width: `${holdPct}%`, background: "#ffb84d" }}>
                        {holdPct >= 12 && `관망 ${Math.round(holdPct)}%`}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-7 rounded-lg bg-th-card flex items-center justify-center text-[10px] text-th-dim">
                    예측 없음
                  </div>
                )}
              </div>
            )
          })
        )}
        <div className="flex items-center gap-4 justify-center pt-2 text-[9px] text-th-dim">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#22c997]" />매수</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#ff5757]" />매도</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#ffb84d]" />관망</span>
        </div>
      </div>
    </div>
  )
}

/* ─── #3 Sentiment Face-off ─── */
function SentimentFaceoff({ data, selected, colorMap, channelMap }: { data: any; selected: Channel[]; colorMap: Map<string, string>; channelMap: Map<string, Channel> }) {
  const faceoffs = useMemo(() => {
    const assets = data.assetCoverage as any[]
    // Group by asset, find shared ones
    const assetMap = new Map<string, Map<string, { sentiment: string; count: number }>>()
    for (const a of assets) {
      if (!assetMap.has(a.asset_name)) assetMap.set(a.asset_name, new Map())
      assetMap.get(a.asset_name)!.set(a.channel_id, {
        sentiment: a.dominant_sentiment,
        count: a.mention_count,
      })
    }

    const result: Array<{
      asset: string
      code: string
      channels: Array<{ id: string; name: string; sentiment: string; count: number }>
      hasConflict: boolean
    }> = []

    for (const [asset, chMap] of assetMap) {
      if (chMap.size < 2) continue
      const entries: any[] = []
      const sentiments = new Set<string>()
      for (const [chId, info] of chMap) {
        const ch = channelMap.get(chId)
        if (!ch) continue
        entries.push({ id: chId, name: ch.name, ...info })
        sentiments.add(info.sentiment)
      }
      const assetData = assets.find((a: any) => a.asset_name === asset)
      result.push({
        asset,
        code: assetData?.asset_code ?? "",
        channels: entries,
        hasConflict: sentiments.size > 1,
      })
    }

    return result.sort((a, b) => (b.hasConflict ? 1 : 0) - (a.hasConflict ? 1 : 0))
  }, [data, selected, channelMap])

  if (faceoffs.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: "var(--font-outfit)" }}>감성 성향 대결</h3>
        <p className="text-sm text-th-dim mt-2">공통으로 다루는 종목이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: "var(--font-outfit)" }}>
          감성 성향 대결
        </h3>
        <p className="text-[10px] text-th-dim mt-0.5">같은 종목에 대한 채널별 의견 비교</p>
      </div>
      <div className="p-4 space-y-2">
        {faceoffs.slice(0, 12).map((f) => (
          <div key={f.asset} className="glass-card rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Link href={`/assets/${encodeURIComponent(f.code || f.asset)}`} className="text-xs font-bold text-th-primary hover:text-th-accent transition">
                {f.asset}
              </Link>
              {f.hasConflict && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#ff5757]/15 text-[#ff5757] font-bold animate-pulse">
                  의견 충돌
                </span>
              )}
            </div>
            <div className={`grid gap-2 ${selected.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {selected.map((ch, i) => {
                const entry = f.channels.find((c) => c.id === ch.id)
                if (!entry) return (
                  <div key={ch.id} className="text-center text-[10px] text-th-dim py-1">미언급</div>
                )
                const sentColor = SENTIMENT_COLORS[entry.sentiment] ?? "#64748b"
                const sentLabel = entry.sentiment === "positive" ? "긍정" : entry.sentiment === "negative" ? "부정" : "중립"
                return (
                  <div key={ch.id} className="flex items-center gap-1.5 justify-center">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS[i] }} />
                    <span className="text-[10px] text-th-muted truncate">{ch.name}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{
                      background: `color-mix(in srgb, ${sentColor} 15%, transparent)`, color: sentColor,
                    }}>
                      {sentLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── #2 Asset Coverage Overlap ─── */
function AssetCoverage({ data, selected, colorMap, channelMap }: { data: any; selected: Channel[]; colorMap: Map<string, string>; channelMap: Map<string, Channel> }) {
  const coverage = useMemo(() => {
    const assets = data.assetCoverage as any[]
    const byChannel = new Map<string, Set<string>>()
    for (const ch of selected) byChannel.set(ch.id, new Set())
    for (const a of assets) {
      byChannel.get(a.channel_id)?.add(a.asset_name)
    }

    // Shared vs exclusive
    const allAssets = new Set<string>()
    for (const s of byChannel.values()) for (const a of s) allAssets.add(a)

    const shared: string[] = []
    const exclusive = new Map<string, string[]>()
    for (const ch of selected) exclusive.set(ch.id, [])

    for (const asset of allAssets) {
      const coveredBy = selected.filter((ch) => byChannel.get(ch.id)?.has(asset))
      if (coveredBy.length >= 2) {
        shared.push(asset)
      } else if (coveredBy.length === 1) {
        exclusive.get(coveredBy[0].id)!.push(asset)
      }
    }

    return { byChannel, shared, exclusive, total: allAssets.size }
  }, [data, selected])

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: "var(--font-outfit)" }}>
          종목 커버리지 비교
        </h3>
        <p className="text-[10px] text-th-dim mt-0.5">공통 종목 vs 독점 종목</p>
      </div>
      <div className="p-5 space-y-4">
        {/* Summary stats */}
        <div className={`grid gap-3 ${selected.length === 2 ? "grid-cols-3" : "grid-cols-4"}`}>
          {selected.map((ch, i) => (
            <div key={ch.id} className="glass-card rounded-lg p-3 text-center">
              <span className="text-[10px] text-th-dim">{ch.name}</span>
              <p className="text-lg font-extrabold tabular-nums mt-1" style={{ color: COLORS[i], fontFamily: "var(--font-outfit)" }}>
                {coverage.byChannel.get(ch.id)?.size ?? 0}
              </p>
              <span className="text-[9px] text-th-dim">종목</span>
            </div>
          ))}
          <div className="glass-card rounded-lg p-3 text-center">
            <span className="text-[10px] text-th-dim">공통</span>
            <p className="text-lg font-extrabold tabular-nums mt-1 text-[#ffb84d]" style={{ fontFamily: "var(--font-outfit)" }}>
              {coverage.shared.length}
            </p>
            <span className="text-[9px] text-th-dim">종목</span>
          </div>
        </div>

        {/* Shared assets */}
        {coverage.shared.length > 0 && (
          <div>
            <h4 className="text-[10px] text-th-dim uppercase tracking-wider mb-2">공통 종목</h4>
            <div className="flex flex-wrap gap-1.5">
              {coverage.shared.map((asset) => (
                <span key={asset} className="px-2 py-1 rounded-md text-[10px] font-medium bg-[#ffb84d]/10 text-[#ffb84d] border border-[#ffb84d]/20">
                  {asset}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Exclusive assets per channel */}
        {selected.map((ch, i) => {
          const excl = coverage.exclusive.get(ch.id) ?? []
          if (excl.length === 0) return null
          return (
            <div key={ch.id}>
              <h4 className="text-[10px] text-th-dim uppercase tracking-wider mb-2">
                {ch.name} 독점 종목
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {excl.slice(0, 15).map((asset) => (
                  <span key={asset} className="px-2 py-1 rounded-md text-[10px] font-medium border" style={{
                    background: `color-mix(in srgb, ${COLORS[i]} 10%, transparent)`,
                    borderColor: `color-mix(in srgb, ${COLORS[i]} 25%, transparent)`,
                    color: COLORS[i],
                  }}>
                    {asset}
                  </span>
                ))}
                {excl.length > 15 && (
                  <span className="text-[10px] text-th-dim self-center">+{excl.length - 15}개</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── #8 Engagement Rate ─── */
function EngagementRate({ data, selected, colorMap }: { data: any; selected: Channel[]; colorMap: Map<string, string> }) {
  const engMetrics = useMemo(() => {
    return selected.map((ch, i) => {
      const eng = (data.engagement as any[]).find((e: any) => e.channel_id === ch.id)
      const subs = ch.subscriber_count ?? 0
      const avgViews = eng?.avg_views ?? 0
      const avgLikes = eng?.avg_likes ?? 0
      const avgComments = eng?.avg_comments ?? 0
      const medianViews = eng?.median_views ?? 0

      return {
        id: ch.id,
        name: ch.name,
        color: COLORS[i],
        subscribers: subs,
        avgViews,
        avgLikes,
        avgComments,
        medianViews: Math.round(medianViews),
        viewRate: subs > 0 ? (avgViews / subs) * 100 : 0,
        likeRate: avgViews > 0 ? (avgLikes / avgViews) * 100 : 0,
        commentRate: avgViews > 0 ? (avgComments / avgViews) * 100 : 0,
        totalVideos: eng?.total_videos ?? 0,
      }
    })
  }, [data, selected])

  const rows = [
    { label: "구독자", format: (m: any) => formatViewCount(m.subscribers) },
    { label: "평균 조회수", format: (m: any) => formatViewCount(m.avgViews) },
    { label: "조회수 중앙값", format: (m: any) => formatViewCount(m.medianViews) },
    { label: "조회/구독 비율", format: (m: any) => `${m.viewRate.toFixed(1)}%`, highlight: true },
    { label: "좋아요율", format: (m: any) => `${m.likeRate.toFixed(2)}%` },
    { label: "댓글율", format: (m: any) => `${m.commentRate.toFixed(2)}%` },
    { label: "분석 영상 수", format: (m: any) => `${m.totalVideos}개` },
  ]

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: "var(--font-outfit)" }}>
          구독자 대비 영향력
        </h3>
        <p className="text-[10px] text-th-dim mt-0.5">구독자 수 대비 실제 참여도 비교</p>
      </div>
      <div className="p-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-th-border">
              <th className="text-left py-2 pr-4 text-th-dim font-normal text-[10px]">지표</th>
              {engMetrics.map((m) => (
                <th key={m.id} className="text-right py-2 px-2 font-semibold text-[11px]" style={{ color: m.color }}>
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-th-border/30">
                <td className="py-2.5 pr-4 text-th-muted text-[11px]">{row.label}</td>
                {engMetrics.map((m) => (
                  <td key={m.id} className="py-2.5 px-2 text-right tabular-nums" style={{
                    color: row.highlight ? m.color : "var(--th-text-primary)",
                    fontWeight: row.highlight ? 700 : 400,
                    fontFamily: "var(--font-outfit)",
                    fontSize: row.highlight ? "13px" : "11px",
                  }}>
                    {row.format(m)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── #6 Mention Density ─── */
function MentionDensity({ data, selected, colorMap }: { data: any; selected: Channel[]; colorMap: Map<string, string> }) {
  const densityData = useMemo(() => {
    return selected.map((ch, i) => {
      const eng = (data.engagement as any[]).find((e: any) => e.channel_id === ch.id)
      const prof = (data.profiles as any[]).find((p: any) => p.channel_id === ch.id)
      const assets = (data.assetCoverage as any[]).filter((a: any) => a.channel_id === ch.id)
      const totalMentions = prof?.total_mentions ?? 0
      const totalVideos = eng?.total_videos ?? 0
      const density = totalVideos > 0 ? totalMentions / totalVideos : 0

      return {
        id: ch.id,
        name: ch.name,
        color: COLORS[i],
        density,
        totalMentions,
        totalVideos,
        uniqueAssets: assets.length,
        style: density > 2 ? "다종목 커버" : density > 0.5 ? "적정 분석" : "깊이 분석",
      }
    })
  }, [data, selected])

  const maxDensity = Math.max(...densityData.map((d) => d.density), 1)

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: "var(--font-outfit)" }}>
          영상당 종목 밀도
        </h3>
        <p className="text-[10px] text-th-dim mt-0.5">밀도 높을수록 다양한 종목 커버, 낮을수록 깊이 분석</p>
      </div>
      <div className="p-5 space-y-4">
        {densityData.map((d) => (
          <div key={d.id}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-th-primary">{d.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                  background: `color-mix(in srgb, ${d.color} 15%, transparent)`, color: d.color,
                }}>
                  {d.style}
                </span>
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ color: d.color, fontFamily: "var(--font-outfit)" }}>
                {d.density.toFixed(2)}
              </span>
            </div>
            <div className="h-4 bg-th-card rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${(d.density / maxDensity) * 100}%`, background: d.color }}
              />
            </div>
            <div className="flex gap-4 mt-1 text-[9px] text-th-dim">
              <span>총 멘션: {d.totalMentions}건</span>
              <span>영상: {d.totalVideos}개</span>
              <span>종목: {d.uniqueAssets}개</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── #4 Upload Pattern Heatmap ─── */
function UploadPattern({ data, selected, colorMap }: { data: any; selected: Channel[]; colorMap: Map<string, string> }) {
  const patterns = useMemo(() => {
    const raw = data.uploadPatterns as any[]
    return selected.map((ch, idx) => {
      const chData = raw.filter((p: any) => p.channel_id === ch.id)
      // Build 7x24 grid
      const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
      let maxCount = 0
      for (const p of chData) {
        grid[p.day_of_week][p.hour] = p.count
        if (p.count > maxCount) maxCount = p.count
      }
      // Find peak time
      let peakDay = 0, peakHour = 0
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          if (grid[d][h] > grid[peakDay][peakHour]) {
            peakDay = d
            peakHour = h
          }
        }
      }
      // Day distribution
      const dayTotals = grid.map((row) => row.reduce((s, v) => s + v, 0))
      const weekday = dayTotals.slice(1, 6).reduce((s, v) => s + v, 0)
      const weekend = dayTotals[0] + dayTotals[6]

      return {
        id: ch.id,
        name: ch.name,
        color: COLORS[idx],
        grid,
        maxCount,
        peakDay,
        peakHour,
        weekday,
        weekend,
        total: weekday + weekend,
      }
    })
  }, [data, selected])

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: "var(--font-outfit)" }}>
          업로드 패턴 비교
        </h3>
        <p className="text-[10px] text-th-dim mt-0.5">요일별/시간대별 영상 업로드 빈도</p>
      </div>
      <div className="p-4 space-y-6">
        {patterns.map((p) => (
          <div key={p.id}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                <span className="text-xs font-medium text-th-primary">{p.name}</span>
              </div>
              <div className="flex gap-3 text-[9px] text-th-dim">
                <span>피크: {DAY_LABELS[p.peakDay]} {p.peakHour}시</span>
                <span>평일 {p.weekday} / 주말 {p.weekend}</span>
              </div>
            </div>
            {/* Mini heatmap */}
            <div className="space-y-[2px]">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <div key={day} className="flex items-center gap-[2px]">
                  <span className="text-[8px] text-th-dim w-4 text-right shrink-0">{DAY_LABELS[day]}</span>
                  <div className="flex gap-[1px] flex-1">
                    {Array.from({ length: 24 }, (_, h) => {
                      const val = p.grid[day][h]
                      const opacity = p.maxCount > 0 ? val / p.maxCount : 0
                      return (
                        <div
                          key={h}
                          className="flex-1 h-3 rounded-[1px]"
                          style={{
                            background: opacity > 0
                              ? `color-mix(in srgb, ${p.color} ${Math.max(opacity * 100, 15)}%, var(--th-bg-card))`
                              : "var(--th-bg-tertiary)",
                          }}
                          title={`${DAY_LABELS[day]} ${h}시: ${val}개`}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
              {/* Hour labels */}
              <div className="flex items-center gap-[2px]">
                <span className="w-4 shrink-0" />
                <div className="flex gap-[1px] flex-1">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="flex-1 text-center text-[6px] text-th-strong">
                      {h % 6 === 0 ? h : ""}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── #7 Top Videos Face-off ─── */
function TopVideos({ data, selected, colorMap }: { data: any; selected: Channel[]; colorMap: Map<string, string> }) {
  const videosByChannel = useMemo(() => {
    const raw = data.topVideos as any[]
    return selected.map((ch, i) => ({
      channel: ch,
      color: COLORS[i],
      videos: raw.filter((v: any) => v.channel_id === ch.id).slice(0, 5),
    }))
  }, [data, selected])

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: "var(--font-outfit)" }}>
          인기 영상 TOP 5
        </h3>
        <p className="text-[10px] text-th-dim mt-0.5">채널별 최고 조회수 영상 비교</p>
      </div>
      <div className={`grid gap-4 p-4 ${selected.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {videosByChannel.map(({ channel, color, videos }) => (
          <div key={channel.id} className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-xs font-semibold text-th-primary">{channel.name}</span>
            </div>
            {videos.map((v: any, idx: number) => {
              const vUrl = v.blog_post_url || (v.youtube_video_id ? `https://youtube.com/watch?v=${v.youtube_video_id}` : '#')
              return (
              <a
                key={v.youtube_video_id || v.blog_post_url || idx}
                href={vUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-2.5 p-2 rounded-lg hover:bg-th-hover/50 transition group"
              >
                <div className="relative shrink-0">
                  {v.blog_post_url ? (
                    <div className="w-24 h-[54px] rounded-md flex items-center justify-center" style={{ background: 'color-mix(in srgb, #03c75a 8%, var(--th-bg-card))' }}>
                      <span className="text-[9px] font-bold text-[#03c75a]">BLOG</span>
                    </div>
                  ) : (
                    <img
                      src={`https://i.ytimg.com/vi/${v.youtube_video_id}/mqdefault.jpg`}
                      alt=""
                      className="w-24 h-[54px] rounded-md object-cover"
                    />
                  )}
                  <span className="absolute top-0.5 left-0.5 text-[8px] font-bold px-1 py-0.5 rounded bg-black/70 text-white">
                    #{idx + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-th-muted line-clamp-2 group-hover:text-th-primary transition leading-tight">
                    {v.title}
                  </p>
                  <div className="flex gap-2 mt-1 text-[9px] text-th-dim">
                    <span>{formatViewCount(v.view_count)} 조회</span>
                    {v.like_count > 0 && <span>{formatViewCount(v.like_count)} 좋아요</span>}
                  </div>
                </div>
              </a>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── #9 Reaction Speed ─── */
function ReactionSpeed({ data, selected, colorMap, channelMap }: { data: any; selected: Channel[]; colorMap: Map<string, string>; channelMap: Map<string, Channel> }) {
  const speedData = useMemo(() => {
    const raw = data.reactionSpeed as any[]
    // Group by asset
    const assetMap = new Map<string, { asset: string; entries: Array<{ id: string; name: string; date: Date; color: string }> }>()

    for (const r of raw) {
      if (!assetMap.has(r.asset_name)) {
        assetMap.set(r.asset_name, { asset: r.asset_name, entries: [] })
      }
      const ch = channelMap.get(r.channel_id)
      if (!ch) continue
      const idx = selected.findIndex((s) => s.id === r.channel_id)
      assetMap.get(r.asset_name)!.entries.push({
        id: r.channel_id,
        name: ch.name,
        date: new Date(r.first_mention),
        color: COLORS[idx] ?? "#64748b",
      })
    }

    // Only show assets where timing differs meaningfully
    const result: Array<{
      asset: string
      entries: Array<{ id: string; name: string; date: Date; color: string; diffHours: number; rank: number }>
    }> = []

    for (const [, val] of assetMap) {
      if (val.entries.length < 2) continue
      val.entries.sort((a, b) => a.date.getTime() - b.date.getTime())
      const earliest = val.entries[0].date.getTime()
      const enriched = val.entries.map((e, i) => ({
        ...e,
        diffHours: Math.round((e.date.getTime() - earliest) / 3600000),
        rank: i + 1,
      }))
      result.push({ asset: val.asset, entries: enriched })
    }

    return result.sort((a, b) => {
      const aMaxDiff = Math.max(...a.entries.map((e) => e.diffHours))
      const bMaxDiff = Math.max(...b.entries.map((e) => e.diffHours))
      return bMaxDiff - aMaxDiff
    }).slice(0, 10)
  }, [data, selected, channelMap])

  if (speedData.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: "var(--font-outfit)" }}>종목 반응 속도</h3>
        <p className="text-sm text-th-dim mt-2">공통 종목 데이터가 부족합니다</p>
      </div>
    )
  }

  // Count first mentions per channel
  const firstCounts = new Map<string, number>()
  for (const s of speedData) {
    const firstId = s.entries[0]?.id
    if (firstId) firstCounts.set(firstId, (firstCounts.get(firstId) ?? 0) + 1)
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: "var(--font-outfit)" }}>
          종목 반응 속도
        </h3>
        <p className="text-[10px] text-th-dim mt-0.5">같은 종목을 어떤 채널이 먼저 다루었는지 비교</p>
      </div>
      <div className="p-4">
        {/* Speed leader summary */}
        <div className={`grid gap-3 mb-4 ${selected.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {selected.map((ch, i) => (
            <div key={ch.id} className="glass-card rounded-lg p-3 text-center">
              <span className="text-[10px] text-th-dim">{ch.name}</span>
              <p className="text-lg font-extrabold tabular-nums mt-1" style={{ color: COLORS[i], fontFamily: "var(--font-outfit)" }}>
                {firstCounts.get(ch.id) ?? 0}
              </p>
              <span className="text-[9px] text-th-dim">회 선제 언급</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {speedData.map((s) => (
            <div key={s.asset} className="glass-card rounded-lg p-3">
              <span className="text-[11px] font-bold text-th-primary">{s.asset}</span>
              <div className="mt-2 space-y-1">
                {s.entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <span className="text-[9px] w-4 text-center font-bold" style={{ color: e.rank === 1 ? "#22c997" : "#5a6a88" }}>
                      {e.rank === 1 ? "1st" : `${e.rank}nd`}
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: e.color }} />
                    <span className="text-[10px] text-th-muted w-20 truncate">{e.name}</span>
                    <span className="text-[9px] tabular-nums text-th-dim" style={{ fontFamily: "var(--font-outfit)" }}>
                      {e.date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                    </span>
                    {e.diffHours > 0 && (
                      <span className="text-[8px] text-[#ff5757]">
                        +{e.diffHours < 24 ? `${e.diffHours}h` : `${Math.round(e.diffHours / 24)}d`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Profile Radar Overlay ─── */
function ProfileRadarOverlay({ data, selected, colorMap }: { data: any; selected: Channel[]; colorMap: Map<string, string> }) {
  const radarData = useMemo(() => {
    const profiles = data.profiles as any[]
    const axes = ["공격성", "보수성", "다양성", "깊이"] as const
    const channelProfiles = selected.map((ch, i) => {
      const p = profiles.find((pr: any) => pr.channel_id === ch.id)
      if (!p || !p.total_mentions) return null
      return {
        name: ch.name,
        color: COLORS[i],
        aggressiveness: p.total_mentions > 0 ? (p.positive_count / p.total_mentions) * 100 : 0,
        conservatism: p.total_mentions > 0 ? (p.neutral_count / p.total_mentions) * 100 : 0,
        diversity: Math.min((p.unique_assets ?? 0) * 5, 100),
        depth: Math.min(((p.avg_duration ?? 0) / 1800) * 100, 100),
      }
    }).filter(Boolean) as any[]

    if (channelProfiles.length < 2) return null

    return axes.map((axis, idx) => {
      const keys = ["aggressiveness", "conservatism", "diversity", "depth"]
      const point: Record<string, any> = { axis }
      for (const cp of channelProfiles) {
        point[cp.name] = Math.min(cp[keys[idx]], 100)
      }
      return point
    })
  }, [data, selected])

  if (!radarData) return null

  const channelNames = selected.map((ch) => ch.name)

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: "var(--font-outfit)" }}>
          크리에이터 성향 비교 레이더
        </h3>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="var(--th-border)" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--th-text-muted)", fontSize: 11 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
            {selected.map((ch, i) => (
              <Radar
                key={ch.name}
                name={ch.name}
                dataKey={ch.name}
                stroke={COLORS[i]}
                fill={COLORS[i]}
                fillOpacity={0.08}
                strokeWidth={2}
              />
            ))}
            <Legend wrapperStyle={{ fontSize: "11px", color: "var(--th-text-muted)" }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
