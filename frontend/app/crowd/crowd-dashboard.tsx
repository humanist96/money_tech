"use client"

import { useState, useMemo } from "react"
import type { CrowdSentiment } from "@/lib/types"

interface CrowdDashboardProps {
  sentiments: CrowdSentiment[]
}

function SentimentGauge({ ratio, label }: { ratio: number | null; label: string }) {
  const value = ratio != null ? Math.round(ratio * 100) : 50
  const color = value >= 60 ? '#22c997' : value <= 40 ? '#ff5757' : '#f59e0b'
  const rotation = -90 + (value / 100) * 180

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-14 overflow-hidden">
        {/* Background arc */}
        <div className="absolute inset-0 rounded-t-full border-[6px] border-th-border/30 border-b-0" />
        {/* Colored arc indicator */}
        <div
          className="absolute bottom-0 left-1/2 w-1 h-10 origin-bottom transition-transform duration-500"
          style={{
            transform: `translateX(-50%) rotate(${rotation}deg)`,
            background: color,
            borderRadius: '2px',
          }}
        />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-th-card border-2" style={{ borderColor: color }} />
      </div>
      <span className="text-lg font-bold tabular-nums mt-1" style={{ fontFamily: 'var(--font-outfit)', color }}>
        {value}%
      </span>
      <span className="text-[10px] text-th-dim mt-0.5">{label}</span>
    </div>
  )
}

function SentimentBar({ positive, negative, neutral }: { positive: number; negative: number; neutral: number }) {
  const total = positive + negative + neutral
  if (total === 0) return null

  const posPct = (positive / total) * 100
  const negPct = (negative / total) * 100

  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-px">
      <div style={{ width: `${posPct}%`, background: '#22c997' }} />
      <div style={{ width: `${100 - posPct - negPct}%`, background: '#7c6cf0' }} />
      <div style={{ width: `${negPct}%`, background: '#ff5757' }} />
    </div>
  )
}

export function CrowdDashboard({ sentiments }: CrowdDashboardProps) {
  const [sortBy, setSortBy] = useState<'bullish' | 'bearish' | 'posts'>('posts')

  const sorted = useMemo(() => {
    return [...sentiments].sort((a, b) => {
      if (sortBy === 'bullish') return (b.bullish_ratio ?? 0) - (a.bullish_ratio ?? 0)
      if (sortBy === 'bearish') return (a.bullish_ratio ?? 1) - (b.bullish_ratio ?? 1)
      return (b.total_posts ?? 0) - (a.total_posts ?? 0)
    })
  }, [sentiments, sortBy])

  if (sentiments.length === 0) {
    return (
      <div className="glass-card rounded-2xl py-20 text-center">
        <p className="text-th-dim text-sm">종목토론방 데이터를 수집 중입니다...</p>
        <p className="text-th-dim text-xs mt-1">python discussion_crawler.py 실행 후 확인하세요</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-th-dim">정렬:</span>
        {([
          { key: 'posts' as const, label: '게시물 수' },
          { key: 'bullish' as const, label: '가장 낙관' },
          { key: 'bearish' as const, label: '가장 비관' },
        ]).map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={`text-xs px-3 py-1.5 rounded-lg transition ${
              sortBy === opt.key
                ? 'bg-th-accent/10 text-th-accent border border-th-accent/30'
                : 'text-th-dim border border-th-border hover:text-th-muted'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sentiment Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sorted.map((s) => (
          <div key={s.id} className="glass-card-elevated rounded-2xl p-5 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-th-primary text-sm">{s.stock_name}</h3>
                <span className="text-[10px] text-th-dim tabular-nums">{s.stock_code}</span>
              </div>
              <span className="text-[10px] text-th-dim tabular-nums">
                {s.total_posts}건
              </span>
            </div>

            {/* Gauge */}
            <SentimentGauge ratio={s.bullish_ratio} label="낙관도" />

            {/* Distribution Bar */}
            <SentimentBar
              positive={s.positive_count}
              negative={s.negative_count}
              neutral={s.neutral_count}
            />

            <div className="flex items-center justify-between text-[10px]">
              <span style={{ color: '#22c997' }}>긍정 {s.positive_count}</span>
              <span style={{ color: '#7c6cf0' }}>중립 {s.neutral_count}</span>
              <span style={{ color: '#ff5757' }}>부정 {s.negative_count}</span>
            </div>

            {/* Top Keywords */}
            {s.top_keywords && s.top_keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {s.top_keywords.slice(0, 5).map((kw, i) => (
                  <span
                    key={i}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-th-tertiary text-th-dim"
                  >
                    {kw.keyword} ({kw.count})
                  </span>
                ))}
              </div>
            )}

            {/* Sample Posts */}
            {s.sample_posts && s.sample_posts.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-th-border/30">
                <p className="text-[9px] text-th-dim uppercase tracking-wider">인기 게시물</p>
                {s.sample_posts.slice(0, 3).map((post, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px]">
                    <span
                      className="w-1 h-1 rounded-full mt-1.5 shrink-0"
                      style={{
                        background: post.sentiment === 'positive' ? '#22c997'
                          : post.sentiment === 'negative' ? '#ff5757' : '#7c6cf0'
                      }}
                    />
                    <span className="text-th-muted line-clamp-1">{post.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
