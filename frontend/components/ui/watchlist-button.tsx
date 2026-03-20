"use client"

import { useState, useEffect, useCallback } from "react"

interface WatchlistButtonProps {
  assetCode: string
  assetName: string
  assetType?: "stock" | "coin" | "real_estate"
  className?: string
}

export function WatchlistButton({
  assetCode,
  assetName,
  assetType = "stock",
  className = "",
}: WatchlistButtonProps) {
  const [isInWatchlist, setIsInWatchlist] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const checkWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/user/watchlist")
      if (!res.ok) return
      const data = await res.json()
      const found = (data.watchlist ?? []).some(
        (item: { asset_code: string }) => item.asset_code === assetCode
      )
      setIsInWatchlist(found)
    } catch {
      // Silently fail for non-critical feature
    }
  }, [assetCode])

  useEffect(() => {
    checkWatchlist()
  }, [checkWatchlist])

  const handleToggle = async () => {
    const previousState = isInWatchlist
    setIsInWatchlist(!previousState)
    setIsLoading(true)

    try {
      const method = previousState ? "DELETE" : "POST"
      const body = previousState
        ? { asset_code: assetCode }
        : { asset_code: assetCode, asset_name: assetName, asset_type: assetType }

      const res = await fetch("/api/user/watchlist", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        setIsInWatchlist(previousState)
      }
    } catch {
      setIsInWatchlist(previousState)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 hover:scale-110 disabled:opacity-50 ${
        isInWatchlist
          ? "text-yellow-400 hover:text-yellow-300"
          : "text-th-muted hover:text-yellow-400"
      } ${className}`}
      title={isInWatchlist ? "관심종목에서 제거" : "관심종목에 추가"}
      aria-label={isInWatchlist ? "관심종목에서 제거" : "관심종목에 추가"}
    >
      {isInWatchlist ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )}
    </button>
  )
}
