"use client"

interface PredictionRecord {
  asset_name: string
  asset_code: string
  prediction_type: string
  predicted_at: string
  price_at_mention: number | null
  actual_price: number | null
  is_accurate: boolean | null
  direction_1w: boolean | null
  direction_1m: boolean | null
  direction_3m: boolean | null
  direction_score: number | null
}

interface HitRateCardProps {
  hitRate: number | null
  totalPredictions: number
  accurateCount: number
  recentPredictions: PredictionRecord[]
  dir1wCorrect?: number
  dir1wTotal?: number
  dir1mCorrect?: number
  dir1mTotal?: number
}

function DirectionBadge({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-[9px] text-th-dim">-</span>
  return value
    ? <span className="text-[9px] text-[#22c997]">&#x2191;</span>
    : <span className="text-[9px] text-[#ff5757]">&#x2193;</span>
}

export function HitRateCard({ hitRate, totalPredictions, accurateCount, recentPredictions, dir1wCorrect, dir1wTotal, dir1mCorrect, dir1mTotal }: HitRateCardProps) {
  const rate = hitRate !== null ? Math.round(hitRate * 100) : null
  const rateColor = rate !== null
    ? rate >= 60 ? '#22c997' : rate >= 40 ? '#ffb84d' : '#ff5757'
    : 'var(--th-text-dim)'

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
          방향 적중률
        </h3>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-6 mb-6">
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="var(--th-border)" strokeWidth="3"
              />
              {rate !== null && (
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke={rateColor} strokeWidth="3"
                  strokeDasharray={`${rate}, 100`}
                  strokeLinecap="round"
                />
              )}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-extrabold tabular-nums" style={{ color: rateColor, fontFamily: 'var(--font-outfit)' }}>
                {rate !== null ? `${rate}%` : '-'}
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs text-th-dim">방향 예측 정확률</p>
            <div className="flex items-center gap-3 mt-2 text-xs tabular-nums">
              <span className="text-[#22c997]">적중 {accurateCount}건</span>
              <span className="text-[#ff5757]">빗나감 {totalPredictions - accurateCount}건</span>
            </div>
            {dir1wTotal !== undefined && dir1wTotal > 0 && (
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-th-muted tabular-nums">
                <span>1주 {dir1wCorrect}/{dir1wTotal}</span>
                <span>1월 {dir1mCorrect}/{dir1mTotal}</span>
              </div>
            )}
          </div>
        </div>

        {recentPredictions.length > 0 && (
          <div>
            <h4 className="text-[10px] text-th-dim uppercase tracking-wider font-medium mb-2">최근 예측</h4>
            <div className="space-y-1.5">
              {recentPredictions.slice(0, 5).map((p, i) => {
                const priceChange = p.price_at_mention && p.actual_price
                  ? ((p.actual_price - p.price_at_mention) / p.price_at_mention * 100).toFixed(1)
                  : null
                const isPositive = priceChange !== null && parseFloat(priceChange) > 0
                const score = p.direction_score
                return (
                  <div key={i} className="flex items-center justify-between bg-th-tertiary/50 rounded-xl px-3.5 py-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${p.prediction_type === 'buy' ? 'bg-[#22c997]/12 text-[#22c997]' : 'bg-[#ff5757]/12 text-[#ff5757]'}`}>
                        {p.prediction_type === 'buy' ? 'B' : 'S'}
                      </span>
                      <span className="text-th-primary font-medium">{p.asset_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        <DirectionBadge value={p.direction_1w} />
                        <DirectionBadge value={p.direction_1m} />
                        <DirectionBadge value={p.direction_3m} />
                      </div>
                      {priceChange !== null && (
                        <span className={`tabular-nums font-medium ${isPositive ? 'text-[#22c997]' : 'text-[#ff5757]'}`}>
                          {isPositive ? '+' : ''}{priceChange}%
                        </span>
                      )}
                      {score !== null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                          score >= 0.5
                            ? 'bg-[#22c997]/12 text-[#22c997]'
                            : 'bg-[#ff5757]/12 text-[#ff5757]'
                        }`}>
                          {score >= 0.5 ? '적중' : '빗나감'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {totalPredictions === 0 && (
          <p className="text-sm text-th-dim">아직 평가된 예측이 없습니다.</p>
        )}
      </div>
    </div>
  )
}
