"use client"

import Link from "next/link"
import type { Channel } from "@/lib/types"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"
import { formatViewCount } from "@/lib/queries"

interface ChannelRankingProps {
  channels: Channel[]
  title?: string
}

export function ChannelRanking({ channels, title = "채널 랭킹" }: ChannelRankingProps) {
  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1a2744]/50 flex items-center justify-between">
        <h3 className="font-bold text-white text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <Link href="/channels" className="text-[11px] text-[#00e8b8] hover:text-[#00ffc8] transition font-medium">
          전체보기
        </Link>
      </div>
      <div className="divide-y divide-[#1a2744]/30">
        {channels.map((channel, index) => {
          const color = CATEGORY_COLORS[channel.category] ?? "#6b7280"
          return (
            <Link
              key={channel.id}
              href={`/channels/${channel.id}`}
              className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-[#0e1a30]/50 transition-colors group"
            >
              <span
                className="text-[10px] font-bold w-5 text-right tabular-nums"
                style={{ color: index < 3 ? color : '#475569' }}
              >
                {index + 1}
              </span>
              <div
                className="rounded-xl p-[1.5px] shrink-0"
                style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 30%, transparent))` }}
              >
                {channel.thumbnail_url ? (
                  <img src={channel.thumbnail_url} alt="" className="w-9 h-9 rounded-[10px] object-cover bg-[#0a1120]" />
                ) : (
                  <div
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-bold"
                    style={{ background: `color-mix(in srgb, ${color} 18%, #0a1120)`, color }}
                  >
                    {channel.name[0]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate group-hover:text-[#00e8b8] transition-colors">{channel.name}</p>
                <span
                  className={`cat-badge cat-${channel.category} text-[9px] font-semibold px-1.5 py-0.5 rounded-md inline-block mt-0.5`}
                  style={{ '--cat-color': color } as React.CSSProperties}
                >
                  {CATEGORY_LABELS[channel.category]}
                </span>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-bold text-white tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
                  {formatViewCount(channel.subscriber_count)}
                </p>
                <p className="text-[9px] text-[#475569] uppercase tracking-wider">구독자</p>
              </div>
            </Link>
          )
        })}
        {channels.length === 0 && (
          <div className="px-6 py-12 text-center text-[#5a6a88] text-sm">
            데이터를 수집 중입니다...
          </div>
        )}
      </div>
    </div>
  )
}
