import { notFound } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { Channel, VideoWithChannel } from "@/lib/types"
import { CATEGORY_LABELS } from "@/lib/types"
import { formatViewCount } from "@/lib/queries"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VideoFeed } from "@/components/dashboard/video-feed"

export const dynamic = "force-dynamic"
export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

async function getChannelData(id: string) {
  const [channelRes, videosRes] = await Promise.all([
    supabase.from("channels").select("*").eq("id", id).single(),
    supabase
      .from("videos")
      .select("*, channels(name, category, thumbnail_url)")
      .eq("channel_id", id)
      .order("published_at", { ascending: false })
      .limit(50),
  ])

  return {
    channel: channelRes.data as Channel | null,
    videos: (videosRes.data ?? []) as unknown as VideoWithChannel[],
  }
}

export default async function ChannelDetailPage({ params }: PageProps) {
  const { id } = await params
  const { channel, videos } = await getChannelData(id)

  if (!channel) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        {channel.thumbnail_url ? (
          <img
            src={channel.thumbnail_url}
            alt={channel.name}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold">
            {channel.name[0]}
          </div>
        )}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{channel.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge>{CATEGORY_LABELS[channel.category]}</Badge>
            <a
              href={`https://www.youtube.com/channel/${channel.youtube_channel_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:underline"
            >
              YouTube
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              구독자 수
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatViewCount(channel.subscriber_count)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              총 조회수
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatViewCount(channel.total_view_count)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              영상 수
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{channel.video_count ?? "-"}</p>
          </CardContent>
        </Card>
      </div>

      {channel.description && (
        <Card>
          <CardHeader>
            <CardTitle>채널 소개</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {channel.description}
            </p>
          </CardContent>
        </Card>
      )}

      <VideoFeed videos={videos} title={`${channel.name}의 영상`} />
    </div>
  )
}
