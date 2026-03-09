'use client'

import { useState } from 'react'
import type { ResearchConfig, SavedNotebook } from '@/lib/research-types'
import { SAVED_NOTEBOOKS_KEY } from '@/lib/research-types'

const NB_BASE = 'https://notebooklm.google.com'

interface ResearchWizardProps {
  onStart: (config: ResearchConfig) => void
  savedNotebooks: SavedNotebook[]
  onOpenNotebook: (id: string) => void
}

export default function ResearchWizard({ onStart, savedNotebooks, onOpenNotebook }: ResearchWizardProps) {
  const [keyword, setKeyword] = useState('')
  const [sources, setSources] = useState({
    youtube: true,
    news: true,
    dbInsight: true,
    aiReport: true,
  })

  const handleToggle = (key: keyof typeof sources) => {
    setSources((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleStart = () => {
    if (!keyword.trim()) return
    onStart({
      keyword: keyword.trim(),
      sources,
      youtubeCount: 5,
      newsCount: 10,
    })
  }

  const sourceOptions: Array<{ key: keyof typeof sources; icon: string; label: string; desc: string }> = [
    { key: 'youtube', icon: '📺', label: 'YouTube', desc: '영상 5개' },
    { key: 'news', icon: '📰', label: '뉴스', desc: '기사 10개' },
    { key: 'dbInsight', icon: '📊', label: 'DB분석', desc: '채널별' },
    { key: 'aiReport', icon: '🤖', label: 'AI리포트', desc: '종합' },
  ]

  return (
    <div className="space-y-6">
      {/* Main Input */}
      <div className="card p-6 space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-white">AI 투자 리서치</h2>
          <p className="text-sm text-[#556a8a]">키워드를 입력하면 다양한 소스를 수집하여 NotebookLM에서 종합 분석합니다</p>
        </div>

        <div>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            placeholder="리서치 주제 (예: 삼성전자, 비트코인 전망, AI 반도체)"
            className="w-full bg-[#0a1628] border border-[#1a2744] rounded-lg px-4 py-3 text-base text-white placeholder:text-[#556a8a] focus:outline-none focus:border-[#00e8b8]/50 transition-colors text-center"
          />
        </div>

        {/* Source Selection */}
        <div>
          <p className="text-xs font-semibold text-[#556a8a] uppercase tracking-wider mb-3">수집 소스 선택</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {sourceOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleToggle(opt.key)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${
                  sources[opt.key]
                    ? 'bg-[#0a1628] border-[#00e8b8]/40 text-white'
                    : 'bg-[#060e1a] border-[#1a2744] text-[#556a8a] opacity-60'
                }`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <span className="text-xs font-medium">{opt.label}</span>
                <span className="text-[10px] text-[#556a8a]">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={!keyword.trim() || !Object.values(sources).some(Boolean)}
          className="w-full py-3 bg-gradient-to-r from-[#00e8b8] to-[#00b894] text-[#040810] text-sm font-bold rounded-lg hover:shadow-[0_0_20px_rgba(0,232,184,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          리서치 노트북 생성
        </button>
      </div>

      {/* Saved Notebooks */}
      {savedNotebooks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#556a8a] uppercase tracking-wider px-1">이전 리서치</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedNotebooks.map((nb) => (
              <div key={nb.id} className="card p-4 hover:border-[#00e8b8]/30 transition-colors group">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium text-white truncate">{nb.title}</h4>
                    <p className="text-[10px] text-[#556a8a] mt-1">
                      {new Date(nb.createdAt).toLocaleDateString('ko-KR')} · 소스 {nb.sourceCount}개
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                    <button
                      onClick={() => onOpenNotebook(nb.id)}
                      className="p-1.5 rounded hover:bg-[#1a2744] text-[#556a8a] hover:text-[#00e8b8] transition-colors"
                      title="열기"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                      </svg>
                    </button>
                    <a
                      href={`${NB_BASE}/notebook/${nb.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded hover:bg-[#1a2744] text-[#556a8a] hover:text-[#00e8b8] transition-colors"
                      title="NotebookLM에서 열기"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
