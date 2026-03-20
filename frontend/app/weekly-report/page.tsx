import { getWeeklyReport } from "@/lib/queries"
import { WeeklyReportPanel } from "@/components/features/weekly-report"

export const revalidate = 3600

export default async function WeeklyReportPage() {
  let report = { winners: [] as any[], losers: [] as any[], bestCall: null as any, worstCall: null as any }
  try {
    report = await getWeeklyReport()
  } catch {
    // fallback
  }

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffb84d]/20 to-[#ffb84d]/5 border border-[#ffb84d]/20 flex items-center justify-center text-lg">
                &#x1F3C6;
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-th-primary glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
                주간 적중왕 리포트
              </h1>
            </div>
            <p className="text-th-dim text-sm max-w-lg">
              이번 주 가장 잘 맞힌 크리에이터와 가장 아쉬웠던 크리에이터, 최고/최악의 콜을 확인하세요.
            </p>
          </div>
        </div>
      </div>

      <WeeklyReportPanel
        winners={report.winners}
        losers={report.losers}
        bestCall={report.bestCall}
        worstCall={report.worstCall}
      />
    </div>
  )
}
