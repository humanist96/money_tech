import { getChannels } from "@/lib/queries"
import { YouTuberPortfolio } from "@/components/features/youtuber-portfolio"

export const dynamic = "force-dynamic"

export default async function PortfolioPage() {
  let channels: Awaited<ReturnType<typeof getChannels>> = []
  try {
    channels = await getChannels()
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
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-th-primary glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
                나만의 유튜버 포트폴리오
              </h1>
            </div>
            <p className="text-th-dim text-sm max-w-lg">
              신뢰하는 유튜버를 선택하면 종합 적중률, 의견 충돌 알림, 최신 예측을 맞춤형으로 제공합니다.
              선택한 유튜버는 브라우저에 저장됩니다.
            </p>
          </div>
        </div>
      </div>

      <YouTuberPortfolio allChannels={channels} />
    </div>
  )
}
