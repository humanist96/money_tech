"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import type { Channel, PredictionFeedItem, PortfolioResponse } from "@/lib/types"
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/types"

interface YouTuberPortfolioProps {
  allChannels: Channel[]
}

const STORAGE_KEY = "moneytech_portfolio_channels"

function getStoredChannels(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveChannels(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

export function YouTuberPortfolio({ allChannels }: YouTuberPortfolioProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [portfolioData, setPortfolioData] = useState<PortfolioResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSelector, setShowSelector] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const stored = getStoredChannels()
    if (stored.length > 0) {
      setSelectedIds(stored)
    }
  }, [])

  const loadPortfolioData = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    setLoading(true)
    try {
      const res = await fetch(`/api/portfolio?channelIds=${ids.join(",")}`)
      if (res.ok) {
        const data = await res.json()
        setPortfolioData(data)
      }
    } catch {
      // fallback
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedIds.length > 0) {
      loadPortfolioData(selectedIds)
    }
  }, [selectedIds, loadPortfolioData])

  const toggleChannel = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : selectedIds.length < 10 ? [...selectedIds, id] : selectedIds
    setSelectedIds(next)
    saveChannels(next)
  }

  const selectedChannels = allChannels.filter(c => selectedIds.includes(c.id))
  const filteredChannels = allChannels.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Channel Selector */}
      <div className="glass-card-elevated rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-th-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#7c6cf0]/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c6cf0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
                나만의 크리에이터 포트폴리오
              </h3>
              <p className="text-[10px] text-th-dim">
                신뢰하는 크리에이터를 선택하면 맞춤형 종합 피드를 제공합니다 (최대 10명)
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSelector(!showSelector)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#7c6cf0]/10 text-[#7c6cf0] hover:bg-[#7c6cf0]/20 transition"
          >
            {showSelector ? '닫기' : '크리에이터 선택'}
          </button>
        </div>

        {/* Selected Channel Badges */}
        {selectedChannels.length > 0 && (
          <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-th-border/30">
            {selectedChannels.map(ch => {
              const catColor = CATEGORY_COLORS[ch.category] ?? '#6b7280'
              return (
                <button
                  key={ch.id}
                  onClick={() => toggleChannel(ch.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition hover:opacity-70 group"
                  style={{
                    background: `color-mix(in srgb, ${catColor} 8%, transparent)`,
                    borderColor: `color-mix(in srgb, ${catColor} 25%, transparent)`,
                    color: catColor,
                  }}
                >
                  {ch.thumbnail_url && (
                    <img src={ch.thumbnail_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                  )}
                  {ch.name}
                  <span className="text-[9px] opacity-50 group-hover:opacity-100">x</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Channel Selector Panel */}
        {showSelector && (
          <div className="p-4 border-b border-th-border/30">
            <input
              type="text"
              placeholder="채널 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-th-tertiary border border-th-border rounded-lg px-3 py-2 text-sm text-th-primary focus:outline-none focus:border-[#7c6cf0]/50 mb-3"
            />
            <div className="max-h-[240px] overflow-y-auto space-y-1">
              {filteredChannels.map(ch => {
                const isSelected = selectedIds.includes(ch.id)
                const catColor = CATEGORY_COLORS[ch.category] ?? '#6b7280'
                return (
                  <button
                    key={ch.id}
                    onClick={() => toggleChannel(ch.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition text-left ${isSelected ? 'bg-[#7c6cf0]/10 border border-[#7c6cf0]/20' : 'hover:bg-th-hover/40 border border-transparent'}`}
                  >
                    <div className="w-4 h-4 rounded border flex items-center justify-center text-[10px]"
                      style={{
                        borderColor: isSelected ? '#7c6cf0' : 'var(--th-border)',
                        background: isSelected ? '#7c6cf0' : 'transparent',
                        color: isSelected ? '#fff' : 'transparent',
                      }}>
                      {isSelected ? '✓' : ''}
                    </div>
                    {ch.thumbnail_url ? (
                      <img src={ch.thumbnail_url} alt="" className="w-7 h-7 rounded-lg object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ background: `color-mix(in srgb, ${catColor} 15%, var(--th-bg-card))`, color: catColor }}>
                        {ch.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-th-primary font-medium truncate block">{ch.name}</span>
                      <span className="text-[10px] text-th-dim">
                        {CATEGORY_LABELS[ch.category] ?? ch.category}
                        {ch.hit_rate ? ` | 적중률 ${Math.round(ch.hit_rate * 100)}%` : ''}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Portfolio Data */}
      {selectedIds.length === 0 && (
        <div className="glass-card-elevated rounded-2xl p-8 text-center">
          <p className="text-th-dim text-sm">크리에이터를 선택하면 종합 대시보드가 표시됩니다.</p>
        </div>
      )}

      {loading && (
        <div className="glass-card-elevated rounded-2xl p-8 text-center">
          <p className="text-th-dim text-sm">포트폴리오 데이터를 불러오는 중...</p>
        </div>
      )}

      {portfolioData && !loading && (
        <div className="space-y-6">
          {/* Combined Hit Rate */}
          <div className="glass-card-elevated rounded-2xl p-6">
            <h4 className="text-sm font-bold text-th-primary mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>
              내 포트폴리오 종합 적중률
            </h4>
            <div className="flex items-center gap-6">
              <div>
                <span
                  className="text-4xl font-bold tabular-nums"
                  style={{
                    fontFamily: 'var(--font-outfit)',
                    color: (portfolioData.combinedHitRate ?? 0) >= 50 ? '#22c997' : '#ff5757',
                  }}
                >
                  {portfolioData.combinedHitRate !== null
                    ? `${Math.round(portfolioData.combinedHitRate * 100)}%`
                    : '-'}
                </span>
                <p className="text-[10px] text-th-dim mt-1">
                  {portfolioData.totalPredictions}건 예측 중 {portfolioData.accurateCount}건 적중
                </p>
              </div>
              <div className="flex-1 h-3 bg-th-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(portfolioData.combinedHitRate ?? 0) * 100}%`,
                    background: (portfolioData.combinedHitRate ?? 0) >= 50 ? '#22c997' : '#ff5757',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Opinion Conflicts */}
          {portfolioData.conflicts && portfolioData.conflicts.length > 0 && (
            <div className="glass-card-elevated rounded-2xl overflow-hidden border border-[#ffb84d]/20">
              <div className="px-6 py-3 border-b border-th-border/50 flex items-center gap-2">
                <span className="text-sm">&#x26A0;&#xFE0F;</span>
                <h4 className="text-sm font-bold text-[#ffb84d]" style={{ fontFamily: 'var(--font-outfit)' }}>
                  내 크리에이터 간 의견 충돌
                </h4>
              </div>
              <div className="p-4 space-y-2">
                {portfolioData.conflicts.map((c, i) => (
                  <div key={i} className="bg-th-tertiary/40 rounded-xl p-3">
                    <Link
                      href={`/assets/${encodeURIComponent(c.asset_code || c.asset_name)}`}
                      className="text-sm font-bold text-th-primary hover:text-th-accent transition"
                    >
                      {c.asset_name}
                    </Link>
                    <div className="flex gap-4 mt-1.5 text-[11px]">
                      <span className="text-[#22c997]">매수: {c.buy_channels.join(', ')}</span>
                      <span className="text-[#ff5757]">매도: {c.sell_channels.join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Predictions from selected channels */}
          {portfolioData.recentPredictions && portfolioData.recentPredictions.length > 0 && (
            <div className="glass-card-elevated rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-th-border/50">
                <h4 className="text-sm font-bold text-th-primary" style={{ fontFamily: 'var(--font-outfit)' }}>
                  내 크리에이터 최신 예측
                </h4>
              </div>
              <div className="divide-y divide-th-border/25 max-h-[400px] overflow-y-auto">
                {portfolioData.recentPredictions.map((pred) => {
                  const typeColor = pred.prediction_type === 'buy' ? '#22c997' : '#ff5757'
                  return (
                    <div key={pred.id} className="px-5 py-3 hover:bg-th-hover/40 transition">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-th-muted w-20 truncate shrink-0">{pred.channel_name}</span>
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: `color-mix(in srgb, ${typeColor} 12%, transparent)`, color: typeColor }}
                        >
                          {pred.prediction_type === 'buy' ? '매수' : '매도'}
                        </span>
                        <Link
                          href={`/assets/${encodeURIComponent(pred.asset_code || pred.asset_name)}`}
                          className="text-sm font-medium text-th-primary hover:text-th-accent transition"
                        >
                          {pred.asset_name}
                        </Link>
                        {pred.direction_score !== null && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ml-auto ${pred.direction_score >= 0.5 ? 'bg-[#22c997]/10 text-[#22c997]' : 'bg-[#ff5757]/10 text-[#ff5757]'}`}>
                            {pred.direction_score >= 0.5 ? '적중' : '빗나감'}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
