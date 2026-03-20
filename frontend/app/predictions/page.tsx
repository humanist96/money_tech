import { getActivePredictions } from "@/lib/queries"
import { PredictionsClient } from "./predictions-client"

export const revalidate = 1800

export default async function PredictionsPage() {
  let predictions: Awaited<ReturnType<typeof getActivePredictions>> = []
  try {
    predictions = await getActivePredictions(30)
  } catch {
    // fallback to empty
  }

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#a855f7]/20 to-[#a855f7]/5 border border-[#a855f7]/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-th-primary glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
                예측 트래커
              </h1>
            </div>
            <p className="text-th-dim text-sm max-w-lg">
              크리에이터들의 실시간 예측 진행 상황을 추적합니다
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-th-dim">
            <span className="w-2 h-2 rounded-full bg-[#a855f7] pulse-dot" />
            <span className="tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
              {predictions.length}
            </span>
            <span>활성 예측</span>
          </div>
        </div>
      </div>

      <PredictionsClient predictions={predictions} />
    </div>
  )
}
