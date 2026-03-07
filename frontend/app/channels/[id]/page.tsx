import { notFound } from "next/navigation"
import { getChannelById, getVideosByChannelId, formatViewCount } from "@/lib/queries"
import { CATEGORY_LABELS } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VideoFeed } from "@/components/dashboard/video-feed"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ChannelDetailPage({ params }: PageProps) {
  const { id } = await params
  const [channel, videos] = await Promise.all([
    getChannelById(id),
    getVideosByChannelId(id),
  ])

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
            <CardTitle className="text-sm font-medium text-muted-foreground">구독자 수</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatViewCount(channel.subscriber_count)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 조회수</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatViewCount(channel.total_view_count)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">영상 수</CardTitle>
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
            <p className="text-sm text-muted-foreground whitespace-pre-line">{channel.description}</p>
          </CardContent>
        </Card>
      )}

      <VideoFeed videos={videos} title={`${channel.name}의 영상`} />
    </div>
  )
}
