"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"

const STORAGE_KEY = "moneytech-dashboard-layout"

export interface DashboardSection {
  id: string
  label: string
  content: ReactNode
}

interface LayoutState {
  order: string[]
  hidden: string[]
}

function getStoredLayout(sectionIds: string[]): LayoutState {
  if (typeof window === "undefined") return { order: sectionIds, hidden: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as LayoutState
      // Merge with current sections (handle added/removed sections)
      const knownIds = new Set(sectionIds)
      const validOrder = parsed.order.filter((id) => knownIds.has(id))
      const missing = sectionIds.filter((id) => !validOrder.includes(id))
      return {
        order: [...validOrder, ...missing],
        hidden: parsed.hidden.filter((id) => knownIds.has(id)),
      }
    }
  } catch { /* ignore */ }
  return { order: sectionIds, hidden: [] }
}

function saveLayout(layout: LayoutState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch { /* ignore */ }
}

export function DashboardLayout({ sections }: { sections: DashboardSection[] }) {
  const sectionIds = sections.map((s) => s.id)
  const [layout, setLayout] = useState<LayoutState>({ order: sectionIds, hidden: [] })
  const [editing, setEditing] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setLayout(getStoredLayout(sectionIds))
    setMounted(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateLayout = useCallback((next: LayoutState) => {
    setLayout(next)
    saveLayout(next)
  }, [])

  const toggleVisibility = useCallback((id: string) => {
    setLayout((prev) => {
      const next = {
        ...prev,
        hidden: prev.hidden.includes(id)
          ? prev.hidden.filter((h) => h !== id)
          : [...prev.hidden, id],
      }
      saveLayout(next)
      return next
    })
  }, [])

  const moveUp = useCallback((idx: number) => {
    if (idx <= 0) return
    setLayout((prev) => {
      const next = [...prev.order]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      const updated = { ...prev, order: next }
      saveLayout(updated)
      return updated
    })
  }, [])

  const moveDown = useCallback((idx: number) => {
    setLayout((prev) => {
      if (idx >= prev.order.length - 1) return prev
      const next = [...prev.order]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      const updated = { ...prev, order: next }
      saveLayout(updated)
      return updated
    })
  }, [])

  const resetLayout = useCallback(() => {
    const next = { order: sectionIds, hidden: [] }
    updateLayout(next)
  }, [sectionIds, updateLayout])

  const handleDragStart = (idx: number) => setDragIdx(idx)
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    setLayout((prev) => {
      const next = [...prev.order]
      const [moved] = next.splice(dragIdx, 1)
      next.splice(idx, 0, moved)
      const updated = { ...prev, order: next }
      saveLayout(updated)
      return updated
    })
    setDragIdx(idx)
  }
  const handleDragEnd = () => setDragIdx(null)

  const sectionMap = new Map(sections.map((s) => [s.id, s]))

  // During SSR or before hydration, render in original order
  const orderedSections = mounted
    ? layout.order.map((id) => sectionMap.get(id)).filter(Boolean) as DashboardSection[]
    : sections

  const visibleSections = editing
    ? orderedSections
    : orderedSections.filter((s) => !layout.hidden.includes(s.id))

  return (
    <>
      {/* Edit toggle button */}
      <div className="flex justify-end">
        <button
          onClick={() => setEditing((p) => !p)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition ${
            editing
              ? "bg-th-accent/15 text-th-accent border border-th-accent/30"
              : "text-th-dim hover:bg-th-hover/50 border border-th-border/40"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {editing ? (
              <><path d="M20 6 9 17l-5-5" /></>
            ) : (
              <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>
            )}
          </svg>
          {editing ? "편집 완료" : "레이아웃 편집"}
        </button>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="glass-card-elevated rounded-2xl p-4 border border-th-accent/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-th-primary">섹션 순서 & 표시 설정</span>
            <button
              onClick={resetLayout}
              className="text-[10px] text-th-dim hover:text-th-accent transition px-2 py-1 rounded-lg hover:bg-th-hover/50"
            >
              초기화
            </button>
          </div>
          <div className="space-y-1">
            {layout.order.map((id, idx) => {
              const section = sectionMap.get(id)
              if (!section) return null
              const isHidden = layout.hidden.includes(id)
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl transition cursor-grab active:cursor-grabbing ${
                    dragIdx === idx ? "bg-th-accent/10 border border-th-accent/30" : "hover:bg-th-hover/50 border border-transparent"
                  } ${isHidden ? "opacity-50" : ""}`}
                >
                  {/* Drag handle */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-th-dim shrink-0">
                    <circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" />
                    <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
                    <circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" />
                  </svg>

                  <span className={`text-xs font-medium flex-1 ${isHidden ? "text-th-dim line-through" : "text-th-primary"}`}>
                    {section.label}
                  </span>

                  {/* Move buttons */}
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="p-1 rounded text-th-dim hover:text-th-primary disabled:opacity-20 transition"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6" /></svg>
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === layout.order.length - 1}
                    className="p-1 rounded text-th-dim hover:text-th-primary disabled:opacity-20 transition"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                  </button>

                  {/* Visibility toggle */}
                  <button
                    onClick={() => toggleVisibility(id)}
                    className={`p-1 rounded transition ${isHidden ? "text-th-dim hover:text-th-accent" : "text-th-accent hover:text-th-dim"}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {isHidden ? (
                        <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
                      ) : (
                        <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                      )}
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Render visible sections */}
      {visibleSections.map((section) => (
        <div key={section.id}>
          {editing && layout.hidden.includes(section.id) ? (
            <div className="opacity-40 pointer-events-none relative">
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <span className="text-xs font-semibold text-th-dim bg-th-bg/80 px-3 py-1 rounded-lg">숨김</span>
              </div>
              {section.content}
            </div>
          ) : (
            section.content
          )}
        </div>
      ))}
    </>
  )
}
