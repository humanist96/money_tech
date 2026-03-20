"use client"

import { useState, useRef, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"

export function UserMenu() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (status === "loading") {
    return (
      <div className="w-8 h-8 rounded-full bg-th-tertiary animate-pulse" />
    )
  }

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium btn-accent-outline"
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
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
        <span className="hidden sm:inline">로그인</span>
      </Link>
    )
  }

  const user = session.user

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 px-1.5 py-1 rounded-lg transition-colors hover:bg-th-hover"
      >
        {user.image ? (
          <img
            src={user.image}
            alt={user.name ?? "User"}
            className="w-7 h-7 rounded-full border border-th-border"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00e8b8] to-[#00b894] flex items-center justify-center text-xs font-bold text-white">
            {(user.name ?? user.email ?? "U").charAt(0).toUpperCase()}
          </div>
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-th-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 min-w-[200px] bg-th-header backdrop-blur-2xl border border-th-border rounded-xl shadow-xl py-1.5 z-50">
          <div className="px-4 py-3 border-b border-th-border">
            <p className="text-sm font-medium text-th-primary truncate">
              {user.name}
            </p>
            <p className="text-xs text-th-muted truncate">{user.email}</p>
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-th-accent-soft text-th-accent border border-th-accent">
              {user.tier ?? "free"}
            </span>
          </div>

          <div className="py-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-th-secondary transition-colors hover:bg-th-hover"
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
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              프로필
            </Link>
            <Link
              href="/watchlist"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-th-secondary transition-colors hover:bg-th-hover"
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
              관심 종목
            </Link>
          </div>

          <div className="border-t border-th-border pt-1">
            <button
              onClick={() => {
                setOpen(false)
                signOut({ callbackUrl: "/" })
              }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-400 transition-colors hover:bg-th-hover"
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
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
