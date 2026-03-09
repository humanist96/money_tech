"use client"

import Link from "next/link"
import type { Channel } from "@/lib/types"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"

interface ChannelTickerProps {
  channels: Channel[]
}

function formatCount(n: number | null): string {
  if (n === null) return "-"
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`
  return n.toLocaleString()
}

export function ChannelTicker({ channels }: ChannelTickerProps) {
  if (channels.length === 0) return null

  // Double for seamless loop
  const items = [...channels, ...channels]

  return (
    <div className="relative overflow-hidden rounded-xl bg-th-card-deep/80 border border-th-border/40 backdrop-blur-sm">
      <div className="flex items-center">
        {/* Label */}
        <div className="shrink-0 px-4 py-2.5 border-r border-th-border/50 bg-th-card/80 z-10">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-th-accent pulse-dot" />
            <span className="text-[10px] font-bold text-th-dim uppercase tracking-wider whitespace-nowrap">
              TOP 채널
            </span>
          </div>
        </div>

        {/* Scrolling track */}
        <div className="overflow-hidden flex-1 relative">
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-th-card-deep to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-th-card-deep to-transparent z-10 pointer-events-none" />

          <div className="flex animate-ticker hover:[animation-play-state:paused]">
            {items.map((ch, i) => {
              const color = CATEGORY_COLORS[ch.category] ?? "#6b7280"
              return (
                <Link
                  key={`${ch.id}-${i}`}
                  href={`/channels/${ch.id}`}
                  className="shrink-0 flex items-center gap-2.5 px-4 py-2 hover:bg-th-hover/50 transition-colors border-r border-th-border/20 group"
                >
                  {/* Rank */}
                  {i < channels.length && (
                    <span
                      className="text-[10px] font-bold tabular-nums w-4 text-right"
                      style={{ color: i < 3 ? color : "var(--th-text-dim)" }}
                    >
                      {i + 1}
                    </span>
                  )}

                  {/* Avatar */}
                  <div
                    className="rounded-lg p-[1px] shrink-0"
                    style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 30%, transparent))` }}
                  >
                    {ch.thumbnail_url ? (
                      <img src={ch.thumbnail_url} alt="" className="w-7 h-7 rounded-[6px] object-cover bg-th-card" />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[10px] font-bold"
                        style={{ background: `color-mix(in srgb, ${color} 15%, var(--th-bg-card))`, color }}
                      >
                        {ch.name[0]}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col whitespace-nowrap">
                    <span className="text-[12px] font-semibold text-th-primary group-hover:text-th-accent transition leading-tight">
                      {ch.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[8px] font-semibold px-1 py-0 rounded"
                        style={{
                          background: `color-mix(in srgb, ${color} 12%, transparent)`,
                          color,
                        }}
                      >
                        {CATEGORY_LABELS[ch.category]}
                      </span>
                      <span className="text-[9px] text-th-dim tabular-nums">
                        {formatCount(ch.subscriber_count)}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
