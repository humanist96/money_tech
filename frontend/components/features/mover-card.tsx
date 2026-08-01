"use client"

import Link from "next/link"
import { useState } from "react"
import type { DailyMover, MoverConfidence, EvidenceType } from "@/lib/types"

const CONFIDENCE_META: Record<MoverConfidence, { label: string; color: string; hint: string }> = {
  high: { label: "근거 충분", color: "#22c997", hint: "공시를 포함해 2개 이상의 근거 유형이 일치" },
  medium: { label: "근거 보통", color: "#ffb84d", hint: "1개 근거 유형" },
  low: { label: "근거 약함", color: "#5a6a88", hint: "정황뿐이거나 공개 요인 미확인" },
}

const EVIDENCE_META: Record<EvidenceType, { label: string; color: string }> = {
  disclosure: { label: "공시", color: "#7c6cf0" },
  flow: { label: "수급", color: "#3b82f6" },
  news: { label: "뉴스", color: "#ffb84d" },
  market: { label: "시장", color: "#5a6a88" },
  creator: { label: "크리에이터", color: "#22c997" },
}

const VERDICT_COLORS: Record<string, string> = {
  적중: "#22c997",
  빗나감: "#ef4444",
  판정보류: "#5a6a88",
  "평가 전": "#3a4a6a",
}

export function MoverCard({ mover }: { mover: DailyMover }) {
  const [open, setOpen] = useState(false)
  const up = mover.change_pct >= 0
  const conf = CONFIDENCE_META[mover.confidence ?? "low"]
  const predictions = mover.creator_context?.predictions ?? []

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/assets/${encodeURIComponent(mover.stock_code)}`}
                className="text-base font-bold text-th-primary hover:text-th-accent transition-colors"
              >
                {mover.stock_name}
              </Link>
              <span className="text-[10px] text-th-dim tabular-nums">{mover.stock_code}</span>
              {mover.market && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-th-tertiary text-th-dim">
                  {mover.market}
                </span>
              )}
              {mover.selection_reason === "creator_pick" && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: "#22c9971a", color: "#22c997" }}
                  title="우리가 추적하는 크리에이터가 최근 언급한 종목"
                >
                  크리에이터 관심
                </span>
              )}
            </div>

            <div className="mt-1.5 text-sm font-medium text-th-primary">
              {mover.headline ?? "원인 요약"}
            </div>
          </div>

          <div className="text-right shrink-0">
            <div
              className="text-xl font-bold tabular-nums"
              style={{ fontFamily: "var(--font-outfit)", color: up ? "#22c997" : "#ef4444" }}
            >
              {up ? "+" : ""}
              {mover.change_pct.toFixed(1)}%
            </div>
            {mover.value_ratio != null && mover.value_ratio >= 1.5 && (
              <div className="text-[10px] text-th-dim">거래대금 {mover.value_ratio.toFixed(1)}배</div>
            )}
          </div>
        </div>

        {mover.summary && (
          <p className="mt-2 text-[13px] text-th-secondary leading-relaxed">{mover.summary}</p>
        )}

        {/* The block a portal cannot produce: who called this, and how it scored. */}
        {predictions.length > 0 && (
          <div className="mt-3 rounded-lg border border-[#22c997]/20 bg-[#22c997]/5 px-3 py-2.5">
            <div className="text-[10px] font-semibold text-[#22c997] mb-1.5">
              이 종목을 미리 언급한 크리에이터
            </div>
            <div className="space-y-1">
              {predictions.slice(0, 4).map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <Link
                    href={`/channels/${p.channel_id}`}
                    className="text-th-primary hover:text-th-accent transition-colors truncate max-w-[140px]"
                  >
                    {p.channel_name}
                  </Link>
                  <span className="text-th-dim">
                    {p.days_ago != null ? `${p.days_ago}일 전` : ""} {p.prediction_type}
                  </span>
                  <span
                    className="font-medium"
                    style={{ color: VERDICT_COLORS[p.verdict] ?? "#5a6a88" }}
                    title={
                      p.verdict === "평가 전"
                        ? "평가 시점이 도래하지 않았거나 재검증 중입니다"
                        : "1개월 구간 판정"
                    }
                  >
                    {p.verdict}
                  </span>
                  {p.wilson_low != null && p.n_effective != null && (
                    <span className="text-th-dim opacity-70 tabular-nums">
                      (신뢰하한 {Math.round(p.wilson_low * 100)}% · {p.n_effective}건)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: `${conf.color}1a`, color: conf.color }}
            title={conf.hint}
          >
            {conf.label}
          </span>
          {mover.evidence.length > 0 && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-[11px] text-th-accent hover:underline"
            >
              근거 {mover.evidence.length}건 {open ? "접기" : "보기"}
            </button>
          )}
        </div>

        {/* Carried on the card itself, not just the page: these also render on
            the dashboard, where the page-level notice is absent. */}
        <p className="mt-2 pt-2 border-t border-th-border/40 text-[10px] text-th-dim leading-relaxed">
          공개 데이터 요약이며 투자 자문이 아닙니다. 원인 설명은 제공된 근거에 한해 생성됩니다.
        </p>
      </div>

      {open && (
        <div className="border-t border-th-border/50 px-5 py-3 space-y-2">
          {mover.evidence.map((e) => {
            const meta = EVIDENCE_META[e.type] ?? { label: e.type, color: "#5a6a88" }
            const external = e.source_url?.startsWith("http")
            return (
              <div key={e.n} className="flex items-start gap-2 text-[11px]">
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded text-[9px]"
                  style={{ background: `${meta.color}1a`, color: meta.color }}
                >
                  {meta.label}
                </span>
                <span className="text-th-secondary flex-1">{e.summary}</span>
                {e.source_url &&
                  (external ? (
                    <a
                      href={e.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-th-accent hover:underline"
                    >
                      원문
                    </a>
                  ) : (
                    <Link href={e.source_url} className="shrink-0 text-th-accent hover:underline">
                      보기
                    </Link>
                  ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
