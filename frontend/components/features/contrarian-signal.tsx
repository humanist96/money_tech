"use client"

import Link from "next/link"
import type { ContrarianSignal } from "@/lib/types"

interface ContrarianSignalProps {
  signals: ContrarianSignal[]
}

const WARNING_CONFIG = {
  high: { color: "#ff5757", bg: "bg-[#ff5757]/10", border: "border-[#ff5757]/20", label: "강력 주의" },
  medium: { color: "#ffb84d", bg: "bg-[#ffb84d]/10", border: "border-[#ffb84d]/20", label: "주의" },
  low: { color: "#7c6cf0", bg: "bg-[#7c6cf0]/10", border: "border-[#7c6cf0]/20", label: "관심" },
}

export function ContrarianSignalPanel({ signals }: ContrarianSignalProps) {
  if (signals.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>
          역발상 시그널
        </h3>
        <p className="text-sm text-th-dim">현재 극단적 합의가 감지되지 않습니다.</p>
      </div>
    )
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden border border-[#ff5757]/10">
      <div className="px-6 py-4 border-b border-th-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#ff5757]/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff5757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
              역발상 시그널
            </h3>
            <p className="text-[10px] text-th-dim">모두가 같은 의견일 때, 과거 데이터는 다른 이야기를 합니다</p>
          </div>
        </div>
        <span className="text-[10px] text-th-dim">{signals.length}건 감지</span>
      </div>

      <div className="divide-y divide-th-border/25">
        {signals.map((signal) => {
          const config = WARNING_CONFIG[signal.warning_level]
          const dirLabel = signal.consensus_direction === 'buy' ? '매수' : '매도'

          return (
            <Link
              key={signal.asset_code}
              href={`/assets/${encodeURIComponent(signal.asset_code)}`}
              className="block px-5 py-4 hover:bg-th-hover/40 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${config.bg} ${config.border} border`}
                      style={{ color: config.color }}
                    >
                      {config.label}
                    </span>
                    <span className="text-sm font-bold text-th-primary">{signal.asset_name}</span>
                    <span className="text-[10px] text-th-dim">{signal.channel_count}개 채널</span>
                  </div>

                  <p className="text-xs text-th-muted mb-2">
                    {signal.asset_name}에 대해{' '}
                    <span className="font-bold" style={{ color: config.color }}>
                      {Math.round(signal.consensus_pct)}% {dirLabel}
                    </span>{' '}
                    의견
                  </p>

                  {(signal.historical_avg_return_1w !== null || signal.historical_avg_return_1m !== null) && (
                    <div className="flex items-center gap-3 text-[11px]">
                      {signal.historical_avg_return_1w !== null && (
                        <span className={signal.historical_avg_return_1w >= 0 ? 'text-[#22c997]' : 'text-[#ff5757]'}>
                          1주 후 평균 {signal.historical_avg_return_1w >= 0 ? '+' : ''}{signal.historical_avg_return_1w.toFixed(1)}%
                        </span>
                      )}
                      {signal.historical_avg_return_1m !== null && (
                        <span className={signal.historical_avg_return_1m >= 0 ? 'text-[#22c997]' : 'text-[#ff5757]'}>
                          1달 후 평균 {signal.historical_avg_return_1m >= 0 ? '+' : ''}{signal.historical_avg_return_1m.toFixed(1)}%
                        </span>
                      )}
                      {signal.rebound_probability !== null && signal.consensus_direction === 'sell' && (
                        <span className="text-[#7c6cf0]">
                          반등 확률 {signal.rebound_probability.toFixed(0)}%
                        </span>
                      )}
                      {signal.similar_cases > 0 && (
                        <span className="text-th-dim">({signal.similar_cases}건 분석)</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div
                    className="text-2xl font-bold tabular-nums"
                    style={{ fontFamily: 'var(--font-outfit)', color: config.color }}
                  >
                    {Math.round(signal.consensus_pct)}%
                  </div>
                  <div className="text-[10px] text-th-dim">{dirLabel} 합의</div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
