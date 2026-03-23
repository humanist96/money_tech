"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  TIERS,
  formatPrice,
  type TierKey,
  type FeatureKey,
} from "@/lib/tier-config"

interface PricingCardsProps {
  userTier: TierKey
  isLoggedIn: boolean
}

const CARD_FEATURES: { key: FeatureKey; format: (v: number | boolean) => string }[] = [
  {
    key: "aiAssistantMessages",
    format: (v) => (v === Infinity ? "무제한 AI 메시지" : `일 ${v}회 AI 메시지`),
  },
  {
    key: "predictionTracker",
    format: (v) => (v === Infinity ? "무제한 예측 트래커" : `예측 트래커 ${v}개`),
  },
  {
    key: "conflictDetection",
    format: (v) => (v === Infinity ? "무제한 의견충돌 감지" : `의견충돌 감지 ${v}개`),
  },
  {
    key: "channelCompare",
    format: (v) => (v === Infinity ? "무제한 채널 비교" : `채널 동시 비교 ${v}개`),
  },
  {
    key: "searchPerDay",
    format: (v) => (v === Infinity ? "무제한 검색" : `일 ${v}회 검색`),
  },
  {
    key: "exportData",
    format: (v) => (v ? "데이터 내보내기" : "데이터 내보내기 불가"),
  },
  {
    key: "realtimeNotifications",
    format: (v) => (v ? "실시간 알림" : "실시간 알림 불가"),
  },
  {
    key: "apiAccess",
    format: (v) => (v ? "API 접근" : "API 접근 불가"),
  },
]

const TIER_ORDER: TierKey[] = ["free", "pro", "enterprise"]

export function PricingCards({ userTier, isLoggedIn }: PricingCardsProps) {
  const router = useRouter()
  const [upgrading, setUpgrading] = useState<TierKey | null>(null)

  async function handleUpgrade(tier: TierKey) {
    if (!isLoggedIn) {
      router.push("/login")
      return
    }

    if (tier === userTier) return

    if (tier === "enterprise") {
      window.open("mailto:support@moneytech.kr?subject=엔터프라이즈 문의", "_blank")
      return
    }

    setUpgrading(tier)
    try {
      const res = await fetch("/api/user/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      })

      if (res.ok) {
        router.refresh()
      }
    } catch {
      // Error handled silently, user can retry
    } finally {
      setUpgrading(null)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
      {TIER_ORDER.map((tierKey) => {
        const tier = TIERS[tierKey]
        const isCurrent = userTier === tierKey
        const isPro = tierKey === "pro"

        return (
          <div
            key={tierKey}
            className={`relative rounded-2xl border p-6 space-y-5 transition-shadow ${
              isPro
                ? "border-th-accent shadow-lg shadow-th-accent/10 scale-[1.02]"
                : "border-th-border"
            } bg-th-card`}
          >
            {/* Recommended badge */}
            {isPro && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-bold rounded-full bg-th-accent text-white">
                추천
              </div>
            )}

            {/* Current plan badge */}
            {isCurrent && (
              <div className="absolute -top-3 right-4 px-3 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                현재 플랜
              </div>
            )}

            {/* Tier name + price */}
            <div className="space-y-2 pt-2">
              <h3 className="text-lg font-bold text-th-primary">
                {tier.nameKo}
              </h3>
              <div className="flex items-baseline gap-1">
                {tier.price === 0 ? (
                  <span className="text-3xl font-bold text-th-primary">
                    무료
                  </span>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-th-primary">
                      ₩{tier.price.toLocaleString("ko-KR")}
                    </span>
                    <span className="text-sm text-th-dim">/월</span>
                  </>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-th-border" />

            {/* Features */}
            <ul className="space-y-2.5">
              {CARD_FEATURES.map(({ key, format }) => {
                const val = tier.limits[key]
                const enabled =
                  typeof val === "boolean" ? val : true

                return (
                  <li
                    key={key}
                    className={`flex items-center gap-2 text-sm ${
                      enabled ? "text-th-secondary" : "text-th-dim"
                    }`}
                  >
                    {enabled ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-green-500 flex-shrink-0"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-th-dim flex-shrink-0"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    )}
                    {format(val)}
                  </li>
                )
              })}
            </ul>

            {/* CTA */}
            <button
              onClick={() => handleUpgrade(tierKey)}
              disabled={isCurrent || upgrading === tierKey}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                isCurrent
                  ? "bg-th-hover text-th-dim cursor-default"
                  : isPro
                    ? "bg-th-accent text-white hover:opacity-90"
                    : "bg-th-hover text-th-primary hover:bg-th-border"
              } ${upgrading === tierKey ? "opacity-60" : ""}`}
            >
              {upgrading === tierKey
                ? "처리 중..."
                : isCurrent
                  ? "현재 플랜"
                  : tierKey === "enterprise"
                    ? "문의하기"
                    : tierKey === "pro"
                      ? "프로 시작하기"
                      : "무료로 시작"}
            </button>
          </div>
        )
      })}
    </div>
  )
}
