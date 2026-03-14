"use client"

import type { AnalystConsensus } from "@/lib/types"

interface AnalystConsensusCardProps {
  consensus: AnalystConsensus
  currentPrice?: number | null
}

function formatPrice(price: number | null | undefined): string {
  if (price == null) return "-"
  return price.toLocaleString("ko-KR") + "원"
}

export function AnalystConsensusCard({ consensus, currentPrice }: AnalystConsensusCardProps) {
  const totalOpinions = consensus.buy_count + consensus.sell_count + consensus.hold_count
  const buyPct = totalOpinions > 0 ? (consensus.buy_count / totalOpinions) * 100 : 0
  const sellPct = totalOpinions > 0 ? (consensus.sell_count / totalOpinions) * 100 : 0
  const holdPct = totalOpinions > 0 ? (consensus.hold_count / totalOpinions) * 100 : 0

  // Gap between current price and average target
  const gap = currentPrice && consensus.avg_target_price
    ? ((consensus.avg_target_price - currentPrice) / currentPrice) * 100
    : null

  return (
    <div className="glass-card-elevated rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
          애널리스트 컨센서스
        </h3>
        <span className="text-[11px] text-th-dim">
          {consensus.firm_count}개 증권사
        </span>
      </div>

      {/* Target Price Range */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-th-dim">평균 목표가</span>
          <span className="text-lg font-bold text-th-primary tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
            {formatPrice(consensus.avg_target_price)}
          </span>
        </div>

        {gap !== null && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-th-dim">현재가 대비</span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: gap >= 0 ? '#22c997' : '#ff5757' }}
            >
              {gap >= 0 ? '+' : ''}{gap.toFixed(1)}%
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="text-center">
            <p className="text-[10px] text-th-dim">최저</p>
            <p className="text-[12px] font-semibold text-th-muted tabular-nums">
              {formatPrice(consensus.min_target_price)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-th-dim">중앙</p>
            <p className="text-[12px] font-semibold text-th-muted tabular-nums">
              {formatPrice(consensus.median_target_price)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-th-dim">최고</p>
            <p className="text-[12px] font-semibold text-th-muted tabular-nums">
              {formatPrice(consensus.max_target_price)}
            </p>
          </div>
        </div>
      </div>

      {/* Opinion Distribution Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-th-dim">
          <span>투자의견 분포</span>
          <span>{totalOpinions}건</span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          {buyPct > 0 && (
            <div
              className="rounded-l-full"
              style={{ width: `${buyPct}%`, background: '#22c997' }}
              title={`매수 ${consensus.buy_count}건`}
            />
          )}
          {holdPct > 0 && (
            <div
              style={{ width: `${holdPct}%`, background: '#7c6cf0' }}
              title={`중립 ${consensus.hold_count}건`}
            />
          )}
          {sellPct > 0 && (
            <div
              className="rounded-r-full"
              style={{ width: `${sellPct}%`, background: '#ff5757' }}
              title={`매도 ${consensus.sell_count}건`}
            />
          )}
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span style={{ color: '#22c997' }}>매수 {consensus.buy_count}</span>
          <span style={{ color: '#7c6cf0' }}>중립 {consensus.hold_count}</span>
          <span style={{ color: '#ff5757' }}>매도 {consensus.sell_count}</span>
        </div>
      </div>

      {/* Firm-by-Firm Table */}
      {consensus.recommendations.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-th-dim uppercase tracking-wider font-medium">증권사별 의견</p>
          <div className="divide-y divide-th-border/30">
            {consensus.recommendations.slice(0, 8).map((rec, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 text-[11px]">
                <span className="text-th-muted font-medium">{rec.firm_name}</span>
                <div className="flex items-center gap-3">
                  <span
                    className="font-bold"
                    style={{
                      color: rec.recommendation === 'buy' ? '#22c997'
                        : rec.recommendation === 'sell' ? '#ff5757' : '#7c6cf0'
                    }}
                  >
                    {rec.recommendation === 'buy' ? '매수' : rec.recommendation === 'sell' ? '매도' : '중립'}
                  </span>
                  {rec.target_price && (
                    <span className="text-th-dim tabular-nums">{rec.target_price.toLocaleString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
