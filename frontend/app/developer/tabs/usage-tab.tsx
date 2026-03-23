"use client"

import { useState, useEffect } from "react"

interface UsageStats {
  today: number
  this_week: number
  this_month: number
  endpoints: { endpoint: string; count: number }[]
  rate_limit: number
  used_this_hour: number
}

export function UsageTab() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch("/api/developer/usage")
        const json = await res.json()
        if (json.success) {
          setStats(json.data)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchUsage()
  }, [])

  if (loading) {
    return (
      <div className="bg-th-card border border-th-border rounded-2xl p-8 text-center text-th-dim">
        로딩 중...
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-th-card border border-th-border rounded-2xl p-8 text-center text-th-dim">
        사용량 데이터가 없습니다. API 키를 생성하고 사용해 보세요.
      </div>
    )
  }

  const usagePct = stats.rate_limit > 0
    ? Math.round((stats.used_this_hour / stats.rate_limit) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="오늘" value={stats.today} />
        <StatCard label="이번 주" value={stats.this_week} />
        <StatCard label="이번 달" value={stats.this_month} />
      </div>

      {/* Rate limit bar */}
      <div className="bg-th-card border border-th-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-th-primary">시간당 사용량</h3>
          <span className="text-sm text-th-dim">
            {stats.used_this_hour} / {stats.rate_limit}
          </span>
        </div>
        <div className="w-full h-3 bg-th-hover rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              usagePct >= 80 ? "bg-red-500" : usagePct >= 50 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(usagePct, 100)}%` }}
          />
        </div>
        <p className="text-xs text-th-dim">
          {usagePct >= 80
            ? "한도에 거의 도달했습니다. 요청 빈도를 줄여주세요."
            : "정상 범위 내에서 사용 중입니다."}
        </p>
      </div>

      {/* Per-endpoint breakdown */}
      {stats.endpoints.length > 0 && (
        <div className="bg-th-card border border-th-border rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-th-primary">엔드포인트별 사용량 (이번 달)</h3>
          <div className="space-y-2">
            {stats.endpoints.map((ep) => (
              <div key={ep.endpoint} className="flex items-center justify-between py-2 border-b border-th-border/30 last:border-0">
                <code className="text-xs font-mono text-th-dim">{ep.endpoint}</code>
                <span className="text-sm font-medium text-th-primary">
                  {ep.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-th-card border border-th-border rounded-2xl p-5">
      <div className="text-sm text-th-dim mb-1">{label}</div>
      <div className="text-2xl font-bold text-th-primary">{value.toLocaleString()}</div>
      <div className="text-xs text-th-dim mt-1">요청</div>
    </div>
  )
}
