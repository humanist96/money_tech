import { getConflictingOpinions } from "@/lib/queries"
import { ConflictsClient } from "./conflicts-client"

export const revalidate = 1800

export default async function ConflictsPage() {
  let conflicts: Awaited<ReturnType<typeof getConflictingOpinions>> = []
  try {
    conflicts = await getConflictingOpinions(14)
  } catch {
    // fallback
  }

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff5757]/20 to-[#ffb84d]/10 border border-[#ff5757]/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20L10 4" stroke="#ff5757" />
                  <path d="M20 20L14 4" stroke="#ffb84d" />
                  <path d="M2 16h6" stroke="#ff5757" />
                  <path d="M16 16h6" stroke="#ffb84d" />
                  <circle cx="12" cy="12" r="2" stroke="#ff5757" fill="#ff5757" fillOpacity="0.3" />
                </svg>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-th-primary glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
                의견 충돌 감지
              </h1>
            </div>
            <p className="text-th-dim text-sm max-w-lg">
              같은 종목에 대해 크리에이터들이 상반된 의견을 내고 있는 종목을 찾아냅니다
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-th-dim">
            <span className="w-2 h-2 rounded-full bg-[#ff5757] pulse-dot" />
            <span className="tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
              {conflicts.length}
            </span>
            <span>건 감지</span>
          </div>
        </div>
      </div>

      <ConflictsClient conflicts={conflicts} />
    </div>
  )
}
