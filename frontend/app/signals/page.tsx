import { getContrarianSignals, getMarketSentimentGauge, getRiskScoreboard, getEnhancedBuzzAlerts } from "@/lib/queries"
import { ContrarianSignalPanel } from "@/components/features/contrarian-signal"
import { MarketGaugePanel } from "@/components/features/market-gauge"
import { RiskScoreboard } from "@/components/features/risk-scoreboard"
import { EnhancedBuzzAlertPanel } from "@/components/features/enhanced-buzz-alert"

export const dynamic = "force-dynamic"

export default async function SignalsPage() {
  let signals: Awaited<ReturnType<typeof getContrarianSignals>> = []
  let gauge: Awaited<ReturnType<typeof getMarketSentimentGauge>> = {
    overall_score: 50, category_scores: [], historical_extremes: [], current_warning: null,
  }
  let risks: Awaited<ReturnType<typeof getRiskScoreboard>> = []
  let buzzAlerts: Awaited<ReturnType<typeof getEnhancedBuzzAlerts>> = []

  try {
    ;[signals, gauge, risks, buzzAlerts] = await Promise.all([
      getContrarianSignals(30, 75),
      getMarketSentimentGauge(),
      getRiskScoreboard(14),
      getEnhancedBuzzAlerts(48),
    ])
  } catch {
    // fallback
  }

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff5757]/20 to-[#ffb84d]/5 border border-[#ff5757]/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-th-primary glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
                투자 시그널
              </h1>
            </div>
            <p className="text-th-dim text-sm max-w-lg">
              시장 온도계, 역발상 시그널, 떡상 조기경보, 종목별 리스크 스코어를 한 눈에 확인하세요.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <MarketGaugePanel data={gauge} />
        </div>
        <div className="lg:col-span-2">
          <ContrarianSignalPanel signals={signals} />
        </div>
      </div>

      {/* Enhanced Buzz Alert */}
      <EnhancedBuzzAlertPanel alerts={buzzAlerts} />

      <RiskScoreboard scores={risks} />
    </div>
  )
}
