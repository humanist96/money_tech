"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface TabItem {
  href: string
  label: string
  icon: React.ReactNode
}

const ICONS = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  leaderboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  ),
  channels: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  ),
  predictions: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  trends: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  movers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  briefing: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
    </svg>
  ),
  developer: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  ),
}

const TABS: TabItem[] = [
  { href: "/", label: "홈", icon: ICONS.dashboard },
  { href: "/leaderboard", label: "리더보드", icon: ICONS.leaderboard },
  { href: "/channels", label: "채널", icon: ICONS.channels },
  { href: "/search", label: "검색", icon: ICONS.search },
]

const MORE_ITEMS: TabItem[] = [
  { href: "/movers", label: "등락 원인", icon: ICONS.movers },
  { href: "/predictions", label: "예측 추적", icon: ICONS.predictions },
  { href: "/trends", label: "트렌드", icon: ICONS.trends },
  { href: "/briefing", label: "일일 브리핑", icon: ICONS.briefing },
  { href: "/developer", label: "개발자 API", icon: ICONS.developer },
]

export function MobileNav() {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  const isMoreActive = MORE_ITEMS.some((item) => item.href === pathname)

  useEffect(() => {
    setSheetOpen(false)
  }, [pathname])

  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [sheetOpen])

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav className="mobile-bottom-nav md:hidden">
        {TABS.map((tab) => {
          const isActive = tab.href === pathname
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`mobile-tab ${isActive ? "mobile-tab-active" : ""}`}
            >
              <span className="mobile-tab-icon">{tab.icon}</span>
              <span className="mobile-tab-label">{tab.label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setSheetOpen(true)}
          className={`mobile-tab ${isMoreActive ? "mobile-tab-active" : ""}`}
        >
          <span className="mobile-tab-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
            </svg>
          </span>
          <span className="mobile-tab-label">더보기</span>
        </button>
      </nav>

      {/* More Sheet / Drawer */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />
          {/* Sheet */}
          <div
            ref={sheetRef}
            className="mobile-sheet"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ background: "var(--th-border-strong)" }} />
            </div>
            {/* Header */}
            <div className="px-5 pb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-th-primary">더보기</h2>
              <button
                onClick={() => setSheetOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "var(--th-bg-tertiary)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {/* Items Grid */}
            <div className="px-4 pb-8 grid grid-cols-4 gap-2">
              {MORE_ITEMS.map((item) => {
                const isActive = item.href === pathname
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`mobile-sheet-item ${isActive ? "mobile-sheet-item-active" : ""}`}
                  >
                    <span className="mobile-sheet-item-icon">{item.icon}</span>
                    <span className="mobile-sheet-item-label">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
