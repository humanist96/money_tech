import { getChannels } from "@/lib/queries"
import type { Channel } from "@/lib/types"
import { ChannelList } from "./channel-list"

export const dynamic = "force-dynamic"

export default async function ChannelsPage() {
  let channels: Channel[]
  try {
    channels = await getChannels()
  } catch {
    channels = []
  }

  return (
    <div className="space-y-8">
      {/* Page hero */}
      <div className="relative">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00e8b8]/20 to-[#00e8b8]/5 border border-[#00e8b8]/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e8b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-th-primary glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
                채널 탐색
              </h1>
            </div>
            <p className="text-th-dim text-sm max-w-md">
              재테크 유튜브 채널과 네이버 블로거를 검색하고 다양한 지표로 비교하세요
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-th-dim">
            <span className="w-2 h-2 rounded-full bg-[#00e8b8] pulse-dot" />
            <span className="tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
              {channels.length}
            </span>
            <span>채널 모니터링 중</span>
          </div>
        </div>
      </div>

      <ChannelList channels={channels} />
    </div>
  )
}
