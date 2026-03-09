'use client'

import type { ResearchProgress, ResearchSource } from '@/lib/research-types'

interface ProgressTrackerProps {
  progress: ResearchProgress
  keyword: string
}

const SOURCE_ICONS: Record<string, string> = {
  youtube: '📺',
  news: '📰',
  db_insight: '📊',
  ai_report: '🤖',
}

const STATUS_ICONS: Record<string, string> = {
  pending: '⏳',
  collecting: '🔄',
  injecting: '💉',
  done: '✅',
  error: '❌',
}

export default function ProgressTracker({ progress, keyword }: ProgressTrackerProps) {
  const pct = progress.totalSteps > 0
    ? Math.round((progress.completedSteps / progress.totalSteps) * 100)
    : 0

  // Group sources by type
  const grouped = progress.sources.reduce<Record<string, ResearchSource[]>>((acc, s) => {
    const key = s.type
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white">{keyword}</h2>
        <p className="text-sm text-[#556a8a] mt-1">리서치 생성 중...</p>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#8899b4]">{progress.currentAction}</span>
          <span className="text-xs font-mono text-[#00e8b8]">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-[#0a1628] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#00e8b8] to-[#00b894] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Source Groups */}
      <div className="space-y-3">
        {Object.entries(grouped).map(([type, sources]) => {
          const icon = SOURCE_ICONS[type] || '📄'
          const doneCount = sources.filter((s) => s.status === 'done').length
          const allDone = doneCount === sources.length
          const hasError = sources.some((s) => s.status === 'error')
          const isActive = sources.some((s) => s.status === 'collecting' || s.status === 'injecting')

          return (
            <div
              key={type}
              className={`p-3 rounded-lg border transition-colors ${
                allDone
                  ? 'bg-[#0a1628] border-[#00e8b8]/20'
                  : hasError
                  ? 'bg-red-500/5 border-red-500/20'
                  : isActive
                  ? 'bg-[#0a1628] border-[#1a2744] animate-pulse'
                  : 'bg-[#060e1a] border-[#1a2744]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{icon}</span>
                  <span className="text-sm font-medium text-white capitalize">
                    {type === 'youtube' ? 'YouTube' : type === 'news' ? '뉴스' : type === 'db_insight' ? 'DB 분석' : 'AI 리포트'}
                  </span>
                </div>
                <span className="text-xs text-[#8899b4]">
                  {allDone ? '✅' : hasError ? '❌' : `${doneCount}/${sources.length}`}
                </span>
              </div>

              {/* Individual sources */}
              {sources.length > 1 && (
                <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto">
                  {sources.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-[#556a8a]">
                      <span className="shrink-0">{STATUS_ICONS[s.status] || '⏳'}</span>
                      <span className="truncate">{s.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* NotebookLM injection step */}
        {progress.phase === 'injecting' && (
          <div className="p-3 rounded-lg border bg-[#0a1628] border-[#1a2744] animate-pulse">
            <div className="flex items-center gap-2">
              <span>📓</span>
              <span className="text-sm font-medium text-white">NotebookLM 소스 주입</span>
            </div>
          </div>
        )}

        {progress.phase === 'waiting' && (
          <div className="p-3 rounded-lg border bg-[#0a1628] border-[#00e8b8]/20">
            <div className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              <span className="text-sm text-[#8899b4]">소스 처리 대기 중 (15초)...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
