import { getChannels } from "@/lib/queries"
import { ChannelComparison } from "./channel-comparison"

export const dynamic = "force-dynamic"

export default async function ComparePage() {
  const channels = await getChannels()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-white glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
          채널 비교
        </h1>
        <p className="text-[#64748b] mt-1.5 text-sm">2~3개 채널의 주요 지표를 나란히 비교합니다</p>
      </div>
      <ChannelComparison channels={channels} />
    </div>
  )
}
