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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">채널 목록</h1>
        <p className="text-muted-foreground">모니터링 중인 재테크 유튜브 채널</p>
      </div>
      <ChannelList channels={channels} />
    </div>
  )
}
