"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { VideoWithChannel } from "@/lib/types"
import { CATEGORY_LABELS } from "@/lib/types"
import { formatViewCount, formatDuration, timeAgo } from "@/lib/queries"

interface VideoFeedProps {
  videos: VideoWithChannel[]
  title?: string
}

export function VideoFeed({ videos, title = "최신 영상" }: VideoFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className="flex gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              {video.thumbnail_url && (
                <a
                  href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="h-20 w-36 rounded object-cover"
                  />
                </a>
              )}
              <div className="flex flex-col gap-1 min-w-0">
                <a
                  href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm leading-tight hover:underline line-clamp-2"
                >
                  {video.title}
                </a>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {video.channels && (
                    <Link
                      href={`/channels/${video.channel_id}`}
                      className="hover:underline"
                    >
                      {video.channels.name}
                    </Link>
                  )}
                  {video.channels?.category && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      {CATEGORY_LABELS[video.channels.category]}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>조회수 {formatViewCount(video.view_count)}</span>
                  <span>{formatDuration(video.duration)}</span>
                  <span>{timeAgo(video.published_at)}</span>
                </div>
              </div>
            </div>
          ))}
          {videos.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              데이터를 수집 중입니다...
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
