import { getAssetConsensus, getPredictorChannels } from "@/lib/queries"
import { ConsensusClient } from "./consensus-client"

export const dynamic = "force-dynamic"

export default async function ConsensusPage() {
  let consensus: Awaited<ReturnType<typeof getAssetConsensus>> = []
  let predictorChannels: Awaited<ReturnType<typeof getPredictorChannels>> = []
  try {
    ;[consensus, predictorChannels] = await Promise.all([
      getAssetConsensus(30),
      getPredictorChannels(),
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#22c997]/20 to-[#22c997]/5 border border-[#22c997]/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c997" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
                종목 컨센서스
              </h1>
            </div>
            <p className="text-[#5a6a88] text-sm max-w-lg">
              예측형/리딩방 채널들의 종목별 의견 일치도. 여러 유튜버가 동일 종목을 언급할 때 매수/매도/보유 의견 분포를 보여줍니다.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#3a4a6a]">
            <span className="w-2 h-2 rounded-full bg-[#22c997] pulse-dot" />
            <span className="tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
              {consensus.length}
            </span>
            <span>종목 분석 중</span>
          </div>
        </div>
      </div>

      <ConsensusClient consensus={consensus} predictorCount={predictorChannels.length} />
    </div>
  )
}
