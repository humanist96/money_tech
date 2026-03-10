import { notFound } from "next/navigation"
import Link from "next/link"
import { getChannelById, getVideosByChannelId, formatViewCount, getChannelHitRate, getChannelPredictions, getChannelProfile, getChannelSpecialty } from "@/lib/queries"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"
import { VideoFeed } from "@/components/dashboard/video-feed"
import { HitRateCard } from "@/components/dashboard/hit-rate-card"
import { ProfileRadar } from "@/components/charts/profile-radar"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ChannelDetailPage({ params }: PageProps) {
  const { id } = await params
  const [channel, videos, hitRateData, predictions, profileData, specialty] = await Promise.all([
    getChannelById(id),
    getVideosByChannelId(id),
    getChannelHitRate(id),
    getChannelPredictions(id),
    getChannelProfile(id),
    getChannelSpecialty(id),
  ])

  if (!channel) notFound()

  const color = CATEGORY_COLORS[channel.category] ?? "#6b7280"
  const isBlog = (channel.platform ?? 'youtube') === 'naver_blog'

  const statItems = isBlog
    ? [
        {
          label: "포스트 수",
          value: channel.video_count?.toLocaleString() ?? "-",
          accent: "#03c75a",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" />
            </svg>
          ),
        },
        {
          label: "카테고리",
          value: CATEGORY_LABELS[channel.category],
          accent: color,
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          ),
        },
        {
          label: "플랫폼",
          value: "네이버 블로그",
          accent: "#03c75a",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          ),
        },
      ]
    : [
        {
          label: "구독자",
          value: formatViewCount(channel.subscriber_count),
          accent: color,
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            </svg>
          ),
        },
        {
          label: "총 조회수",
          value: formatViewCount(channel.total_view_count),
          accent: "#7c6cf0",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
          ),
        },
        {
          label: "영상 수",
          value: channel.video_count?.toLocaleString() ?? "-",
          accent: "#ffb84d",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          ),
        },
      ]

  const SENTIMENT_COLORS: Record<string, string> = {
    positive: '#22c997',
    negative: '#ff5757',
    neutral: '#ffb84d',
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <Link href="/channels" className="inline-flex items-center gap-2 text-xs text-th-dim hover:text-th-accent transition group">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-0.5 transition-transform">
          <path d="m15 18-6-6 6-6" />
        </svg>
        채널 탐색
      </Link>

      {/* Channel Hero */}
      <div className="glass-card-elevated rounded-2xl overflow-hidden">
        {/* Banner gradient */}
        <div className="relative h-32 sm:h-36">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${color} 20%, var(--th-bg-page)) 0%, var(--th-bg-card) 50%, color-mix(in srgb, ${color} 8%, var(--th-bg-card)) 100%)`,
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage: `radial-gradient(ellipse 60% 80% at 75% 20%, ${color}, transparent)`,
            }}
          />
          <a
            href={isBlog
              ? (channel.blog_url ?? `https://blog.naver.com/${channel.blog_id}`)
              : `https://www.youtube.com/channel/${channel.youtube_channel_id}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-4 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/30 backdrop-blur-sm text-[11px] text-white/70 hover:text-white hover:bg-black/50 transition-all border border-white/10"
          >
            {isBlog ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#03c75a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                블로그에서 보기
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[#ff0000]">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                YouTube에서 보기
              </>
            )}
          </a>
        </div>

        {/* Profile section */}
        <div className="relative px-6 sm:px-8 pb-6">
          <div className="absolute -top-10 left-6 sm:left-8">
            <div
              className="rounded-2xl p-[3px] shadow-xl"
              style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 35%, transparent))` }}
            >
              {channel.thumbnail_url ? (
                <img src={channel.thumbnail_url} alt="" className="w-20 h-20 rounded-[13px] object-cover bg-th-card" />
              ) : (
                <div
                  className="w-20 h-20 rounded-[13px] flex items-center justify-center text-3xl font-bold"
                  style={{ background: `color-mix(in srgb, ${color} 18%, var(--th-bg-card))`, color }}
                >
                  {channel.name[0]}
                </div>
              )}
            </div>
          </div>

          <div className="pt-14">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-th-primary" style={{ fontFamily: 'var(--font-outfit)' }}>
                {channel.name}
              </h1>
              <span
                className={`cat-badge cat-${channel.category} text-[11px] font-semibold px-2.5 py-1 rounded-lg`}
                style={{ '--cat-color': color } as React.CSSProperties}
              >
                {CATEGORY_LABELS[channel.category]}
              </span>
            </div>

            {channel.description && (
              <p className="text-sm text-th-muted mt-3 max-w-2xl leading-relaxed">
                {channel.description}
              </p>
            )}
          </div>

          {/* Specialty tags */}
          {specialty.length > 0 && (
            <div className="mt-4">
              <span className="text-[10px] text-th-dim uppercase tracking-wider font-medium">자주 다루는 종목</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {specialty.map((s) => {
                  const sColor = SENTIMENT_COLORS[s.sentiment] ?? '#7c6cf0'
                  return (
                    <a
                      key={s.asset_name}
                      href={`/assets/${encodeURIComponent(s.asset_code || s.asset_name)}`}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-lg hover:opacity-80 transition flex items-center gap-1.5"
                      style={{
                        background: `color-mix(in srgb, ${sColor} 10%, transparent)`,
                        color: sColor,
                        border: `1px solid color-mix(in srgb, ${sColor} 20%, transparent)`,
                      }}
                    >
                      {s.asset_name}
                      <span className="text-[9px] opacity-60">{s.mention_count}</span>
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-th-border/50">
            {statItems.map((stat) => (
              <div key={stat.label} className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `color-mix(in srgb, ${stat.accent} 10%, transparent)`, color: stat.accent }}
                >
                  {stat.icon}
                </div>
                <div>
                  <p className="text-[10px] text-th-dim uppercase tracking-wider font-medium">{stat.label}</p>
                  <p
                    className="text-xl font-bold mt-0.5 stat-value tabular-nums"
                    style={{ fontFamily: 'var(--font-outfit)', color: stat.accent }}
                  >
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <HitRateCard
          hitRate={hitRateData.hit_rate}
          totalPredictions={hitRateData.total_predictions}
          accurateCount={hitRateData.accurate_count}
          dir1wCorrect={hitRateData.dir_1w_correct}
          dir1wTotal={hitRateData.dir_1w_total}
          dir1mCorrect={hitRateData.dir_1m_correct}
          dir1mTotal={hitRateData.dir_1m_total}
          recentPredictions={predictions.filter((p: any) => p.prediction_type !== 'hold').map((p: any) => ({
            asset_name: p.asset_name,
            asset_code: p.asset_code,
            prediction_type: p.prediction_type,
            predicted_at: p.predicted_at,
            price_at_mention: p.price_at_mention,
            actual_price: p.actual_price_after_3m || p.actual_price_after_1m || p.actual_price_after_1w,
            is_accurate: p.is_accurate,
            direction_1w: p.direction_1w ?? null,
            direction_1m: p.direction_1m ?? null,
            direction_3m: p.direction_3m ?? null,
            direction_score: p.direction_score ?? null,
          }))}
        />
        <ProfileRadar
          channelName={channel.name}
          data={{
            aggressiveness: profileData.aggressiveness ?? 50,
            conservatism: profileData.conservatism ?? 50,
            diversity: Math.min((profileData.diversity ?? 50) * 5, 100),
            accuracy: (channel.hit_rate ?? 0.5) * 100,
            depth: Math.min(profileData.depth ?? 50, 100),
          }}
        />
      </div>

      <VideoFeed videos={videos} title={`${channel.name}의 ${isBlog ? '포스트' : '영상'}`} />
    </div>
  )
}
