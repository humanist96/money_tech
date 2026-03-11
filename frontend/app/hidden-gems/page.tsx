import { getHiddenGemChannels } from "@/lib/queries"
import { HiddenGemsPanel } from "@/components/features/hidden-gems"

export const dynamic = "force-dynamic"

export default async function HiddenGemsPage() {
  let channels: Awaited<ReturnType<typeof getHiddenGemChannels>> = []
  try {
    channels = await getHiddenGemChannels()
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
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-th-primary glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
                숨은 보석 채널
              </h1>
            </div>
            <p className="text-th-dim text-sm max-w-lg">
              구독자는 적지만 적중률이 높은 채널을 발견하세요. 대형 채널의 후행적 정보 대신 선행적 인사이트를 제공합니다.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-th-dim">
            <span className="w-2 h-2 rounded-full bg-[#00e8b8] pulse-dot" />
            <span className="tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
              {channels.length}
            </span>
            <span>채널 발견</span>
          </div>
        </div>
      </div>

      <HiddenGemsPanel channels={channels} />
    </div>
  )
}
