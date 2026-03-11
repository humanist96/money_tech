import { getDailyBriefingData } from "@/lib/queries"
import { DailyBriefingPanel } from "@/components/features/daily-briefing"

export const dynamic = "force-dynamic"

export default async function BriefingPage() {
  let briefing = {
    topMentioned: [] as any[], conflicts: [] as any[],
    newRecommendations: [] as any[], temperature: [] as any[],
  }
  try {
    briefing = await getDailyBriefingData()
  } catch {
    // fallback
  }

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00e8b8]/20 to-[#00e8b8]/5 border border-[#00e8b8]/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e8b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-th-primary glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
                AI 일일 브리핑
              </h1>
            </div>
            <p className="text-th-dim text-sm max-w-lg">
              어제 업로드된 재테크 영상 핵심 내용을 AI가 종합 요약합니다. 10개 채널 볼 시간을 3분으로 압축하세요.
            </p>
          </div>
        </div>
      </div>

      <DailyBriefingPanel
        topMentioned={briefing.topMentioned}
        conflicts={briefing.conflicts}
        newRecommendations={briefing.newRecommendations}
        temperature={briefing.temperature}
      />
    </div>
  )
}
