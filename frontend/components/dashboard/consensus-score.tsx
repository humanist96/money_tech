"use client"

import type { AssetConsensus } from "@/lib/types"

interface ConsensusScoreProps {
  data: AssetConsensus[]
  title?: string
}

export function ConsensusScore({ data, title = "종목별 합의도" }: ConsensusScoreProps) {
  if (data.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-white text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <p className="text-sm text-[#5a6a88]">종목 언급 데이터를 수집 중입니다.</p>
      </div>
    )
  }

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1a2744]/50 flex items-center justify-between">
        <h3 className="font-bold text-white text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <span className="text-[10px] text-[#5a6a88]">최근 7일 | 2개 이상 채널 언급</span>
      </div>
      <div className="p-4 space-y-2">
        {data.map((asset) => {
          const dominant = asset.positive_pct >= asset.negative_pct && asset.positive_pct >= asset.neutral_pct
            ? "positive"
            : asset.negative_pct >= asset.positive_pct && asset.negative_pct >= asset.neutral_pct
              ? "negative"
              : "neutral"
          const badgeColor = dominant === "positive" ? "#22c997" : dominant === "negative" ? "#ff5757" : "#ffb84d"

          return (
            <div key={asset.asset_code || asset.asset_name} className="px-3 py-3 rounded-xl hover:bg-[#0e1a30]/50 transition">
              <div className="flex items-center gap-3 mb-2">
                <a
                  href={`/assets/${encodeURIComponent(asset.asset_code || asset.asset_name)}`}
                  className="text-sm font-semibold text-white hover:text-[#00e8b8] transition truncate"
                >
                  {asset.asset_name}
                </a>
                <span className="text-[10px] text-[#5a6a88] tabular-nums shrink-0">
                  {asset.channel_count}개 채널 | {asset.total_mentions}회
                </span>
                <span
                  className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${badgeColor} 12%, transparent)`,
                    color: badgeColor,
                    border: `1px solid color-mix(in srgb, ${badgeColor} 25%, transparent)`,
                  }}
                >
                  {asset.consensus_score}% {dominant === "positive" ? "긍정" : dominant === "negative" ? "부정" : "중립"}
                </span>
              </div>
              <div className="flex rounded-full overflow-hidden h-2.5 bg-[#0e1a30]">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${asset.positive_pct}%`, background: "#22c997" }}
                  title={`긍정 ${Math.round(asset.positive_pct)}%`}
                />
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${asset.neutral_pct}%`, background: "#ffb84d" }}
                  title={`중립 ${Math.round(asset.neutral_pct)}%`}
                />
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${asset.negative_pct}%`, background: "#ff5757" }}
                  title={`부정 ${Math.round(asset.negative_pct)}%`}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-[#22c997] tabular-nums">긍정 {Math.round(asset.positive_pct)}%</span>
                <span className="text-[9px] text-[#ffb84d] tabular-nums">중립 {Math.round(asset.neutral_pct)}%</span>
                <span className="text-[9px] text-[#ff5757] tabular-nums">부정 {Math.round(asset.negative_pct)}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
