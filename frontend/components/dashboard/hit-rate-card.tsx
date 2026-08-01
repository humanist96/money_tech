"use client"

import { useState } from "react"
import type { ChannelHorizonStats, Horizon, SkillGrade } from "@/lib/types"

const MIN_SAMPLE_FOR_RANKING = 10

const HORIZON_LABELS: Record<Horizon, string> = { "1w": "1주", "1m": "1개월", "3m": "3개월" }

const GRADE_META: Record<SkillGrade, { label: string; color: string; hint: string }> = {
  beats_market: { label: "시장보다 잘 맞힘", color: "#22c997", hint: "신뢰구간 전체가 50%를 넘습니다" },
  market_level: { label: "시장 수준", color: "#5a6a88", hint: "우연과 구분되지 않는 범위입니다" },
  below_market: { label: "시장보다 못 맞힘", color: "#ef4444", hint: "신뢰구간 전체가 50% 아래입니다" },
  insufficient: { label: "평가 유보", color: "#3a4a6a", hint: `표본 ${MIN_SAMPLE_FOR_RANKING}건 미만` },
}

function grade(s: ChannelHorizonStats): SkillGrade {
  if (s.n_effective < MIN_SAMPLE_FOR_RANKING || s.wilson_low == null || s.wilson_high == null) {
    return "insufficient"
  }
  if (s.wilson_low > 0.5) return "beats_market"
  if (s.wilson_high < 0.5) return "below_market"
  return "market_level"
}

interface HitRateCardProps {
  stats: ChannelHorizonStats[]
}

/**
 * Channel record on the same definition the leaderboard uses: hits over
 * hits+misses, judged on return in excess of the benchmark, with the interval
 * shown so a thin sample cannot read as a strong record.
 *
 * The previous version averaged `direction_score`, a column the evaluator no
 * longer writes — this page and the leaderboard were reporting two different
 * numbers for the same channel.
 */
export function HitRateCard({ stats }: HitRateCardProps) {
  const [horizon, setHorizon] = useState<Horizon>("1m")
  const current = stats.find((s) => s.horizon === horizon) ?? null

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50 flex items-center justify-between gap-3">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: "var(--font-outfit)" }}>
          적중률 (시장 대비)
        </h3>
        <div className="filter-group flex items-center gap-1">
          {(Object.keys(HORIZON_LABELS) as Horizon[]).map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`filter-btn text-[11px] ${horizon === h ? "active" : ""}`}
            >
              {HORIZON_LABELS[h]}
            </button>
          ))}
        </div>
      </div>

      {!current || current.n_effective === 0 ? (
        <div className="p-6 text-center text-sm text-th-dim">
          {stats.length === 0
            ? "아직 평가된 예측이 없습니다. 재검증이 진행 중입니다."
            : `${HORIZON_LABELS[horizon]} 구간에 평가된 예측이 없습니다.`}
        </div>
      ) : (
        <div className="p-6 space-y-4">
          <div className="flex items-end gap-3">
            <div
              className="text-4xl font-bold tabular-nums"
              style={{ fontFamily: "var(--font-outfit)", color: GRADE_META[grade(current)].color }}
            >
              {current.hit_rate != null ? `${Math.round(current.hit_rate * 100)}%` : "-"}
            </div>
            <div className="pb-1.5 space-y-1">
              {current.wilson_low != null && current.wilson_high != null && (
                <div className="text-[11px] text-th-dim tabular-nums">
                  95% 신뢰구간 {Math.round(current.wilson_low * 100)}~{Math.round(current.wilson_high * 100)}%
                </div>
              )}
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  background: `${GRADE_META[grade(current)].color}1a`,
                  color: GRADE_META[grade(current)].color,
                }}
                title={GRADE_META[grade(current)].hint}
              >
                {GRADE_META[grade(current)].label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="평가 표본" value={`${current.n_effective}건`} hint="적중+빗나감 (판정보류·중복 제외)" />
            <Stat
              label="평균 초과수익"
              value={
                current.avg_excess_return != null
                  ? `${current.avg_excess_return >= 0 ? "+" : ""}${(current.avg_excess_return * 100).toFixed(1)}%p`
                  : "-"
              }
              hint="벤치마크 대비"
              color={
                (current.avg_excess_return ?? 0) > 0
                  ? "#22c997"
                  : (current.avg_excess_return ?? 0) < 0
                    ? "#ef4444"
                    : undefined
              }
            />
            <Stat label="판정 보류" value={`${current.n_push}건`} hint="거래비용 밴드 내 움직임" />
            <Stat label="평가 불가" value={`${current.n_unevaluable}건`} hint="가격 소스 없음·상장폐지 등" />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-th-dim pt-1 border-t border-th-border/40">
            <span>매수 {current.n_buy}</span>
            <span>·</span>
            <span>매도 {current.n_sell}</span>
            <span>·</span>
            <span>보유 {current.n_hold}</span>
            {current.n_absolute > 0 && (
              <>
                <span>·</span>
                <span
                  className="text-[#ffb84d]"
                  title="BTC는 비교할 벤치마크가 없어 절대수익으로 판정합니다. 다른 종목과 척도가 달라 함께 표기합니다."
                >
                  절대수익 판정 {current.n_absolute}건 (BTC)
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  color,
}: {
  label: string
  value: string
  hint?: string
  color?: string
}) {
  return (
    <div className="bg-th-tertiary/50 rounded-lg p-2.5 text-center" title={hint}>
      <div className="text-[10px] text-th-dim">{label}</div>
      <div
        className="text-sm font-bold tabular-nums mt-0.5"
        style={{ fontFamily: "var(--font-outfit)", color: color ?? "var(--th-text-primary)" }}
      >
        {value}
      </div>
    </div>
  )
}
