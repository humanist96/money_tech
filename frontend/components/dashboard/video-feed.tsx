"use client"

import Link from "next/link"
import type { VideoWithChannel } from "@/lib/types"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"
import { formatViewCount, formatDuration, timeAgo } from "@/lib/queries"

interface VideoFeedProps {
  videos: VideoWithChannel[]
  title?: string
}

export function VideoFeed({ videos, title = "최신 영상" }: VideoFeedProps) {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e293b]/60">
        <h3 className="font-semibold text-white" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
      </div>
      <div className="divide-y divide-[#1e293b]/30">
        {videos.map((video) => {
          const catColor = video.channels ? CATEGORY_COLORS[video.channels.category] : "#64748b"
          return (
            <div key={video.id} className="px-6 py-4 hover:bg-[#1e293b]/15 transition-colors">
              <div className="flex gap-4">
                {video.thumbnail_url ? (
                  <a
                    href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 relative group"
                  >
                    <img
                      src={video.thumbnail_url}
                      alt=""
                      className="h-[72px] w-[128px] rounded-lg object-cover brightness-90 group-hover:brightness-100 transition"
                    />
                    {video.duration && (
                      <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white px-1.5 py-0.5 rounded font-medium tabular-nums">
                        {formatDuration(video.duration)}
                      </span>
                    )}
                  </a>
                ) : (
                  <div className="h-[72px] w-[128px] rounded-lg bg-[#111d35] shrink-0 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5">
                      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col justify-between min-w-0 py-0.5">
                  <a
                    href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-[#e2e8f0] leading-snug line-clamp-2 hover:text-white transition"
                  >
                    {video.title}
                  </a>
                  <div className="flex items-center gap-3 text-[11px] text-[#64748b] mt-1.5">
                    {video.channels && (
                      <Link
                        href={`/channels/${video.channel_id}`}
                        className="hover:text-[#00d4aa] transition flex items-center gap-1"
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: catColor }} />
                        {video.channels.name}
                      </Link>
                    )}
                    <span>조회수 {formatViewCount(video.view_count)}</span>
                    <span>{timeAgo(video.published_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {videos.length === 0 && (
          <div className="px-6 py-12 text-center text-[#64748b] text-sm">
            데이터를 수집 중입니다...
          </div>
        )}
      </div>
    </div>
  )
}
