"use client"

import type { ChannelAssetOpinion } from "@/lib/types"

interface OpinionMatrixProps {
  data: ChannelAssetOpinion[]
  title?: string
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c997",
  negative: "#ff5757",
  neutral: "#ffb84d",
}

export function OpinionMatrix({ data, title = "채널 x 종목 의견 매트릭스" }: OpinionMatrixProps) {
  if (data.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <p className="text-sm text-th-dim">2개 이상 채널이 언급한 종목이 없습니다.</p>
      </div>
    )
  }

  const channels = [...new Set(data.map((d) => d.channel_name))]
  const assets = [...new Set(data.map((d) => d.asset_name))]

  const matrix = new Map<string, Map<string, { sentiment: string; count: number }>>()
  for (const d of data) {
    if (!matrix.has(d.channel_name)) matrix.set(d.channel_name, new Map())
    const channelMap = matrix.get(d.channel_name)!
    const existing = channelMap.get(d.asset_name)
    if (!existing || d.mention_count > existing.count) {
      channelMap.set(d.asset_name, { sentiment: d.sentiment, count: d.mention_count })
    }
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50 flex items-center justify-between">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <div className="flex items-center gap-3">
          {Object.entries(SENTIMENT_COLORS).map(([key, color]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded" style={{ background: color }} />
              <span className="text-[9px] text-th-dim">{key === 'positive' ? '긍정' : key === 'negative' ? '부정' : '중립'}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left py-2 px-2 text-th-dim font-medium text-[10px] uppercase tracking-wider sticky left-0 bg-th-card z-10">채널</th>
              {assets.map((asset) => (
                <th key={asset} className="py-2 px-2 text-th-muted font-medium text-center whitespace-nowrap">
                  <a href={`/assets/${encodeURIComponent(asset)}`} className="hover:text-th-accent transition">
                    {asset}
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {channels.map((channel) => (
              <tr key={channel} className="border-t border-th-border/30 hover:bg-th-hover/30 transition">
                <td className="py-2.5 px-2 text-th-primary font-medium whitespace-nowrap sticky left-0 bg-th-card z-10">{channel}</td>
                {assets.map((asset) => {
                  const cell = matrix.get(channel)?.get(asset)
                  if (!cell) {
                    return <td key={asset} className="py-2.5 px-2 text-center text-th-dim">-</td>
                  }
                  const color = SENTIMENT_COLORS[cell.sentiment] ?? "var(--th-text-dim)"
                  return (
                    <td key={asset} className="py-2.5 px-2 text-center">
                      <div
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-bold"
                        style={{
                          background: `color-mix(in srgb, ${color} 15%, transparent)`,
                          color,
                          border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
                        }}
                      >
                        {cell.count}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
