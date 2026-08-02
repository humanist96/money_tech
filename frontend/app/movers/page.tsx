import { getLatestMoversDate, getMoversByDate } from "@/lib/queries"
import { MoversClient } from "./movers-client"

export const dynamic = "force-dynamic"

export default async function MoversPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams

  let tradeDate: string | null = null
  let movers: Awaited<ReturnType<typeof getMoversByDate>> = []

  try {
    // Falling back to the latest stored session means holidays need no special
    // case: there simply is no newer row.
    tradeDate = params.date ?? (await getLatestMoversDate())
    if (tradeDate) {
      movers = await getMoversByDate(tradeDate)
    }
  } catch (e) {
    console.error("[Movers] load failed:", e instanceof Error ? e.message : e)
  }

  // "어제"라고 부를 수 있는 건 직전 거래일 데이터일 때뿐이다. 파이프라인이
  // 한 세션을 거르거나(휴장·크론 실패) 당일 16:40 배치가 막 돌았을 때는
  // 날짜를 밝힌다 — 어느 쪽이든 "어제"는 사실이 아니다.
  const headingLabel = (() => {
    if (!tradeDate) return "등락 원인 분석"
    const days = Math.round((Date.now() - new Date(tradeDate).getTime()) / 86400000)
    if (days === 1) return "어제 왜 움직였나"
    if (days === 0) return "오늘 왜 움직였나"
    return `${tradeDate.slice(5).replace("-", "/")} 왜 움직였나`
  })()

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b82f6]/20 to-[#3b82f6]/5 border border-[#3b82f6]/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-th-primary glow-text" style={{ fontFamily: "var(--font-outfit)" }}>
                {headingLabel}
              </h1>
            </div>
            <p className="text-th-dim text-sm max-w-2xl">
              크게 움직인 종목의 원인을 공시·수급·뉴스로 정리하고,
              <strong className="text-th-secondary"> 우리가 추적하는 크리에이터가 그 종목을 미리 뭐라고 했는지</strong>까지 함께 보여줍니다.
            </p>
          </div>
          {tradeDate && (
            <div className="hidden sm:block text-right">
              <div className="text-[10px] text-th-dim">기준일</div>
              <div className="text-sm font-bold text-th-primary tabular-nums" style={{ fontFamily: "var(--font-outfit)" }}>
                {tradeDate}
              </div>
            </div>
          )}
        </div>
      </div>

      <MoversClient movers={movers} tradeDate={tradeDate} />

      <p className="text-[11px] text-th-dim leading-relaxed border-t border-th-border/50 pt-4">
        본 정보는 공시·시세 등 공개 데이터의 요약이며, 특정 종목의 매수·매도를 권유하는 투자 자문이 아닙니다.
        원인 설명은 제공된 근거에 한해 생성되며, 근거가 없으면 &lsquo;공개 요인 미확인&rsquo;으로 표시됩니다.
        투자의 최종 판단과 책임은 투자자 본인에게 있습니다.
      </p>
    </div>
  )
}
