"use client"

import Link from "next/link"
import type { WeeklyReportItem } from "@/lib/types"
import { CATEGORY_COLORS } from "@/lib/types"

interface WeeklyReportProps {
  winners: WeeklyReportItem[]
  losers: WeeklyReportItem[]
  bestCall: { channel_name: string; asset_name: string; prediction_type: string; return_pct: number | null } | null
  worstCall: { channel_name: string; asset_name: string; prediction_type: string; return_pct: number | null } | null
}

function RankCard({
  item,
  rank,
  type,
}: {
  item: WeeklyReportItem
  rank: number
  type: 'winner' | 'loser'
}) {
  const catColor = CATEGORY_COLORS[item.category] ?? '#6b7280'
  const accentColor = type === 'winner' ? '#22c997' : '#ff5757'
  const medal = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : null
  const medalColors: Record<string, string> = {
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
  }

  return (
    <Link href={`/channels/${item.channel_id}`} className="group">
      <div className="bg-th-tertiary/60 rounded-xl p-4 hover:bg-th-tertiary transition border border-th-border/30 hover:border-opacity-50" style={{ ['--hover-color' as string]: accentColor }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <div
              className="rounded-lg p-[1.5px] shrink-0"
              style={{ background: `linear-gradient(135deg, ${catColor}, color-mix(in srgb, ${catColor} 30%, transparent))` }}
            >
              {item.channel_thumbnail ? (
                <img src={item.channel_thumbnail} alt="" className="w-9 h-9 rounded-[6px] object-cover bg-th-card" />
              ) : (
                <div
                  className="w-9 h-9 rounded-[6px] flex items-center justify-center text-sm font-bold"
                  style={{ background: `color-mix(in srgb, ${catColor} 15%, var(--th-bg-card))`, color: catColor }}
                >
                  {item.channel_name[0]}
                </div>
              )}
            </div>
            {medal && (
              <div
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-th-card"
                style={{ background: medalColors[medal], color: '#000' }}
              >
                {rank}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-th-primary truncate block group-hover:text-th-accent transition">
              {item.channel_name}
            </span>
            <span className="text-[10px] text-th-dim">{item.total_count}건 평가</span>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-outfit)', color: accentColor }}
            >
              {item.accuracy_pct.toFixed(0)}%
            </span>
            <span className="text-[10px] text-th-dim ml-1">적중률</span>
          </div>
          <div className="text-right text-[10px] text-th-dim">
            <span style={{ color: '#22c997' }}>{item.accurate_count}</span>
            <span> / </span>
            <span>{item.total_count}</span>
          </div>
        </div>

        <div className="mt-2 flex rounded-full overflow-hidden h-1.5 bg-th-bg">
          <div
            className="h-full transition-all"
            style={{ width: `${item.accuracy_pct}%`, background: accentColor }}
          />
        </div>
      </div>
    </Link>
  )
}

function ShareButton({ winners, bestCall }: { winners: WeeklyReportItem[]; bestCall: WeeklyReportProps['bestCall'] }) {
  const handleShare = async () => {
    const text = [
      `📊 MoneyTech 주간 적중왕 리포트`,
      ``,
      ...winners.slice(0, 3).map((w, i) => `${['🥇', '🥈', '🥉'][i]} ${w.channel_name} - 적중률 ${w.accuracy_pct.toFixed(0)}%`),
      bestCall ? `\n🎯 Best Call: ${bestCall.channel_name} → ${bestCall.asset_name} (${bestCall.return_pct !== null ? `${bestCall.return_pct >= 0 ? '+' : ''}${Number(bestCall.return_pct).toFixed(1)}%` : '평가중'})` : '',
      `\n#MoneyTech #주간적중왕`,
    ].filter(Boolean).join('\n')

    if (navigator.share) {
      try { await navigator.share({ title: 'MoneyTech 주간 적중왕', text }) } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text)
      alert('클립보드에 복사되었습니다!')
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-th-tertiary hover:bg-th-hover border border-th-border/50 text-th-muted transition"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      공유하기
    </button>
  )
}

export function WeeklyReportPanel({ winners, losers, bestCall, worstCall }: WeeklyReportProps) {
  const hasData = winners.length > 0 || losers.length > 0

  if (!hasData) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>
          주간 적중왕 리포트
        </h3>
        <p className="text-sm text-th-dim">이번 주 평가 데이터가 아직 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Share */}
      <div className="flex justify-end">
        <ShareButton winners={winners} bestCall={bestCall} />
      </div>

      {/* Best & Worst Call */}
      {(bestCall || worstCall) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {bestCall && (
            <div className="glass-card-elevated rounded-2xl p-5 border border-[#22c997]/20">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">&#x1F3AF;</span>
                <h4 className="text-sm font-bold text-[#22c997]" style={{ fontFamily: 'var(--font-outfit)' }}>
                  Best Call of the Week
                </h4>
              </div>
              <p className="text-sm text-th-primary">
                <span className="font-semibold">{bestCall.channel_name}</span>
                <span className="text-th-dim"> | </span>
                <span>{bestCall.asset_name}</span>
                <span className="text-th-dim"> | </span>
                <span className={bestCall.prediction_type === 'buy' ? 'text-[#22c997]' : 'text-[#ff5757]'}>
                  {bestCall.prediction_type === 'buy' ? '매수' : '매도'}
                </span>
              </p>
              {bestCall.return_pct !== null && (
                <p className="text-xl font-bold mt-2 text-[#22c997]" style={{ fontFamily: 'var(--font-outfit)' }}>
                  {bestCall.return_pct >= 0 ? '+' : ''}{Number(bestCall.return_pct).toFixed(1)}%
                </p>
              )}
            </div>
          )}
          {worstCall && (
            <div className="glass-card-elevated rounded-2xl p-5 border border-[#ff5757]/20">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">&#x1F4A5;</span>
                <h4 className="text-sm font-bold text-[#ff5757]" style={{ fontFamily: 'var(--font-outfit)' }}>
                  Worst Call of the Week
                </h4>
              </div>
              <p className="text-sm text-th-primary">
                <span className="font-semibold">{worstCall.channel_name}</span>
                <span className="text-th-dim"> | </span>
                <span>{worstCall.asset_name}</span>
                <span className="text-th-dim"> | </span>
                <span className={worstCall.prediction_type === 'buy' ? 'text-[#22c997]' : 'text-[#ff5757]'}>
                  {worstCall.prediction_type === 'buy' ? '매수' : '매도'}
                </span>
              </p>
              {worstCall.return_pct !== null && (
                <p className="text-xl font-bold mt-2 text-[#ff5757]" style={{ fontFamily: 'var(--font-outfit)' }}>
                  {Number(worstCall.return_pct).toFixed(1)}%
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Winners */}
      {winners.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">&#x1F3C6;</span>
            <h3 className="font-bold text-[#22c997] text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
              적중왕 TOP {winners.length}
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {winners.map((w, i) => (
              <RankCard key={w.channel_id} item={w} rank={i + 1} type="winner" />
            ))}
          </div>
        </div>
      )}

      {/* Losers */}
      {losers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">&#x1F648;</span>
            <h3 className="font-bold text-[#ff5757] text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
              꽝왕 TOP {losers.length}
            </h3>
            <span className="text-[10px] text-th-dim">(유머입니다, 실력 향상을 응원합니다)</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {losers.map((l, i) => (
              <RankCard key={l.channel_id} item={l} rank={i + 1} type="loser" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
