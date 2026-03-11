import { getPredictorChannels } from "@/lib/queries"
import { BacktestSimulator } from "@/components/features/backtest-simulator"

export const dynamic = "force-dynamic"

export default async function BacktestPage() {
  let channels: { id: string; name: string; thumbnail_url: string | null; category: string }[] = []
  try {
    const predictors = await getPredictorChannels()
    channels = predictors.map(c => ({
      id: c.id,
      name: c.name,
      thumbnail_url: c.thumbnail_url,
      category: c.category,
    }))
  } catch {
    // fallback
  }

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c6cf0]/20 to-[#7c6cf0]/5 border border-[#7c6cf0]/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c6cf0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-th-primary glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
                유튜버 백테스팅
              </h1>
            </div>
            <p className="text-th-dim text-sm max-w-lg">
              특정 유튜버의 과거 추천을 그대로 따랐을 때의 가상 수익률을 계산합니다.
              초기 투자금 1,000만원 기준으로 시뮬레이션합니다.
            </p>
          </div>
        </div>
      </div>

      <BacktestSimulator channels={channels} />
    </div>
  )
}
