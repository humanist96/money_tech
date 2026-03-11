"use client"

import Link from "next/link"
import type { RiskScore } from "@/lib/types"

interface RiskScoreboardProps {
  scores: RiskScore[]
}

const SIGNAL_CONFIG = {
  green: { label: '안전', color: '#22c997', emoji: 'G' },
  yellow: { label: '주의', color: '#ffb84d', emoji: 'Y' },
  red: { label: '위험', color: '#ff5757', emoji: 'R' },
}

const TREND_ICONS = {
  rising: { label: '급등', color: '#ff5757' },
  falling: { label: '급감', color: '#22c997' },
  stable: { label: '안정', color: '#7c6cf0' },
}

const SHIFT_ICONS = {
  improving: { label: '개선', color: '#22c997' },
  worsening: { label: '악화', color: '#ff5757' },
  stable: { label: '유지', color: '#7c6cf0' },
}

export function RiskScoreboard({ scores }: RiskScoreboardProps) {
  if (scores.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>
          종목 리스크 스코어보드
        </h3>
        <p className="text-sm text-th-dim">리스크 분석 데이터를 수집 중입니다.</p>
      </div>
    )
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#7c6cf0]/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c6cf0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
              종목 리스크 스코어보드
            </h3>
            <p className="text-[10px] text-th-dim">유튜버 데이터 기반 투자 리스크 종합 점수</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-th-border/25">
        {scores.map((score) => {
          const signal = SIGNAL_CONFIG[score.signal_color]
          const trend = TREND_ICONS[score.mention_trend]
          const shift = SHIFT_ICONS[score.sentiment_shift]

          return (
            <Link
              key={score.asset_code}
              href={`/assets/${encodeURIComponent(score.asset_code)}`}
              className="block px-5 py-4 hover:bg-th-hover/40 transition"
            >
              <div className="flex items-center gap-4">
                {/* Signal Light */}
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{
                      background: `color-mix(in srgb, ${signal.color} 15%, var(--th-bg-card))`,
                      border: `2px solid ${signal.color}`,
                      color: signal.color,
                    }}
                  >
                    {score.score}
                  </div>
                  <span className="text-[9px] mt-1" style={{ color: signal.color }}>{signal.label}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-th-primary">{score.asset_name}</span>
                    <span className="text-[10px] text-th-dim">{score.mention_count}회 언급</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span style={{ color: trend.color }}>
                      언급 {trend.label}
                    </span>
                    <span style={{ color: shift.color }}>
                      감성 {shift.label}
                    </span>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="hidden sm:flex items-center gap-1 shrink-0">
                  {Object.entries(score.details).map(([key, val]) => {
                    const labels: Record<string, string> = {
                      consensus_score: '합의',
                      frequency_score: '빈도',
                      expert_score: '전문가',
                      sentiment_score: '감성',
                    }
                    return (
                      <div
                        key={key}
                        className="text-center px-2 py-1 rounded bg-th-tertiary/60"
                        title={labels[key]}
                      >
                        <div className="text-[8px] text-th-dim">{labels[key]}</div>
                        <div className="text-[10px] font-bold tabular-nums" style={{ fontFamily: 'var(--font-outfit)', color: signal.color }}>
                          {val}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
