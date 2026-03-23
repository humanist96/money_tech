export type TierKey = "free" | "pro" | "enterprise"

export type FeatureKey =
  | "aiAssistantMessages"
  | "predictionTracker"
  | "conflictDetection"
  | "channelCompare"
  | "searchPerDay"
  | "exportData"
  | "realtimeNotifications"
  | "apiAccess"

interface TierLimits {
  aiAssistantMessages: number
  predictionTracker: number
  conflictDetection: number
  channelCompare: number
  searchPerDay: number
  exportData: boolean
  realtimeNotifications: boolean
  apiAccess: boolean
}

interface TierConfig {
  name: string
  nameKo: string
  price: number
  limits: TierLimits
}

export const TIERS: Record<TierKey, TierConfig> = {
  free: {
    name: "Free",
    nameKo: "무료",
    price: 0,
    limits: {
      aiAssistantMessages: 5,
      predictionTracker: 10,
      conflictDetection: 5,
      channelCompare: 2,
      searchPerDay: 10,
      exportData: false,
      realtimeNotifications: false,
      apiAccess: false,
    },
  },
  pro: {
    name: "Pro",
    nameKo: "프로",
    price: 9900,
    limits: {
      aiAssistantMessages: 100,
      predictionTracker: Infinity,
      conflictDetection: Infinity,
      channelCompare: 10,
      searchPerDay: 100,
      exportData: true,
      realtimeNotifications: true,
      apiAccess: false,
    },
  },
  enterprise: {
    name: "Enterprise",
    nameKo: "엔터프라이즈",
    price: 49900,
    limits: {
      aiAssistantMessages: Infinity,
      predictionTracker: Infinity,
      conflictDetection: Infinity,
      channelCompare: Infinity,
      searchPerDay: Infinity,
      exportData: true,
      realtimeNotifications: true,
      apiAccess: true,
    },
  },
}

const TIER_RANK: Record<TierKey, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
}

export function isTierSufficient(
  userTier: string,
  requiredTier: TierKey
): boolean {
  const userRank = TIER_RANK[userTier as TierKey] ?? 0
  const requiredRank = TIER_RANK[requiredTier]
  return userRank >= requiredRank
}

interface CheckLimitResult {
  allowed: boolean
  remaining?: number
  limit: number
}

export function checkLimit(
  tier: string,
  feature: FeatureKey,
  currentUsage?: number
): CheckLimitResult {
  const tierKey = (tier as TierKey) in TIERS ? (tier as TierKey) : "free"
  const tierConfig = TIERS[tierKey]
  const limitValue = tierConfig.limits[feature]

  if (typeof limitValue === "boolean") {
    return {
      allowed: limitValue,
      limit: limitValue ? 1 : 0,
    }
  }

  const usage = currentUsage ?? 0

  if (limitValue === Infinity) {
    return {
      allowed: true,
      remaining: Infinity,
      limit: Infinity,
    }
  }

  return {
    allowed: usage < limitValue,
    remaining: Math.max(0, limitValue - usage),
    limit: limitValue,
  }
}

export function formatPrice(price: number): string {
  if (price === 0) return "무료"
  return `₩${price.toLocaleString("ko-KR")}/월`
}

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  aiAssistantMessages: "AI 어시스턴트 메시지",
  predictionTracker: "예측 트래커 항목",
  conflictDetection: "의견충돌 감지",
  channelCompare: "채널 동시 비교",
  searchPerDay: "일일 검색",
  exportData: "데이터 내보내기",
  realtimeNotifications: "실시간 알림",
  apiAccess: "API 접근",
}
