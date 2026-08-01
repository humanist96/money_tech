import {
  getHitRateLeaderboard, getChannelTypeStats, getWeeklyReport, getHiddenGemChannels,
} from "@/lib/queries"
import { LeaderboardTabs } from "./leaderboard-tabs"

export const dynamic = "force-dynamic"

async function safeQuery<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    console.error(`[Leaderboard] ${name} failed:`, e instanceof Error ? e.message : e)
    return fallback
  }
}

export default async function LeaderboardPage() {
  const [leaderboard, typeStats, weekly, hiddenGems] = await Promise.all([
    safeQuery("getHitRateLeaderboard", () => getHitRateLeaderboard(), []),
    safeQuery("getChannelTypeStats", () => getChannelTypeStats(), []),
    safeQuery("getWeeklyReport", () => getWeeklyReport(), {
      winners: [], losers: [], bestCall: null, worstCall: null,
    }),
    safeQuery("getHiddenGemChannels", () => getHiddenGemChannels(), []),
  ])

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

      <LeaderboardTabs
        leaderboard={leaderboard}
        typeStats={typeStats}
        weekly={weekly}
        hiddenGems={hiddenGems}
      />
    </div>
  )
}
