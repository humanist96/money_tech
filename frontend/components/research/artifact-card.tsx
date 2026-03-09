'use client'

import type { ArtifactItem } from '@/lib/research-types'
import { ARTIFACT_CONFIGS } from '@/lib/research-types'

const NB_BASE = 'https://notebooklm.google.com'

interface ArtifactGridProps {
  artifacts: ArtifactItem[]
  notebookId: string
  onGenerate: (type: ArtifactItem['type']) => void
}

const ICONS: Record<string, React.ReactNode> = {
  audio: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ),
  report: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  study: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  quiz: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
}

export default function ArtifactGrid({ artifacts, notebookId, onGenerate }: ArtifactGridProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-th-primary">NotebookLM 산출물</h3>

      {/* Generate Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ARTIFACT_CONFIGS.map((config) => {
          const artifact = artifacts.find((a) => a.type === config.type)
          const isGenerating = artifact?.status === 'generating'
          const isCompleted = artifact?.status === 'completed'

          return (
            <button
              key={config.type}
              onClick={() => onGenerate(config.type)}
              disabled={isGenerating}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all text-center group ${
                isCompleted
                  ? 'bg-th-accent/5 border-th-accent/30 hover:border-th-accent/50'
                  : isGenerating
                  ? 'bg-th-secondary border-th-border opacity-70 cursor-wait'
                  : 'bg-th-card-deep border-th-border hover:bg-th-secondary hover:border-th-accent'
              }`}
            >
              <div className={`transition-colors ${
                isCompleted ? 'text-th-accent' : isGenerating ? 'text-th-dim animate-pulse' : 'text-th-dim group-hover:text-th-accent'
              }`}>
                {isGenerating ? <Spinner /> : ICONS[config.icon]}
              </div>
              <div>
                <p className="text-xs font-semibold text-th-primary">{config.label}</p>
                <p className="text-[10px] text-th-dim mt-0.5">
                  {isCompleted ? '완료' : isGenerating ? '생성 중...' : config.desc}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Generated Artifacts List */}
      {artifacts.filter((a) => a.status !== 'idle').length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-th-dim uppercase tracking-wider">생성된 산출물</h4>
          {artifacts.filter((a) => a.status !== 'idle').map((artifact) => (
            <div key={artifact.type} className="flex items-center justify-between p-3 bg-th-card-deep rounded-lg border border-th-border">
              <div className="flex items-center gap-3">
                <span className={artifact.status === 'completed' ? 'text-th-accent' : artifact.status === 'error' ? 'text-red-400' : 'text-th-dim'}>
                  {artifact.status === 'completed' ? '✅' : artifact.status === 'error' ? '❌' : '⏳'}
                </span>
                <div>
                  <p className="text-sm text-th-primary">{artifact.label}</p>
                  <p className="text-[10px] text-th-dim">
                    {artifact.status === 'generating' && '생성 중... (3~5분 소요)'}
                    {artifact.status === 'completed' && '생성 완료'}
                    {artifact.status === 'error' && (artifact.errorMessage || '생성 실패')}
                  </p>
                </div>
              </div>
              <a
                href={`${NB_BASE}/notebook/${notebookId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-th-accent hover:underline flex items-center gap-1"
              >
                NB에서 확인
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Hint */}
      <div className="flex items-center gap-2 p-3 bg-th-card-deep rounded-lg border border-th-border">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--th-accent)" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <p className="text-xs text-th-muted">
          오디오/보고서/퀴즈는{' '}
          <a href={`${NB_BASE}/notebook/${notebookId}`} target="_blank" rel="noopener noreferrer" className="text-th-accent underline">
            NotebookLM에서 직접 확인
          </a>
          하면 가장 좋습니다.
        </p>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
