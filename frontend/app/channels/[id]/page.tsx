import { notFound } from "next/navigation"
import Link from "next/link"
import { getChannelById, getVideosByChannelId, formatViewCount } from "@/lib/queries"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"
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

  if (!channel) notFound()

  const color = CATEGORY_COLORS[channel.category] ?? "#6b7280"

  return (
    <div className="space-y-8">
      {/* Back */}
      <Link href="/channels" className="inline-flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#00d4aa] transition">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        채널 목록
      </Link>

      {/* Channel Hero */}
      <div className="glass-card rounded-2xl p-8 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ background: `radial-gradient(ellipse 60% 80% at 80% 20%, ${color}, transparent)` }}
        />
        <div className="relative flex flex-col sm:flex-row items-start gap-6">
          {/* Large avatar */}
          <div className={`avatar-ring cat-${channel.category} shrink-0`} style={{ '--cat-color': color, padding: '3px' } as React.CSSProperties}>
            {channel.thumbnail_url ? (
              <img src={channel.thumbnail_url} alt="" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
                style={{ background: `color-mix(in srgb, ${color} 18%, #0c1324)`, color }}
              >
                {channel.name[0]}
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-extrabold text-white" style={{ fontFamily: 'var(--font-outfit)' }}>
                {channel.name}
              </h1>
              <span
                className={`cat-badge cat-${channel.category} text-xs font-medium px-2.5 py-1 rounded-full`}
                style={{ '--cat-color': color } as React.CSSProperties}
              >
                {CATEGORY_LABELS[channel.category]}
              </span>
            </div>

            <a
              href={`https://www.youtube.com/channel/${channel.youtube_channel_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#ef4444] mt-2 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              YouTube에서 보기
            </a>

            {channel.description && (
              <p className="text-sm text-[#94a3b8] mt-3 max-w-2xl leading-relaxed">
                {channel.description}
              </p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="relative grid grid-cols-3 gap-6 mt-8 pt-6 border-t border-[#1e293b]/60">
          {[
            { label: "구독자", value: formatViewCount(channel.subscriber_count), accent: color },
            { label: "총 조회수", value: formatViewCount(channel.total_view_count), accent: "#6366f1" },
            { label: "영상 수", value: channel.video_count?.toLocaleString() ?? "-", accent: "#f59e0b" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-[10px] text-[#475569] uppercase tracking-wider font-medium">{stat.label}</p>
              <p
                className="text-2xl font-bold mt-1 stat-value tabular-nums"
                style={{ fontFamily: 'var(--font-outfit)', color: stat.accent }}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <VideoFeed videos={videos} title={`${channel.name}의 영상`} />
    </div>
  )
}
