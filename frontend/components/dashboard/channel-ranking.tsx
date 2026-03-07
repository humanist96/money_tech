"use client"

import Link from "next/link"
import type { Channel } from "@/lib/types"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"
import { formatViewCount } from "@/lib/queries"

interface ChannelRankingProps {
  channels: Channel[]
  title?: string
}

function ChannelAvatar({ name, category }: { name: string; category: string }) {
  const color = CATEGORY_COLORS[category] ?? "#6b7280"
  return (
    <div className={`avatar-ring cat-${category}`} style={{ '--cat-color': color } as React.CSSProperties}>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
        style={{ background: `color-mix(in srgb, ${color} 20%, #0c1324)`, color }}
      >
        {name[0]}
      </div>
    </div>
  )
}

export function ChannelRanking({ channels, title = "채널 랭킹" }: ChannelRankingProps) {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e293b]/60 flex items-center justify-between">
        <h3 className="font-semibold text-white" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <Link href="/channels" className="text-xs text-[#00d4aa] hover:underline">
          전체보기
        </Link>
      </div>
      <div className="divide-y divide-[#1e293b]/40">
        {channels.map((channel, index) => {
          const color = CATEGORY_COLORS[channel.category] ?? "#6b7280"
          return (
            <Link
              key={channel.id}
              href={`/channels/${channel.id}`}
              className="flex items-center gap-4 px-6 py-3.5 hover:bg-[#1e293b]/20 transition-colors"
            >
              <span className="text-xs font-bold text-[#475569] w-5 text-right tabular-nums">
                {index + 1}
              </span>
              <ChannelAvatar name={channel.name} category={channel.category} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{channel.name}</p>
                <span
                  className={`cat-badge cat-${channel.category} text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-block mt-0.5`}
                  style={{ '--cat-color': color } as React.CSSProperties}
                >
                  {CATEGORY_LABELS[channel.category]}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white tabular-nums">
                  {formatViewCount(channel.subscriber_count)}
                </p>
                <p className="text-[10px] text-[#64748b]">구독자</p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-[#94a3b8] tabular-nums">
                  {formatViewCount(channel.total_view_count)}
                </p>
                <p className="text-[10px] text-[#64748b]">조회수</p>
              </div>
            </Link>
          )
        })}
        {channels.length === 0 && (
          <div className="px-6 py-12 text-center text-[#64748b] text-sm">
            데이터를 수집 중입니다...
          </div>
        )}
      </div>
    </div>
  )
}
