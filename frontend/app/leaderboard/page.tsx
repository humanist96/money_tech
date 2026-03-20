import { getHitRateLeaderboard, getChannelTypeStats } from "@/lib/queries"
import { LeaderboardClient } from "./leaderboard-client"

export const revalidate = 3600

export default async function LeaderboardPage() {
  let leaderboard: Awaited<ReturnType<typeof getHitRateLeaderboard>> = []
  let typeStats: Awaited<ReturnType<typeof getChannelTypeStats>> = []
  try {
    ;[leaderboard, typeStats] = await Promise.all([
      getHitRateLeaderboard(),
      getChannelTypeStats(),
    ])
  } catch {
    // fallback to empty
  }

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f97316]/20 to-[#f97316]/5 border border-[#f97316]/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-th-primary glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
                적중률 리더보드
              </h1>
            </div>
            <p className="text-th-dim text-sm max-w-lg">
              투자 예측을 하는 크리에이터들의 예측 건수와 근거 콘텐츠를 확인하세요. 각 행을 클릭하면 원본 레퍼런스를 볼 수 있습니다.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-th-dim">
            <span className="w-2 h-2 rounded-full bg-[#f97316] pulse-dot" />
            <span className="tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
              {leaderboard.length}
            </span>
            <span>예측 채널</span>
          </div>
        </div>
      </div>

      <LeaderboardClient leaderboard={leaderboard} typeStats={typeStats} />
    </div>
  )
}
