import { getCrowdSentimentLatest } from "@/lib/queries"
import { CrowdDashboard } from "./crowd-dashboard"

export const dynamic = "force-dynamic"

export default async function CrowdPage() {
  let sentiments: Awaited<ReturnType<typeof getCrowdSentimentLatest>> = []
  try {
    sentiments = await getCrowdSentimentLatest(30)
  } catch {
    // fallback to empty
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-th-primary" style={{ fontFamily: 'var(--font-outfit)' }}>
          개미 심리 대시보드
        </h1>
        <p className="text-sm text-th-dim mt-1">
          네이버 종목토론방 실시간 군중 심리 분석
        </p>
      </div>
      <CrowdDashboard sentiments={sentiments} />
    </div>
  )
}
