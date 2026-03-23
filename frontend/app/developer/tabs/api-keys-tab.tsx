"use client"

import { useState } from "react"

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

interface Props {
  keys: ApiKey[]
  loading: boolean
  onRefresh: () => void
}

export function ApiKeysTab({ keys, loading, onRefresh }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCreate = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/developer/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        setGeneratedKey(json.data.key)
        onRefresh()
      }
    } catch {
      // handle silently
    } finally {
      setCreating(false)
    }
  }

  const handleDeactivate = async (keyId: string) => {
    try {
      const res = await fetch(`/api/developer/keys?id=${keyId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.success) {
        onRefresh()
      }
    } catch {
      // handle silently
    }
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const closeModal = () => {
    setShowModal(false)
    setNewKeyName("")
    setGeneratedKey(null)
  }

  const formatDate = (d: string | null) => {
    if (!d) return "-"
    return new Date(d).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="bg-th-card border border-th-border rounded-2xl p-8 text-center text-th-dim">
        로딩 중...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-th-dim">
          최대 5개의 활성 API 키를 생성할 수 있습니다
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-th-accent text-white hover:opacity-90 transition-opacity"
        >
          새 키 생성
        </button>
      </div>

      {/* Keys list */}
      {keys.length === 0 ? (
        <div className="bg-th-card border border-th-border rounded-2xl p-12 text-center">
          <div className="text-th-dim mb-2">아직 API 키가 없습니다</div>
          <p className="text-sm text-th-dim/60">
            위의 &ldquo;새 키 생성&rdquo; 버튼을 눌러 시작하세요
          </p>
        </div>
      ) : (
        <div className="bg-th-card border border-th-border rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-th-border text-xs text-th-dim uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">이름</th>
                <th className="text-left px-4 py-3 font-medium">키</th>
                <th className="text-left px-4 py-3 font-medium">티어</th>
                <th className="text-left px-4 py-3 font-medium">한도/시간</th>
                <th className="text-left px-4 py-3 font-medium">생성일</th>
                <th className="text-left px-4 py-3 font-medium">마지막 사용</th>
                <th className="text-left px-4 py-3 font-medium">상태</th>
                <th className="text-right px-4 py-3 font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-th-border/50 last:border-0">
                  <td className="px-4 py-3 text-sm text-th-primary font-medium">{k.name}</td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-th-hover px-2 py-1 rounded font-mono text-th-dim">
                      {k.key_preview}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm text-th-dim">{k.tier}</td>
                  <td className="px-4 py-3 text-sm text-th-dim">{k.rate_limit}</td>
                  <td className="px-4 py-3 text-sm text-th-dim">{formatDate(k.created_at)}</td>
                  <td className="px-4 py-3 text-sm text-th-dim">{formatDate(k.last_used_at)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full font-medium ${
                        k.is_active
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {k.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {k.is_active && (
                      <button
                        onClick={() => handleDeactivate(k.id)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        비활성화
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-th-card border border-th-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            {generatedKey ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-th-primary">API 키 생성 완료</h3>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-sm text-amber-400 font-medium">
                    이 키는 다시 표시되지 않습니다. 안전한 곳에 저장하세요.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-th-hover px-3 py-2 rounded-lg text-th-primary break-all">
                    {generatedKey}
                  </code>
                  <button
                    onClick={() => handleCopy(generatedKey)}
                    className="shrink-0 px-3 py-2 text-sm rounded-lg bg-th-accent text-white hover:opacity-90 transition-opacity"
                  >
                    {copied ? "복사됨" : "복사"}
                  </button>
                </div>
                <button
                  onClick={closeModal}
                  className="w-full py-2 text-sm font-medium rounded-lg border border-th-border text-th-primary hover:bg-th-hover transition-colors"
                >
                  닫기
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-th-primary">새 API 키 생성</h3>
                <div>
                  <label className="block text-sm text-th-dim mb-1.5">키 이름</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="예: Production Server"
                    maxLength={100}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-th-hover border border-th-border text-th-primary placeholder:text-th-dim/50 focus:outline-none focus:ring-2 focus:ring-th-accent/50"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={closeModal}
                    className="flex-1 py-2 text-sm font-medium rounded-lg border border-th-border text-th-primary hover:bg-th-hover transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newKeyName.trim()}
                    className="flex-1 py-2 text-sm font-medium rounded-lg bg-th-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {creating ? "생성 중..." : "생성"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
