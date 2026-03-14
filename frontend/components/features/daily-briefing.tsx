"use client"

import Link from "next/link"
import type { AssetMention, ConflictingAsset, PredictionFeedItem, MarketTemperature } from "@/lib/types"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"

interface DailyBriefingProps {
  topMentioned: AssetMention[]
  conflicts: ConflictingAsset[]
  newRecommendations: PredictionFeedItem[]
  temperature: MarketTemperature[]
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm">{icon}</span>
      <h4 className="text-sm font-bold text-th-primary" style={{ fontFamily: 'var(--font-outfit)' }}>
        {children}
      </h4>
    </div>
  )
}

export function DailyBriefingPanel({ topMentioned, conflicts, newRecommendations, temperature }: DailyBriefingProps) {
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  const overallTemp = temperature.length > 0
    ? temperature.reduce((sum, d) => sum + d.temperature * d.total_count, 0) /
      Math.max(temperature.reduce((sum, d) => sum + d.total_count, 0), 1)
    : 50

  const overallLabel = overallTemp >= 70 ? "탐욕"
    : overallTemp >= 55 ? "낙관"
    : overallTemp >= 45 ? "중립"
    : overallTemp >= 30 ? "비관"
    : "공포"

  const overallColor = overallTemp >= 60 ? "#22c997" : overallTemp >= 40 ? "#ffb84d" : "#ff5757"

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00e8b8]/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00e8b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
                AI 일일 마켓 브리핑
              </h3>
              <p className="text-[10px] text-th-dim">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-outfit)', color: overallColor }}>
              {Math.round(overallTemp)}
            </span>
            <span className="text-[10px]" style={{ color: overallColor }}>{overallLabel}</span>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* 1. Top Mentioned */}
        <div>
          <SectionTitle icon="1.">가장 많이 언급된 종목 TOP 5</SectionTitle>
          <div className="space-y-1.5">
            {topMentioned.slice(0, 5).map((asset, i) => {
              const dominant = asset.positive_count > asset.negative_count ? 'positive' : asset.negative_count > asset.positive_count ? 'negative' : 'neutral'
              const color = dominant === 'positive' ? '#22c997' : dominant === 'negative' ? '#ff5757' : '#ffb84d'
              return (
                <Link
                  key={asset.asset_code || asset.asset_name}
                  href={`/assets/${encodeURIComponent(asset.asset_code || asset.asset_name)}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-th-hover/40 transition"
                >
                  <span className="text-[10px] font-bold text-th-dim w-4 tabular-nums">{i + 1}</span>
                  <span className="text-sm font-medium text-th-primary flex-1">{asset.asset_name}</span>
                  <span className="text-[10px] text-th-dim">{asset.channels.length}개 채널</span>
                  <span className="text-[10px] text-th-dim">{asset.mention_count}회</span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
                  >
                    {dominant === 'positive' ? '긍정' : dominant === 'negative' ? '부정' : '중립'}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* 2. Conflicting Opinions */}
        {conflicts.length > 0 && (
          <div>
            <SectionTitle icon="2.">크리에이터 간 의견이 갈리는 종목</SectionTitle>
            <div className="space-y-2">
              {conflicts.map((c) => (
                <div key={c.asset_code} className="bg-th-tertiary/40 rounded-xl p-3">
                  <Link
                    href={`/assets/${encodeURIComponent(c.asset_code)}`}
                    className="text-sm font-bold text-th-primary hover:text-th-accent transition"
                  >
                    {c.asset_name}
                  </Link>
                  <div className="flex gap-4 mt-2 text-[11px]">
                    <div>
                      <span className="text-[#22c997] font-medium">매수:</span>
                      <span className="text-th-muted ml-1">{c.buy_channels.join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-[#ff5757] font-medium">매도:</span>
                      <span className="text-th-muted ml-1">{c.sell_channels.join(', ')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. New Recommendations */}
        {newRecommendations.length > 0 && (
          <div>
            <SectionTitle icon="3.">최신 추천 종목</SectionTitle>
            <div className="space-y-1.5">
              {newRecommendations.slice(0, 5).map((pred) => {
                const typeColor = pred.prediction_type === 'buy' ? '#22c997' : '#ff5757'
                return (
                  <div key={pred.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-th-hover/40 transition text-[12px]">
                    <span className="text-th-muted w-20 truncate shrink-0">{pred.channel_name}</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: `color-mix(in srgb, ${typeColor} 12%, transparent)`, color: typeColor }}
                    >
                      {pred.prediction_type === 'buy' ? '매수' : '매도'}
                    </span>
                    <Link
                      href={`/assets/${encodeURIComponent(pred.asset_code || pred.asset_name)}`}
                      className="font-medium text-th-primary hover:text-th-accent transition"
                    >
                      {pred.asset_name}
                    </Link>
                    {pred.reason && (
                      <span className="text-th-dim truncate flex-1">{pred.reason}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 4. Market Events */}
        <div>
          <SectionTitle icon="4.">오늘 주목할 이벤트</SectionTitle>
          <div className="space-y-1.5">
            {(() => {
              const events: { text: string; color: string }[] = []

              // Extreme temperature events
              for (const t of temperature) {
                if (t.temperature >= 80) events.push({ text: `${CATEGORY_LABELS[t.category] ?? t.category} 과열 경고 (온도 ${Math.round(t.temperature)})`, color: '#ff5757' })
                if (t.temperature <= 20) events.push({ text: `${CATEGORY_LABELS[t.category] ?? t.category} 극도 비관 (온도 ${Math.round(t.temperature)})`, color: '#7c6cf0' })
              }

              // Conflict events
              for (const c of conflicts.slice(0, 3)) {
                events.push({ text: `${c.asset_name}: 크리에이터 의견 대립 (매수 ${c.buy_channels.length} vs 매도 ${c.sell_channels.length})`, color: '#ffb84d' })
              }

              // High mention count events
              for (const m of topMentioned.slice(0, 2)) {
                if (m.mention_count >= 10) events.push({ text: `${m.asset_name} 급등 관심 (${m.mention_count}회 언급, ${m.channels.length}개 채널)`, color: '#00e8b8' })
              }

              if (events.length === 0) events.push({ text: '특별한 시장 이벤트가 감지되지 않았습니다.', color: 'var(--th-text-dim)' })

              return events.map((e, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-th-tertiary/40">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.color }} />
                  <span className="text-[12px] text-th-primary">{e.text}</span>
                </div>
              ))
            })()}
          </div>
        </div>

        {/* 5. Category Temperature */}
        <div>
          <SectionTitle icon="5.">분야별 시장 온도</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {temperature.map((t) => {
              const catColor = CATEGORY_COLORS[t.category] ?? '#6b7280'
              const tempColor = t.temperature >= 60 ? '#22c997' : t.temperature >= 40 ? '#ffb84d' : '#ff5757'
              return (
                <div key={t.category} className="bg-th-tertiary/40 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-semibold" style={{ color: catColor }}>
                    {CATEGORY_LABELS[t.category] ?? t.category}
                  </span>
                  <div className="text-lg font-bold mt-1 tabular-nums" style={{ fontFamily: 'var(--font-outfit)', color: tempColor }}>
                    {Math.round(t.temperature)}
                  </div>
                  <div className="text-[9px] text-th-dim">{t.total_count}건 분석</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
