"use client"

interface PredictionRecord {
  asset_name: string
  asset_code: string
  prediction_type: string
  predicted_at: string
  price_at_mention: number | null
  actual_price: number | null
  is_accurate: boolean | null
}

interface HitRateCardProps {
  hitRate: number | null
  totalPredictions: number
  accurateCount: number
  recentPredictions: PredictionRecord[]
}

export function HitRateCard({ hitRate, totalPredictions, accurateCount, recentPredictions }: HitRateCardProps) {
  const rate = hitRate !== null ? Math.round(hitRate * 100) : null
  const rateColor = rate !== null
    ? rate >= 60 ? '#22c997' : rate >= 40 ? '#ffb84d' : '#ff5757'
    : '#5a6a88'

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1a2744]/50">
        <h3 className="font-bold text-white text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
          적중률 스코어카드
        </h3>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-6 mb-6">
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="#1a2744" strokeWidth="3"
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
            <p className="text-xs text-[#5a6a88]">최근 3개월 적중률</p>
            <div className="flex items-center gap-3 mt-2 text-xs tabular-nums">
              <span className="text-[#22c997]">적중 {accurateCount}건</span>
              <span className="text-[#ff5757]">미적중 {totalPredictions - accurateCount}건</span>
            </div>
          </div>
        </div>

        {recentPredictions.length > 0 && (
          <div>
            <h4 className="text-[10px] text-[#5a6a88] uppercase tracking-wider font-medium mb-2">최근 추천 종목</h4>
            <div className="space-y-1.5">
              {recentPredictions.slice(0, 5).map((p, i) => {
                const priceChange = p.price_at_mention && p.actual_price
                  ? ((p.actual_price - p.price_at_mention) / p.price_at_mention * 100).toFixed(1)
                  : null
                const isPositive = priceChange !== null && parseFloat(priceChange) > 0
                return (
                  <div key={i} className="flex items-center justify-between bg-[#0e1a30]/50 rounded-xl px-3.5 py-2.5 text-xs">
                    <span className="text-white font-medium">{p.asset_name}</span>
                    <div className="flex items-center gap-2">
                      {priceChange !== null && (
                        <span className={`tabular-nums font-medium ${isPositive ? 'text-[#22c997]' : 'text-[#ff5757]'}`}>
                          {isPositive ? '+' : ''}{priceChange}%
                        </span>
                      )}
                      {p.is_accurate !== null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                          p.is_accurate
                            ? 'bg-[#22c997]/12 text-[#22c997]'
                            : 'bg-[#ff5757]/12 text-[#ff5757]'
                        }`}>
                          {p.is_accurate ? '적중' : '미적중'}
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
          <p className="text-sm text-[#5a6a88]">아직 평가된 예측이 없습니다.</p>
        )}
      </div>
    </div>
  )
}
