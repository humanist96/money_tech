"use client"

import { useState, useEffect, useCallback } from "react"
import { ApiKeysTab } from "./tabs/api-keys-tab"
import { ApiDocsTab } from "./tabs/api-docs-tab"
import { UsageTab } from "./tabs/usage-tab"

const TABS = [
  { id: "keys", label: "API 키 관리" },
  { id: "docs", label: "API 문서" },
  { id: "usage", label: "사용량" },
] as const

type TabId = (typeof TABS)[number]["id"]

interface ApiKey {
  id: string
  key_preview: string
  name: string
  tier: string
  rate_limit: number
  is_active: boolean
  last_used_at: string | null
  created_at: string
  expires_at: string | null
}

export function DeveloperClient({ userId }: { userId: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("keys")
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/developer/keys")
      const json = await res.json()
      if (json.success) {
        setKeys(json.data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-th-card border border-th-border rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.id
                ? "bg-th-accent/10 text-th-accent"
                : "text-th-dim hover:text-th-primary hover:bg-th-hover"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "keys" && (
        <ApiKeysTab keys={keys} loading={loading} onRefresh={fetchKeys} />
      )}
      {activeTab === "docs" && <ApiDocsTab />}
      {activeTab === "usage" && <UsageTab />}
    </div>
  )
}
