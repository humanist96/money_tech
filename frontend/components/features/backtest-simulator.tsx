"use client"

import { useState } from "react"
import type { BacktestResult, BacktestTrade } from "@/lib/types"

interface BacktestSimulatorProps {
  channels: { id: string; name: string; thumbnail_url: string | null; category: string }[]
}

function formatMoney(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만`
  return n.toLocaleString()
}

function CumulativeReturnChart({ trades, initialAmount }: { trades: BacktestTrade[]; initialAmount: number }) {
  const evaluatedTrades = trades.filter(t => (t.return_1m ?? t.return_1w) !== null)
  if (evaluatedTrades.length < 2) return null

  let cumReturn = 0
  const dataPoints = evaluatedTrades.map((trade) => {
    const ret = trade.return_1m ?? trade.return_1w ?? 0
    const adjustedReturn = trade.prediction_type === 'sell' ? -ret : ret
    cumReturn += adjustedReturn
    return { date: trade.predicted_at, cumReturn: Math.round(cumReturn * 100) / 100 }
  })

  const maxReturn = Math.max(...dataPoints.map(d => d.cumReturn), 0)
  const minReturn = Math.min(...dataPoints.map(d => d.cumReturn), 0)
  const range = (maxReturn - minReturn) || 1

  const width = 500
  const height = 150
  const padding = { top: 20, right: 10, bottom: 25, left: 45 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const points = dataPoints.map((d, i) => ({
    x: padding.left + (i / (dataPoints.length - 1)) * chartW,
    y: padding.top + (1 - (d.cumReturn - minReturn) / range) * chartH,
    cumReturn: d.cumReturn,
    date: d.date,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const zeroY = padding.top + (1 - (0 - minReturn) / range) * chartH

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`
  const lastPoint = points[points.length - 1]
  const lineColor = lastPoint.cumReturn >= 0 ? '#22c997' : '#ff5757'

  return (
    <div>
      <h4 className="text-xs font-semibold text-th-dim mb-2">누적 수익률 차트</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 180 }}>
        {/* Zero line */}
        <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="var(--th-border)" strokeWidth="1" strokeDasharray="4 4" />
        <text x={padding.left - 5} y={zeroY + 3} textAnchor="end" fill="var(--th-text-dim)" fontSize="9">0%</text>

        {/* Y axis labels */}
        <text x={padding.left - 5} y={padding.top + 3} textAnchor="end" fill="var(--th-text-dim)" fontSize="9">
          {maxReturn > 0 ? `+${maxReturn.toFixed(0)}%` : `${maxReturn.toFixed(0)}%`}
        </text>
        <text x={padding.left - 5} y={padding.top + chartH + 3} textAnchor="end" fill="var(--th-text-dim)" fontSize="9">
          {minReturn.toFixed(0)}%
        </text>

        {/* Area fill */}
        <path d={areaD} fill={`${lineColor}10`} />

        {/* Line */}
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* End point */}
        <circle cx={lastPoint.x} cy={lastPoint.y} r="4" fill={lineColor} />
        <text x={lastPoint.x} y={lastPoint.y - 8} textAnchor="middle" fill={lineColor} fontSize="10" fontWeight="700" fontFamily="var(--font-outfit)">
          {lastPoint.cumReturn >= 0 ? '+' : ''}{lastPoint.cumReturn.toFixed(1)}%
        </text>

        {/* X axis dates */}
        {[points[0], points[Math.floor(points.length / 2)], points[points.length - 1]].map((p, i) => (
          <text key={i} x={p.x} y={height - 3} textAnchor="middle" fill="var(--th-text-dim)" fontSize="8">
            {p.date ? new Date(p.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : ''}
          </text>
        ))}
      </svg>
    </div>
  )
}

function BacktestDisplay({ result }: { result: BacktestResult }) {
  const isPositive = result.total_return_pct >= 0
  const returnColor = isPositive ? '#22c997' : '#ff5757'
  const benchmarkColor = result.benchmark_return_pct >= 0 ? '#22c997' : '#ff5757'

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-th-tertiary/60 rounded-xl p-4 text-center">
          <div className="text-[10px] text-th-dim mb-1">초기 투자금</div>
          <div className="text-sm font-bold text-th-primary tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
            {formatMoney(result.initial_amount)}원
          </div>
        </div>
        <div className="bg-th-tertiary/60 rounded-xl p-4 text-center">
          <div className="text-[10px] text-th-dim mb-1">최종 금액</div>
          <div className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-outfit)', color: returnColor }}>
            {formatMoney(result.final_amount)}원
          </div>
        </div>
        <div className="bg-th-tertiary/60 rounded-xl p-4 text-center">
          <div className="text-[10px] text-th-dim mb-1">총 수익률</div>
          <div className="text-xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-outfit)', color: returnColor }}>
            {isPositive ? '+' : ''}{result.total_return_pct.toFixed(1)}%
          </div>
        </div>
        <div className="bg-th-tertiary/60 rounded-xl p-4 text-center">
          <div className="text-[10px] text-th-dim mb-1">벤치마크 (KOSPI)</div>
          <div className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-outfit)', color: benchmarkColor }}>
            {result.benchmark_return_pct >= 0 ? '+' : ''}{result.benchmark_return_pct.toFixed(1)}%
          </div>
          <div className="text-[9px] text-th-dim mt-0.5">
            초과수익 {(result.total_return_pct - result.benchmark_return_pct) >= 0 ? '+' : ''}
            {(result.total_return_pct - result.benchmark_return_pct).toFixed(1)}%p
          </div>
        </div>
        <div className="bg-th-tertiary/60 rounded-xl p-4 text-center">
          <div className="text-[10px] text-th-dim mb-1">승률</div>
          <div className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-outfit)', color: result.win_rate >= 50 ? '#22c997' : '#ff5757' }}>
            {result.win_rate.toFixed(0)}%
          </div>
          <div className="text-[9px] text-th-dim">{result.total_trades}건 거래</div>
        </div>
      </div>

      {/* Summary text */}
      <div className="bg-th-tertiary/40 rounded-xl px-4 py-3 text-sm text-th-primary">
        <span className="font-bold">{result.channel_name}</span> 따라하기: 수익률{' '}
        <span className="font-bold" style={{ color: returnColor }}>
          {isPositive ? '+' : ''}{result.total_return_pct.toFixed(1)}%
        </span>
        {' '}(KOSPI: <span style={{ color: benchmarkColor }}>{result.benchmark_return_pct >= 0 ? '+' : ''}{result.benchmark_return_pct.toFixed(1)}%</span>)
      </div>

      {/* Max Drawdown */}
      {result.max_drawdown > 0 && (
        <div className="bg-[#ff5757]/5 border border-[#ff5757]/15 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-th-muted">최대 낙폭 (MDD)</span>
          <span className="text-sm font-bold text-[#ff5757] tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
            -{result.max_drawdown.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Cumulative Return Chart */}
      <CumulativeReturnChart trades={result.trades} initialAmount={result.initial_amount} />

      {/* Trade History */}
      {result.trades.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-th-dim mb-2">거래 내역</h4>
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {result.trades.map((trade, i) => {
              const ret = trade.return_1m ?? trade.return_1w
              const retColor = ret === null ? 'text-th-dim' : ret >= 0 ? 'text-[#22c997]' : 'text-[#ff5757]'
              const typeColor = trade.prediction_type === 'buy' ? '#22c997' : '#ff5757'

              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-th-hover/30 transition text-[11px]">
                  <span className="text-th-dim tabular-nums w-14 shrink-0">
                    {trade.predicted_at ? new Date(trade.predicted_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '-'}
                  </span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: `color-mix(in srgb, ${typeColor} 12%, transparent)`, color: typeColor }}
                  >
                    {trade.prediction_type === 'buy' ? '매수' : '매도'}
                  </span>
                  <span className="font-medium text-th-primary truncate flex-1">{trade.asset_name}</span>
                  {trade.entry_price && (
                    <span className="text-th-dim tabular-nums shrink-0">
                      {trade.entry_price.toLocaleString()}
                    </span>
                  )}
                  <span className={`font-bold tabular-nums shrink-0 ${retColor}`} style={{ fontFamily: 'var(--font-outfit)' }}>
                    {ret !== null ? `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%` : '대기'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function BacktestSimulator({ channels }: BacktestSimulatorProps) {
  const [selectedChannel, setSelectedChannel] = useState<string>('')
  const [initialAmount, setInitialAmount] = useState<number>(10000000)
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRun = async () => {
    if (!selectedChannel) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/backtest?channelId=${selectedChannel}&amount=${initialAmount}`)
      if (!res.ok) throw new Error('백테스팅 실행 실패')
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const amountOptions = [
    { label: '500만원', value: 5000000 },
    { label: '1,000만원', value: 10000000 },
    { label: '3,000만원', value: 30000000 },
    { label: '5,000만원', value: 50000000 },
    { label: '1억원', value: 100000000 },
  ]

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#7c6cf0]/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c6cf0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
              유튜버 백테스팅 시뮬레이터
            </h3>
            <p className="text-[10px] text-th-dim">이 유튜버 말만 들었다면 수익률은?</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap gap-3">
          <select
            value={selectedChannel}
            onChange={(e) => { setSelectedChannel(e.target.value); setResult(null) }}
            className="flex-1 min-w-[200px] bg-th-tertiary border border-th-border rounded-xl px-4 py-2.5 text-sm text-th-primary focus:outline-none focus:border-[#7c6cf0]/50"
          >
            <option value="">유튜버를 선택하세요</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
          <select
            value={initialAmount}
            onChange={(e) => { setInitialAmount(Number(e.target.value)); setResult(null) }}
            className="bg-th-tertiary border border-th-border rounded-xl px-4 py-2.5 text-sm text-th-primary focus:outline-none focus:border-[#7c6cf0]/50"
          >
            {amountOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={handleRun}
            disabled={!selectedChannel || loading}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #7c6cf0, #5b4dd0)',
              color: 'white',
            }}
          >
            {loading ? '분석 중...' : '시뮬레이션 실행'}
          </button>
        </div>

        {error && (
          <div className="bg-[#ff5757]/10 border border-[#ff5757]/20 rounded-xl px-4 py-2.5 text-xs text-[#ff5757]">
            {error}
          </div>
        )}

        {result && <BacktestDisplay result={result} />}
      </div>
    </div>
  )
}
