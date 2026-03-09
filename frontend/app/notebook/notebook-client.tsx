'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { NotebookChatMessage } from '@/lib/types'
import type {
  ResearchConfig,
  ResearchProgress,
  ResearchSource,
  ArtifactItem,
  SavedNotebook,
  NewsItem,
  DbInsight,
} from '@/lib/research-types'
import { ARTIFACT_CONFIGS, SAVED_NOTEBOOKS_KEY } from '@/lib/research-types'
import ResearchWizard from '@/components/research/research-wizard'
import ProgressTracker from '@/components/research/progress-tracker'
import ChatPanel from '@/components/research/chat-panel'
import ArtifactGrid from '@/components/research/artifact-card'
import SourceList from '@/components/research/source-list'

// --- Extension bridge ---
let requestId = 0
const pendingRequests = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

function extensionCall<T = unknown>(action: string, data?: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++requestId
    const timeout = setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error('확장 프로그램 응답 시간 초과'))
    }, 120000)

    pendingRequests.set(id, {
      resolve: (v) => { clearTimeout(timeout); pendingRequests.delete(id); resolve(v as T) },
      reject: (e) => { clearTimeout(timeout); pendingRequests.delete(id); reject(e) },
    })

    window.postMessage({ type: 'MONEYTECH_NB_REQUEST', id, action, data }, '*')
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (!event.data || event.data.type !== 'MONEYTECH_NB_RESPONSE') return
    const { id, success, data, error } = event.data
    const pending = pendingRequests.get(id)
    if (!pending) return
    if (success) pending.resolve(data)
    else pending.reject(new Error(error || 'Unknown error'))
  })
}

const NB_BASE = 'https://notebooklm.google.com'

type Stage = 'wizard' | 'progress' | 'result'

export default function NotebookClient() {
  const [extensionReady, setExtensionReady] = useState(false)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [stage, setStage] = useState<Stage>('wizard')
  const [error, setError] = useState('')

  // Research state
  const [keyword, setKeyword] = useState('')
  const [notebookId, setNotebookId] = useState<string | null>(null)
  const [progress, setProgress] = useState<ResearchProgress>({
    phase: 'idle',
    notebookId: null,
    totalSteps: 0,
    completedSteps: 0,
    currentAction: '',
    sources: [],
  })
  const [collectedSources, setCollectedSources] = useState<ResearchSource[]>([])

  // Result stage state
  const [chatMessages, setChatMessages] = useState<NotebookChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>(
    ARTIFACT_CONFIGS.map((c) => ({ id: '', type: c.type, label: c.label, status: 'idle' }))
  )
  const [savedNotebooks, setSavedNotebooks] = useState<SavedNotebook[]>([])

  // Polling ref
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Load saved notebooks
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_NOTEBOOKS_KEY)
      if (saved) setSavedNotebooks(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  // Extension ready check
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return
      if (event.data?.type === 'MONEYTECH_NB_READY') setExtensionReady(true)
    }
    window.addEventListener('message', handleMessage)
    window.postMessage({ type: 'MONEYTECH_NB_PING' }, '*')
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Auth check
  useEffect(() => {
    if (!extensionReady) return
    extensionCall<{ authenticated: boolean }>('checkAuth')
      .then((r) => setAuthenticated(r.authenticated))
      .catch(() => setAuthenticated(false))
  }, [extensionReady])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [])

  // --- Research Flow ---
  const startResearch = useCallback(async (config: ResearchConfig) => {
    setKeyword(config.keyword)
    setStage('progress')
    setError('')
    setChatMessages([])
    setConversationId(null)
    setArtifacts(ARTIFACT_CONFIGS.map((c) => ({ id: '', type: c.type, label: c.label, status: 'idle' })))

    const allSources: ResearchSource[] = []
    let totalSteps = 1 // notebook creation
    if (config.sources.youtube) totalSteps += config.youtubeCount + config.youtubeCount // collect + inject
    if (config.sources.news) totalSteps += config.newsCount + config.newsCount
    if (config.sources.dbInsight) totalSteps += 2 // collect + inject
    if (config.sources.aiReport) totalSteps += 2
    totalSteps += 1 // waiting step

    let completed = 0
    const updateProgress = (action: string, phase: ResearchProgress['phase'] = 'collecting') => {
      setProgress({
        phase,
        notebookId: null,
        totalSteps,
        completedSteps: completed,
        currentAction: action,
        sources: [...allSources],
      })
    }

    try {
      // Step 1: Create notebook
      updateProgress('노트북 생성 중...')
      const nb = await extensionCall<{ id: string }>('createNotebook', { title: `${config.keyword} - ${new Date().toLocaleDateString('ko-KR')}` })
      const nbId = nb.id
      setNotebookId(nbId)
      completed++
      updateProgress('노트북 생성 완료')

      // Step 2: Collect data in parallel
      updateProgress('데이터 수집 중...')

      const collectPromises: Promise<void>[] = []

      // YouTube
      let youtubeUrls: string[] = []
      if (config.sources.youtube) {
        collectPromises.push(
          fetch(`/api/search/youtube?keyword=${encodeURIComponent(config.keyword)}&maxResults=${config.youtubeCount}`)
            .then((r) => r.json())
            .then((data) => {
              const results = data.results || []
              youtubeUrls = results.map((r: { videoId: string }) => `https://www.youtube.com/watch?v=${r.videoId}`)
              for (const r of results) {
                allSources.push({ type: 'youtube', title: r.title, url: `https://www.youtube.com/watch?v=${r.videoId}`, status: 'done' })
                completed++
              }
              updateProgress(`YouTube ${results.length}개 수집 완료`)
            })
            .catch(() => { /* YouTube collection failed silently */ })
        )
      }

      // News
      let newsItems: NewsItem[] = []
      if (config.sources.news) {
        collectPromises.push(
          fetch(`/api/research/news?keyword=${encodeURIComponent(config.keyword)}&maxResults=${config.newsCount}`)
            .then((r) => r.json())
            .then((data) => {
              newsItems = data.items || []
              for (const item of newsItems) {
                allSources.push({ type: 'news', title: item.title, url: item.link, status: 'done' })
                completed++
              }
              updateProgress(`뉴스 ${newsItems.length}개 수집 완료`)
            })
            .catch(() => { /* News collection failed silently */ })
        )
      }

      // DB Insights
      let dbInsight: DbInsight | null = null
      if (config.sources.dbInsight) {
        collectPromises.push(
          fetch(`/api/research/db-insights?keyword=${encodeURIComponent(config.keyword)}`)
            .then((r) => r.json())
            .then((data) => {
              if (data.summary) {
                dbInsight = data
                allSources.push({ type: 'db_insight', title: `${config.keyword} DB 분석`, content: data.summary, status: 'done' })
                completed++
              }
              updateProgress('DB 분석 완료')
            })
            .catch(() => { completed++; updateProgress('DB 분석 건너뜀') })
        )
      }

      // AI Report (uses existing search/report API)
      let reportText = ''
      if (config.sources.aiReport && config.sources.youtube) {
        // Wait for YouTube to finish first, then generate report
        collectPromises.push(
          (async () => {
            // Wait a bit for YouTube results
            await new Promise((r) => setTimeout(r, 3000))
            if (youtubeUrls.length === 0) { completed++; return }

            try {
              const videoIds = youtubeUrls.map((u) => new URL(u).searchParams.get('v')).filter(Boolean)
              const res = await fetch('/api/search/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoIds: videoIds.slice(0, 5) }),
              })
              const data = await res.json()
              if (data.report) {
                reportText = `[AI 종합 분석]\n${data.report.overall_summary}\n\n공통 의견: ${data.report.consensus}\n\n주요 근거:\n${(data.report.key_arguments || []).map((a: string) => `- ${a}`).join('\n')}`
                allSources.push({ type: 'ai_report', title: `${config.keyword} AI 종합 리포트`, content: reportText, status: 'done' })
                completed++
              }
              updateProgress('AI 리포트 생성 완료')
            } catch {
              completed++
              updateProgress('AI 리포트 건너뜀')
            }
          })()
        )
      }

      await Promise.all(collectPromises)
      updateProgress('NotebookLM에 소스 주입 중...', 'injecting')

      // Step 3: Inject sources into NotebookLM
      // YouTube URLs
      for (const url of youtubeUrls) {
        try {
          await extensionCall('addSourceUrl', { notebookId: nbId, url })
          completed++
          updateProgress(`소스 주입 중... (${completed}/${totalSteps})`, 'injecting')
        } catch {
          // Some URLs may fail, continue
        }
      }

      // News URLs
      for (const item of newsItems) {
        try {
          await extensionCall('addSourceUrl', { notebookId: nbId, url: item.link })
          completed++
          updateProgress(`소스 주입 중... (${completed}/${totalSteps})`, 'injecting')
        } catch {
          // Continue on error
        }
      }

      // DB Insight text
      if (dbInsight && (dbInsight as DbInsight).summary) {
        try {
          await extensionCall('addSourceText', {
            notebookId: nbId,
            title: `${config.keyword} MoneyTech DB 분석`,
            content: (dbInsight as DbInsight).summary,
          })
          completed++
          updateProgress('DB 분석 텍스트 주입 완료', 'injecting')
        } catch { /* ignore */ }
      }

      // AI Report text
      if (reportText) {
        try {
          await extensionCall('addSourceText', {
            notebookId: nbId,
            title: `${config.keyword} AI 종합 리포트`,
            content: reportText,
          })
          completed++
          updateProgress('AI 리포트 텍스트 주입 완료', 'injecting')
        } catch { /* ignore */ }
      }

      // Step 4: Wait for source processing
      updateProgress('소스 처리 대기 중...', 'waiting')
      await new Promise((r) => setTimeout(r, 15000))
      completed = totalSteps

      // Save to local storage
      const savedNb: SavedNotebook = {
        id: nbId,
        title: `${config.keyword} - ${new Date().toLocaleDateString('ko-KR')}`,
        keyword: config.keyword,
        sourceCount: allSources.length,
        createdAt: new Date().toISOString(),
      }
      setSavedNotebooks((prev) => {
        const updated = [savedNb, ...prev.filter((n) => n.id !== nbId)].slice(0, 20)
        localStorage.setItem(SAVED_NOTEBOOKS_KEY, JSON.stringify(updated))
        return updated
      })

      setCollectedSources(allSources)
      setProgress({ ...progress, phase: 'ready', completedSteps: totalSteps, totalSteps, currentAction: '완료', sources: allSources, notebookId: nbId })
      setStage('result')

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Research failed')
      setStage('wizard')
    }
  }, [])

  // Open existing notebook
  const openNotebook = useCallback(async (id: string) => {
    const saved = savedNotebooks.find((n) => n.id === id)
    if (saved) {
      setKeyword(saved.keyword || saved.title)
      setNotebookId(id)
      setCollectedSources([])
      setChatMessages([])
      setConversationId(null)
      setArtifacts(ARTIFACT_CONFIGS.map((c) => ({ id: '', type: c.type, label: c.label, status: 'idle' })))
      setStage('result')
    }
  }, [savedNotebooks])

  // --- Chat ---
  const handleChat = useCallback(async (question: string) => {
    if (!notebookId) return
    setChatMessages((prev) => [...prev, { role: 'user', content: question }])
    setChatLoading(true)

    try {
      const data = await extensionCall<{ answer: string; conversationId: string; references: Array<{ text: string }> }>(
        'chat', { notebookId, question, conversationId }
      )
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer || '응답이 비어있습니다', references: data.references },
      ])
      if (data.conversationId) setConversationId(data.conversationId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setChatMessages((prev) => [...prev, { role: 'assistant', content: `오류: ${msg}` }])
    } finally { setChatLoading(false) }
  }, [notebookId, conversationId])

  // --- Artifact generation ---
  const handleGenerateArtifact = useCallback(async (type: ArtifactItem['type']) => {
    if (!notebookId) return
    const config = ARTIFACT_CONFIGS.find((c) => c.type === type)
    if (!config) return

    setArtifacts((prev) => prev.map((a) => a.type === type ? { ...a, status: 'generating' as const } : a))

    try {
      await extensionCall(config.action, { notebookId, ...config.extraData })
      setArtifacts((prev) => prev.map((a) =>
        a.type === type ? { ...a, status: 'completed' as const } : a
      ))
    } catch (e) {
      setArtifacts((prev) => prev.map((a) =>
        a.type === type ? { ...a, status: 'error' as const, errorMessage: e instanceof Error ? e.message : String(e) } : a
      ))
    }
  }, [notebookId])

  // --- Back to wizard ---
  const handleBack = useCallback(() => {
    setStage('wizard')
    setNotebookId(null)
    setKeyword('')
    setChatMessages([])
    setConversationId(null)
    setCollectedSources([])
    setArtifacts(ARTIFACT_CONFIGS.map((c) => ({ id: '', type: c.type, label: c.label, status: 'idle' })))
    setError('')
  }, [])

  // --- Extension not installed ---
  if (!extensionReady) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="card p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-th-secondary flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff5757" strokeWidth="1.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-th-primary">Chrome 확장 프로그램 필요</h3>
            <p className="text-sm text-th-muted">NotebookLM 기능을 사용하려면 MoneyTech 확장 프로그램을 설치해야 합니다.</p>
          </div>
          <div className="max-w-lg mx-auto p-5 bg-th-secondary rounded-lg border border-th-border space-y-4">
            <h4 className="text-sm font-semibold text-th-primary">설치 방법</h4>
            <ol className="text-sm text-th-muted space-y-3">
              {['chrome://extensions 접속', '우측 상단 개발자 모드 활성화', '"압축해제된 확장 프로그램을 로드합니다" 클릭', 'extension/ 폴더 선택', '이 페이지를 새로고침'].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded bg-th-accent-soft flex items-center justify-center text-th-accent text-xs font-bold">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    )
  }

  // --- Auth checking ---
  if (authenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Spinner size="lg" />
          <p className="text-sm text-th-dim">인증 확인 중...</p>
        </div>
      </div>
    )
  }

  // --- Not authenticated ---
  if (!authenticated) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="card p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-th-secondary flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--th-accent)" strokeWidth="1.5">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-th-primary">Google 로그인 필요</h3>
            <p className="text-sm text-th-muted">NotebookLM을 사용하려면 Chrome에서 Google에 로그인되어 있어야 합니다.</p>
          </div>
          <div className="max-w-lg mx-auto p-5 bg-th-secondary rounded-lg border border-th-border space-y-3">
            <ol className="text-sm text-th-muted space-y-2">
              <li>1. <a href="https://notebooklm.google.com" target="_blank" rel="noopener noreferrer" className="text-th-accent underline">notebooklm.google.com</a>에 Google 계정으로 로그인</li>
              <li>2. 이 페이지를 새로고침</li>
            </ol>
            <button onClick={() => {
              setAuthenticated(null)
              extensionCall<{ authenticated: boolean }>('checkAuth')
                .then((r) => setAuthenticated(r.authenticated))
                .catch(() => setAuthenticated(false))
            }} className="btn-accent px-5 py-2.5 text-sm">
              다시 확인
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Stage 1: Wizard ---
  if (stage === 'wizard') {
    return (
      <div className="space-y-6">
        <PageHeader />
        {error && <div className="card p-4 border-red-500/30 bg-red-500/5 text-red-400 text-sm">{error}</div>}
        <ResearchWizard
          onStart={startResearch}
          savedNotebooks={savedNotebooks}
          onOpenNotebook={openNotebook}
        />
      </div>
    )
  }

  // --- Stage 2: Progress ---
  if (stage === 'progress') {
    return (
      <div className="space-y-6">
        <PageHeader />
        <ProgressTracker progress={progress} keyword={keyword} />
      </div>
    )
  }

  // --- Stage 3: Result ---
  return (
    <div className="space-y-6">
      <PageHeader />

      {/* Result Header */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-th-primary">{keyword}</h2>
            <p className="text-xs text-th-dim mt-1">
              {new Date().toLocaleDateString('ko-KR')} · 소스 {collectedSources.length}개
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              className="px-3 py-2 text-xs text-th-dim hover:text-th-primary border border-th-border rounded-lg hover:border-th-strong transition-colors"
            >
              새 리서치
            </button>
            {notebookId && (
              <a
                href={`${NB_BASE}/notebook/${notebookId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-accent px-4 py-2 text-xs flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                NotebookLM
              </a>
            )}
          </div>
        </div>
      </div>

      {error && <div className="card p-4 border-red-500/30 bg-red-500/5 text-red-400 text-sm">{error}</div>}

      {/* Q&A Chat */}
      <ChatPanel
        messages={chatMessages}
        loading={chatLoading}
        onSend={handleChat}
      />

      {/* Artifact Generation */}
      {notebookId && (
        <div className="card p-4">
          <ArtifactGrid
            artifacts={artifacts}
            notebookId={notebookId}
            onGenerate={handleGenerateArtifact}
          />
        </div>
      )}

      {/* Source List */}
      {collectedSources.length > 0 && (
        <div className="card p-4">
          <SourceList sources={collectedSources} />
        </div>
      )}
    </div>
  )
}

// --- Sub-components ---

function PageHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-th-primary tracking-tight">AI 투자 리서치</h1>
          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#7c6cf0]/20 text-[#7c6cf0] border border-[#7c6cf0]/30 rounded">Beta</span>
        </div>
        <p className="text-sm text-th-dim mt-1">YouTube + 뉴스 + DB 분석을 NotebookLM으로 종합 분석</p>
      </div>
      <a href={NB_BASE} target="_blank" rel="noopener noreferrer"
        className="text-xs text-th-dim hover:text-th-accent transition-colors flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        NotebookLM
      </a>
    </div>
  )
}

function Spinner({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'h-6 w-6' : 'h-3 w-3'
  return (
    <svg className={`animate-spin ${cls}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
