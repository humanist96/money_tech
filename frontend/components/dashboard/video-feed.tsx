"use client"

import { useState } from "react"
import Link from "next/link"
import { CATEGORY_COLORS, PLATFORM_CONFIG } from "@/lib/types"
import type { Platform } from "@/lib/types"
import { formatViewCount, formatDuration, timeAgo } from "@/lib/queries"
import { Pagination } from "@/components/ui/pagination"

interface VideoFeedProps {
  videos: any[]
  title?: string
  pageSize?: number
}

function getPostUrl(video: any): string {
  const platform = video.platform ?? 'youtube'
  switch (platform) {
    case 'naver_blog':
      return video.blog_post_url || '#'
    case 'telegram':
      return `https://t.me/${video.channels?.telegram_username || 'c'}/${video.telegram_message_id || ''}`
    case 'analyst_report':
      return video.report_url || '#'
    default:
      return `https://www.youtube.com/watch?v=${video.youtube_video_id}`
  }
}

function PlatformThumbnail({ video, postUrl }: { video: any; postUrl: string }) {
  const platform = (video.platform ?? 'youtube') as Platform
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.youtube

  if (platform === 'youtube') {
    return (
      <a href={postUrl} target="_blank" rel="noopener noreferrer"
        className="shrink-0 relative group rounded-xl overflow-hidden">
        <img
          src={`https://i.ytimg.com/vi/${video.youtube_video_id}/mqdefault.jpg`}
          alt="" className="h-[72px] w-[128px] object-cover brightness-90 group-hover:brightness-110 transition-all duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {video.duration && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/75 backdrop-blur-sm text-[10px] text-th-primary px-1.5 py-0.5 rounded-md font-medium tabular-nums">
            {formatDuration(video.duration)}
          </span>
        )}
      </a>
    )
  }

  const labels: Record<string, string> = {
    naver_blog: 'BLOG',
    telegram: 'TG',
    analyst_report: 'REPORT',
  }

  return (
    <a href={postUrl} target="_blank" rel="noopener noreferrer"
      className="shrink-0 relative group rounded-xl overflow-hidden h-[72px] w-[128px] flex items-center justify-center"
      style={{ background: `color-mix(in srgb, ${config.color} 8%, var(--th-bg-card))` }}>
      <div className="flex flex-col items-center gap-1">
        <span className="text-2xl">{config.icon}</span>
        <span className="text-[9px] font-bold" style={{ color: config.color }}>
          {labels[platform] || config.label.toUpperCase()}
        </span>
      </div>
      {platform === 'analyst_report' && video.description && (
        (() => {
          const match = video.description.match(/목표가:\s*([\d,]+)/)
          return match ? (
            <span className="absolute bottom-1.5 right-1.5 bg-black/75 backdrop-blur-sm text-[10px] text-th-primary px-1.5 py-0.5 rounded-md font-medium tabular-nums">
              {match[1]}원
            </span>
          ) : null
        })()
      )}
    </a>
  )
}

export function VideoFeed({ videos, title = "최신 콘텐츠", pageSize = 5 }: VideoFeedProps) {
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(videos.length / pageSize)
  const paged = videos.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50 flex items-center justify-between">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <span className="text-[10px] text-th-dim">{videos.length}건</span>
      </div>
      <div className="divide-y divide-th-border/25">
        {paged.map((video) => {
          const catColor = video.channels ? CATEGORY_COLORS[video.channels.category] : "#64748b"
          const postUrl = getPostUrl(video)
          const platform = (video.platform ?? 'youtube') as Platform
          const platformConfig = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.youtube
          return (
            <div key={video.id} className="px-5 py-4 hover:bg-th-hover/40 transition-colors">
              <div className="flex gap-4">
                <PlatformThumbnail video={video} postUrl={postUrl} />
                <div className="flex flex-col justify-between min-w-0 py-0.5">
                  <div className="flex items-center gap-2">
                    <a
                      href={postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-th-muted leading-snug line-clamp-2 hover:text-th-primary transition"
                    >
                      {video.title}
                    </a>
                    {platform !== 'youtube' && (
                      <span
                        className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${platformConfig.badge}`}
                      >
                        {platformConfig.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-th-dim mt-1.5">
                    {video.channels && (
                      <Link
                        href={`/channels/${video.channel_id}`}
                        className="hover:text-th-accent transition flex items-center gap-1.5 font-medium"
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: catColor }} />
                        {video.channels.name}
                      </Link>
                    )}
                    {platform === 'analyst_report' && video.firm_name && (
                      <span className="font-medium" style={{ color: platformConfig.color }}>
                        {video.firm_name}{video.analyst_name ? ` · ${video.analyst_name}` : ''}
                      </span>
                    )}
                    {video.view_count != null && (
                      <span className="tabular-nums">조회수 {formatViewCount(video.view_count)}</span>
                    )}
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
                    <p className="text-[10px] text-th-dim mt-1.5 line-clamp-1">{video.summary}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {videos.length === 0 && (
          <div className="px-6 py-16 text-center text-th-dim text-sm">
            데이터를 수집 중입니다...
          </div>
        )}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}
