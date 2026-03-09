"use client"

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  accent?: string
}

function StatCard({ title, value, icon, accent = "#00e8b8" }: StatCardProps) {
  return (
    <div className="glass-card-elevated rounded-2xl p-5 relative overflow-hidden group">
      <div
        className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-[0.03] transition-all duration-500 group-hover:opacity-[0.06] group-hover:scale-125"
        style={{ background: accent }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#475569] mb-2.5">
            {title}
          </p>
          <p className="text-2xl font-bold stat-value tabular-nums" style={{ fontFamily: 'var(--font-outfit)', color: accent }}>
            {value}
          </p>
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${accent} 10%, transparent)`, color: accent }}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

interface StatsCardsProps {
  totalChannels: number
  totalVideos: number
  todayVideos: number
  topCategory: string
}

export function StatsCards({ totalChannels, totalVideos, todayVideos, topCategory }: StatsCardsProps) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 stagger-in">
      <StatCard
        title="모니터링 채널"
        value={totalChannels}
        accent="#00e8b8"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        }
      />
      <StatCard
        title="수집 영상"
        value={totalVideos.toLocaleString()}
        accent="#7c6cf0"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        }
      />
      <StatCard
        title="오늘 신규"
        value={todayVideos}
        accent="#ffb84d"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
          </svg>
        }
      />
      <StatCard
        title="인기 카테고리"
        value={topCategory}
        accent="#ff5757"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        }
      />
    </div>
  )
}
