import { auth } from "@/auth"
import { TIERS, formatPrice, type TierKey, type FeatureKey, FEATURE_LABELS } from "@/lib/tier-config"
import { PricingCards } from "./pricing-cards"

const FEATURE_ROWS: { key: FeatureKey; label: string }[] = [
  { key: "aiAssistantMessages", label: FEATURE_LABELS.aiAssistantMessages },
  { key: "predictionTracker", label: FEATURE_LABELS.predictionTracker },
  { key: "conflictDetection", label: FEATURE_LABELS.conflictDetection },
  { key: "channelCompare", label: FEATURE_LABELS.channelCompare },
  { key: "searchPerDay", label: FEATURE_LABELS.searchPerDay },
  { key: "exportData", label: FEATURE_LABELS.exportData },
  { key: "realtimeNotifications", label: FEATURE_LABELS.realtimeNotifications },
  { key: "apiAccess", label: FEATURE_LABELS.apiAccess },
]

function formatLimitValue(value: number | boolean): string {
  if (typeof value === "boolean") return value ? "O" : "X"
  if (value === Infinity) return "무제한"
  return `${value}개`
}

export default async function PricingPage() {
  const session = await auth()
  const userTier = (session?.user?.tier ?? "free") as TierKey

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-12">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-yellow-500"
          >
            <defs>
              <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>
            <polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              stroke="url(#gold-grad)"
              fill="url(#gold-grad)"
              fillOpacity="0.15"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-th-primary">요금제</h1>
        <p className="text-th-secondary text-lg">
          더 깊은 투자 인사이트를 위한 프리미엄 플랜
        </p>
      </div>

      {/* Pricing Cards */}
      <PricingCards userTier={userTier} isLoggedIn={!!session?.user} />

      {/* Comparison Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-th-primary text-center">
          기능 비교
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-th-border">
                <th className="py-3 px-4 text-left text-sm font-medium text-th-secondary">
                  기능
                </th>
                {(Object.keys(TIERS) as TierKey[]).map((tierKey) => (
                  <th
                    key={tierKey}
                    className="py-3 px-4 text-center text-sm font-medium text-th-primary"
                  >
                    {TIERS[tierKey].nameKo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-th-border/50 hover:bg-th-hover/30 transition-colors"
                >
                  <td className="py-3 px-4 text-sm text-th-secondary">
                    {row.label}
                  </td>
                  {(Object.keys(TIERS) as TierKey[]).map((tierKey) => {
                    const val = TIERS[tierKey].limits[row.key]
                    const isBool = typeof val === "boolean"
                    return (
                      <td
                        key={tierKey}
                        className="py-3 px-4 text-center text-sm"
                      >
                        {isBool ? (
                          val ? (
                            <span className="text-green-500">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                          ) : (
                            <span className="text-th-dim">-</span>
                          )
                        ) : (
                          <span className="text-th-primary font-medium">
                            {formatLimitValue(val)}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="border-b border-th-border/50">
                <td className="py-3 px-4 text-sm font-medium text-th-secondary">
                  가격
                </td>
                {(Object.keys(TIERS) as TierKey[]).map((tierKey) => (
                  <td
                    key={tierKey}
                    className="py-3 px-4 text-center text-sm font-bold text-th-primary"
                  >
                    {formatPrice(TIERS[tierKey].price)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
