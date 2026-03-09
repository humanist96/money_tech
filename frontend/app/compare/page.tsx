import { getChannels } from "@/lib/queries"
import { ChannelComparison } from "./channel-comparison"

export const dynamic = "force-dynamic"

export default async function ComparePage() {
  const channels = await getChannels()

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffb84d]/20 to-[#ffb84d]/5 border border-[#ffb84d]/20 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffb84d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
            채널 비교
          </h1>
        </div>
        <p className="text-[#5a6a88] text-sm">2~3개 채널의 주요 지표를 나란히 비교합니다</p>
      </div>
      <ChannelComparison channels={channels} />
    </div>
  )
}
