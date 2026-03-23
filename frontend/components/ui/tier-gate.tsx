"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"
import { isTierSufficient, TIERS, type TierKey } from "@/lib/tier-config"

interface TierGateProps {
  requiredTier: "pro" | "enterprise"
  feature: string
  children: React.ReactNode
}

export function TierGate({ requiredTier, feature, children }: TierGateProps) {
  const { data: session } = useSession()
  const userTier = (session?.user?.tier ?? "free") as TierKey

  if (isTierSufficient(userTier, requiredTier)) {
    return <>{children}</>
  }

  const tierLabel = TIERS[requiredTier].nameKo

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-th-card/60 backdrop-blur-[2px] rounded-xl">
        <div className="text-center space-y-3 p-6">
          <div className="flex justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-th-dim"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <p className="text-sm text-th-secondary font-medium">
            {feature} 기능은 {tierLabel} 플랜에서 사용할 수 있습니다
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-th-accent text-white hover:opacity-90 transition-opacity"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {tierLabel} 플랜으로 업그레이드
          </Link>
        </div>
      </div>
    </div>
  )
}
