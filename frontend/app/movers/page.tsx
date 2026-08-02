import { getMoversByDate } from "@/lib/queries"
import { moversHeading } from "@/lib/movers-label"
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
    movers = await getMoversByDate(params.date ?? null)
    tradeDate = params.date ?? movers[0]?.trade_date ?? null
  } catch (e) {
    console.error("[Movers] load failed:", e instanceof Error ? e.message : e)
  }

  // 요청 파라미터가 아니라 **실제로 반환된 행**의 날짜로 라벨을 만든다.
  // ?date=로 빈 날짜를 조회했을 때 제목만 "어제"로 단언하는 것이
  // 이 라벨이 막으려던 거짓말이다.
  const headingLabel = moversHeading(movers[0]?.trade_date ?? null, "등락 원인 분석")

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
