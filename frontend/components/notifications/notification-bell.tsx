"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface Notification {
  id: string
  type: "buzz_alert" | "new_prediction" | "hit_rate_change" | "contrarian_signal" | "connected"
  message: string
  timestamp: Date
  read: boolean
}

const MAX_NOTIFICATIONS = 20

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "방금 전"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

function formatNotification(type: string, data: Record<string, unknown>): string {
  switch (type) {
    case "buzz_alert":
      return `${data.asset_name} 언급 급증 (${data.mention_count}건, ${data.channel_count}채널)`
    case "new_prediction":
      return `[${data.channel_name}] ${data.asset_name} ${data.prediction_type === "buy" ? "매수" : data.prediction_type === "sell" ? "매도" : "보유"} 예측`
    case "hit_rate_change":
      return `[${data.channel_name}] 적중률 ${data.old_rate}% → ${data.new_rate}%`
    case "contrarian_signal":
      return `${data.asset_name} 역발상 시그널 감지`
    default:
      return "새로운 알림"
  }
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case "buzz_alert":
      return "\uD83D\uDD25"
    case "new_prediction":
      return "\uD83D\uDCCA"
    case "hit_rate_change":
      return "\uD83C\uDFAF"
    case "contrarian_signal":
      return "\u26A0\uFE0F"
    default:
      return "\uD83D\uDD14"
  }
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource("/api/notifications/stream")
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)

        if (payload.type === "connected") {
          setIsConnected(true)
          return
        }

        const notification: Notification = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: payload.type,
          message: formatNotification(payload.type, payload.data ?? {}),
          timestamp: new Date(),
          read: false,
        }

        setNotifications((prev) => [notification, ...prev].slice(0, MAX_NOTIFICATIONS))
      } catch {
        // Ignore malformed messages
      }
    }

    es.onerror = () => {
      setIsConnected(false)
      es.close()
      eventSourceRef.current = null

      reconnectTimerRef.current = setTimeout(() => {
        connect()
      }, 5000)
    }
  }, [])

  useEffect(() => {
    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
    }
  }, [connect])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleOpen = () => {
    setIsOpen((prev) => !prev)
    if (!isOpen) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      )
    }
  }

  const handleClearAll = () => {
    setNotifications([])
    setIsOpen(false)
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-th-hover"
        aria-label="알림"
      >
        {isConnected ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-th-secondary"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-th-muted opacity-50"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] right-0 w-[340px] max-h-[420px] bg-th-header backdrop-blur-2xl border border-th-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-th-border">
            <span className="text-sm font-semibold text-th-primary">알림</span>
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-th-muted hover:text-th-secondary transition-colors"
              >
                모두 지우기
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-[360px]">
            {notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-th-muted">
                새로운 알림이 없습니다
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3 border-b border-th-border/50 last:border-0 hover:bg-th-hover/50 transition-colors"
                >
                  <span className="text-base mt-0.5 flex-shrink-0">
                    {getNotificationIcon(n.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-th-primary leading-snug break-words">
                      {n.message}
                    </p>
                    <p className="text-xs text-th-muted mt-1">
                      {formatTimeAgo(n.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
