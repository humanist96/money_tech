import { supabase } from "@/lib/supabase"
import type { Channel } from "@/lib/types"
import { ChannelList } from "./channel-list"

export const dynamic = "force-dynamic"
export const revalidate = 3600

async function getChannels(): Promise<Channel[]> {
  try {
    const { data } = await supabase
      .from("channels")
      .select("*")
      .order("subscriber_count", { ascending: false })

    return (data ?? []) as Channel[]
  } catch {
    return []
  }
}

export default async function ChannelsPage() {
  const channels = await getChannels()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">채널 목록</h1>
        <p className="text-muted-foreground">
          모니터링 중인 재테크 유튜브 채널
        </p>
      </div>
      <ChannelList channels={channels} />
    </div>
  )
}
