'use client'

import type { ResearchSource } from '@/lib/research-types'

const TYPE_ICONS: Record<string, string> = {
  youtube: '📺',
  news: '📰',
  db_insight: '📊',
  ai_report: '🤖',
}

interface SourceListProps {
  sources: ResearchSource[]
}

export default function SourceList({ sources }: SourceListProps) {
  if (sources.length === 0) return null

  const byType = sources.reduce<Record<string, ResearchSource[]>>((acc, s) => {
    if (!acc[s.type]) acc[s.type] = []
    acc[s.type].push(s)
    return acc
  }, {})

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-[#556a8a] uppercase tracking-wider">
        등록된 소스 ({sources.length}개)
      </h3>
      <div className="flex flex-wrap gap-2">
        {Object.entries(byType).map(([type, items]) =>
          items.map((s, i) => (
            <span
              key={`${type}-${i}`}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-[#0a1628] border border-[#1a2744] rounded-full text-[#8899b4]"
            >
              <span>{TYPE_ICONS[type] || '📄'}</span>
              <span className="truncate max-w-[200px]">{s.title}</span>
            </span>
          ))
        )}
      </div>
    </div>
  )
}
