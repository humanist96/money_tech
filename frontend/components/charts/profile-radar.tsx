"use client"

import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from "recharts"

interface ProfileData {
  aggressiveness: number
  conservatism: number
  diversity: number
  accuracy: number
  depth: number
}

interface ChannelProfile {
  name: string
  data: ProfileData
  color: string
}

interface ProfileRadarProps {
  channelName?: string
  data?: ProfileData
  channels?: ChannelProfile[]
}

const OVERLAY_COLORS = ["#00e8b8", "#7c6cf0", "#ff5757", "#ffb84d"]

export function ProfileRadar({ channelName, data, channels }: ProfileRadarProps) {
  const profiles: ChannelProfile[] = channels ?? (data && channelName
    ? [{ name: channelName, data, color: OVERLAY_COLORS[0] }]
    : [])

  if (profiles.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-th-primary text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>유튜버 성향 프로파일</h3>
        <p className="text-sm text-th-dim">프로파일 데이터가 없습니다.</p>
      </div>
    )
  }

  const axes = ["공격성", "보수성", "다양성", "정확도", "깊이"] as const
  const keys: (keyof ProfileData)[] = ["aggressiveness", "conservatism", "diversity", "accuracy", "depth"]

  const radarData = axes.map((axis, i) => {
    const point: Record<string, any> = { axis, fullMark: 100 }
    for (const p of profiles) {
      point[p.name] = Math.min(p.data[keys[i]], 100)
    }
    return point
  })

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-th-border/50">
        <h3 className="font-bold text-th-primary text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>
          {profiles.length > 1 ? "유튜버 성향 비교" : "유튜버 성향 프로파일"}
        </h3>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={profiles.length > 1 ? 300 : 260}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="var(--th-border)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: '#7a8ba8', fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            {profiles.map((p, i) => (
              <Radar
                key={p.name}
                name={p.name}
                dataKey={p.name}
                stroke={p.color || OVERLAY_COLORS[i % OVERLAY_COLORS.length]}
                fill={p.color || OVERLAY_COLORS[i % OVERLAY_COLORS.length]}
                fillOpacity={profiles.length > 1 ? 0.08 : 0.15}
                strokeWidth={2}
              />
            ))}
            {profiles.length > 1 && (
              <Legend wrapperStyle={{ fontSize: '11px', color: '#7a8ba8' }} />
            )}
          </RadarChart>
        </ResponsiveContainer>

        {profiles.length === 1 && (
          <div className="grid grid-cols-5 gap-2 mt-2">
            {radarData.map((d) => (
              <div key={d.axis} className="text-center">
                <p className="text-[10px] text-th-dim">{d.axis}</p>
                <p className="text-xs font-bold text-[#00e8b8] tabular-nums" style={{ fontFamily: 'var(--font-outfit)' }}>
                  {Math.round(d[profiles[0].name])}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
