"use client"

import Link from "next/link"
import { CATEGORY_COLORS } from "@/lib/types"
import { formatViewCount, formatDuration, timeAgo } from "@/lib/queries"

interface VideoFeedProps {
  videos: any[]
  title?: string
}

export function VideoFeed({ videos, title = "최신 영상" }: VideoFeedProps) {
  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1a2744]/50">
        <h3 className="font-bold text-white text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
      </div>
      <div className="divide-y divide-[#1a2744]/25">
        {videos.map((video) => {
          const catColor = video.channels ? CATEGORY_COLORS[video.channels.category] : "#64748b"
          return (
            <div key={video.id} className="px-5 py-4 hover:bg-[#0e1a30]/40 transition-colors">
              <div className="flex gap-4">
                <a
                  href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 relative group rounded-xl overflow-hidden"
                >
                  <img
                    src={`https://i.ytimg.com/vi/${video.youtube_video_id}/mqdefault.jpg`}
                    alt=""
                    className="h-[72px] w-[128px] object-cover brightness-90 group-hover:brightness-110 transition-all duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  {video.duration && (
                    <span className="absolute bottom-1.5 right-1.5 bg-black/75 backdrop-blur-sm text-[10px] text-white px-1.5 py-0.5 rounded-md font-medium tabular-nums">
                      {formatDuration(video.duration)}
                    </span>
                  )}
                </a>
                <div className="flex flex-col justify-between min-w-0 py-0.5">
                  <a
                    href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-[#e2e8f0] leading-snug line-clamp-2 hover:text-white transition"
                  >
                    {video.title}
                  </a>
                  <div className="flex items-center gap-3 text-[11px] text-[#5a6a88] mt-1.5">
                    {video.channels && (
                      <Link
                        href={`/channels/${video.channel_id}`}
                        className="hover:text-[#00e8b8] transition flex items-center gap-1.5 font-medium"
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: catColor }} />
                        {video.channels.name}
                      </Link>
                    )}
                    <span className="tabular-nums">조회수 {formatViewCount(video.view_count)}</span>
                    <span className="tabular-nums">{timeAgo(video.published_at)}</span>
                  </div>
                  {video.mentioned_assets && video.mentioned_assets.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {video.mentioned_assets.slice(0, 5).map((asset: any, j: number) => {
                        const sentimentColor = asset.sentiment === 'positive' ? '#22c997'
                          : asset.sentiment === 'negative' ? '#ff5757' : '#7c6cf0'
                        return (
                          <a key={j} href={`/assets/${encodeURIComponent(asset.asset_code || asset.asset_name)}`}
                            className="text-[10px] px-1.5 py-0.5 rounded-md hover:opacity-80 transition font-medium"
                            style={{
                              background: `color-mix(in srgb, ${sentimentColor} 10%, transparent)`,
                              color: sentimentColor,
                              border: `1px solid color-mix(in srgb, ${sentimentColor} 20%, transparent)`,
                            }}>
                            {asset.asset_name}
                          </a>
                        )
                      })}
                    </div>
                  )}
                  {video.summary && (
                    <p className="text-[10px] text-[#3a4a6a] mt-1.5 line-clamp-1">{video.summary}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {videos.length === 0 && (
          <div className="px-6 py-16 text-center text-[#5a6a88] text-sm">
            데이터를 수집 중입니다...
          </div>
        )}
      </div>
    </div>
  )
}
