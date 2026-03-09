"use client"

import Link from "next/link"
import type { AssetMention } from "@/lib/types"

interface TopMentionsChartProps {
  data: AssetMention[]
  title?: string
}

const TYPE_COLORS: Record<string, string> = {
  stock: "#ff5757",
  coin: "#ffb84d",
  real_estate: "#22c997",
}

export function TopMentionsChart({ data, title = "종목 언급 랭킹" }: TopMentionsChartProps) {
  if (data.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <p className="text-sm text-th-dim">데이터를 수집 중입니다.</p>
      </div>
    )
  }

  const maxMentions = Math.max(...data.map(d => d.mention_count), 1)

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50 flex items-center justify-between">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <span className="text-[10px] text-th-dim">전체 기간</span>
      </div>
      <div className="p-4 space-y-1">
        {data.slice(0, 10).map((asset, i) => {
          const barWidth = (asset.mention_count / maxMentions) * 100
          const color = TYPE_COLORS[asset.asset_type] ?? "#7c6cf0"
          const posRatio = asset.mention_count > 0
            ? asset.positive_count / asset.mention_count
            : 0
          const negRatio = asset.mention_count > 0
            ? asset.negative_count / asset.mention_count
            : 0

          return (
            <Link
              key={asset.asset_code || asset.asset_name}
              href={`/assets/${encodeURIComponent(asset.asset_code || asset.asset_name)}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-th-hover/50 transition group"
            >
              <span
                className="text-[10px] font-bold w-4 text-right tabular-nums"
                style={{ color: i < 3 ? color : "var(--th-text-dim)" }}
              >
                {i + 1}
              </span>

              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0"
                style={{
                  background: `color-mix(in srgb, ${color} 15%, var(--th-bg-card))`,
                  color,
                }}
              >
                {asset.asset_name[0]}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-th-primary group-hover:text-th-accent transition truncate">
                    {asset.asset_name}
                  </span>
                  <span className="text-[9px] text-th-dim tabular-nums shrink-0">
                    {asset.channels?.length ?? asset.mention_count}ch
                  </span>
                </div>
                {/* Bar */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-th-card rounded-full overflow-hidden">
                    <div className="h-full rounded-full flex">
                      {posRatio > 0 && (
                        <div style={{ width: `${posRatio * barWidth}%`, background: "#22c997" }} />
                      )}
                      {negRatio > 0 && (
                        <div style={{ width: `${negRatio * barWidth}%`, background: "#ff5757" }} />
                      )}
                      <div
                        style={{
                          width: `${(1 - posRatio - negRatio) * barWidth}%`,
                          background: `color-mix(in srgb, ${color} 40%, var(--th-border))`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[11px] font-bold tabular-nums w-6 text-right" style={{ color, fontFamily: 'var(--font-outfit)' }}>
                    {asset.mention_count}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
