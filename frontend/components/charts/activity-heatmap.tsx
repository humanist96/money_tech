"use client"

import type { ChannelActivityData } from "@/lib/types"

interface ActivityHeatmapProps {
  data: ChannelActivityData[]
  title?: string
}

export function ActivityHeatmap({ data, title = "채널 활동량 히트맵" }: ActivityHeatmapProps) {
  if (data.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-white text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <p className="text-sm text-[#5a6a88]">활동 데이터를 수집 중입니다.</p>
      </div>
    )
  }

  const channels = [...new Set(data.map((d) => d.channel_name))].sort()
  const dates = [...new Set(data.map((d) => d.date))].sort()
  const maxCount = Math.max(...data.map((d) => d.video_count), 1)

  const countMap = new Map<string, number>()
  for (const d of data) {
    countMap.set(`${d.channel_name}|${d.date}`, d.video_count)
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1a2744]/50 flex items-center justify-between">
        <h3 className="font-bold text-white text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <span className="text-[10px] text-[#5a6a88]">최근 7일</span>
      </div>
      <div className="p-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left py-2 px-2 text-[#5a6a88] font-medium text-[10px] uppercase tracking-wider sticky left-0 bg-[#0a1120] z-10 min-w-[100px]">채널</th>
              {dates.map((date) => (
                <th key={date} className="py-2 px-1 text-[#5a6a88] font-medium text-center text-[10px] min-w-[40px]">
                  {new Date(date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {channels.map((channel) => (
              <tr key={channel} className="border-t border-[#1a2744]/20">
                <td className="py-1.5 px-2 text-white font-medium whitespace-nowrap sticky left-0 bg-[#0a1120] z-10 text-[11px]">{channel}</td>
                {dates.map((date) => {
                  const count = countMap.get(`${channel}|${date}`) ?? 0
                  const intensity = count > 0 ? Math.max(0.15, count / maxCount) : 0
                  return (
                    <td key={date} className="py-1.5 px-1 text-center">
                      <div
                        className="w-7 h-7 mx-auto rounded-md flex items-center justify-center text-[10px] font-bold tabular-nums transition-all"
                        style={{
                          background: count > 0 ? `color-mix(in srgb, #00e8b8 ${Math.round(intensity * 50)}%, #0e1a30)` : '#0e1a30',
                          color: count > 0 ? '#00e8b8' : '#1a2744',
                          fontFamily: 'var(--font-outfit)',
                        }}
                        title={`${channel}: ${count}개 (${new Date(date).toLocaleDateString("ko-KR")})`}
                      >
                        {count || ''}
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
