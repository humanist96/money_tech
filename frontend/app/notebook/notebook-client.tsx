'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import type {
  NotebookItem,
  NotebookDetail,
  NotebookChatMessage,
  NotebookQuizQuestion,
} from '@/lib/types'

type ActiveTab = 'chat' | 'audio' | 'report' | 'quiz'

const NB_COOKIES_KEY = 'moneytech_nb_cookies'

function getSavedCookies(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(NB_COOKIES_KEY) || ''
}

function saveCookies(cookies: string) {
  localStorage.setItem(NB_COOKIES_KEY, cookies)
}

function nbFetch(url: string, options: RequestInit = {}) {
  const cookies = getSavedCookies()
  const headers = new Headers(options.headers || {})
  if (cookies) headers.set('x-nb-cookies', cookies)
  return fetch(url, { ...options, headers })
}

export default function NotebookClient() {
  const searchParams = useSearchParams()
  const initialId = searchParams.get('id')

  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [notebooks, setNotebooks] = useState<NotebookItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<NotebookDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Cookie settings
  const [showSettings, setShowSettings] = useState(false)
  const [cookieInput, setCookieInput] = useState('')

  // Create notebook
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  // Active tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat')

  // Chat
  const [chatMessages, setChatMessages] = useState<NotebookChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Audio
  const [audioStatus, setAudioStatus] = useState<string | null>(null)
  const [audioArtifactId, setAudioArtifactId] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [generatingAudio, setGeneratingAudio] = useState(false)

  // Report
  const [reportContent, setReportContent] = useState<string | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)

  // Quiz
  const [quizQuestions, setQuizQuestions] = useState<NotebookQuizQuestion[]>([])
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({})
  const [quizRevealed, setQuizRevealed] = useState(false)
  const [generatingQuiz, setGeneratingQuiz] = useState(false)

  // Check auth on mount + listen for extension cookie updates
  useEffect(() => {
    function checkAuth() {
      const cookies = getSavedCookies()
      if (!cookies) {
        setAuthenticated(false)
        return
      }
      nbFetch('/api/notebook/auth/status')
        .then((r) => r.json())
        .then((data) => setAuthenticated(data.authenticated === true))
        .catch(() => setAuthenticated(false))
    }

    checkAuth()

    // Listen for cookie updates from Chrome extension
    const handleExtensionUpdate = () => checkAuth()
    window.addEventListener('nb-cookies-updated', handleExtensionUpdate)
    return () => window.removeEventListener('nb-cookies-updated', handleExtensionUpdate)
  }, [])

  // Load notebooks
  const loadNotebooks = useCallback(async () => {
    try {
      const res = await nbFetch('/api/notebook/notebooks')
      const data = await res.json()
      if (Array.isArray(data)) setNotebooks(data)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (authenticated) loadNotebooks()
  }, [authenticated, loadNotebooks])

  // Load notebook detail
  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id)
    setLoading(true)
    setError('')
    resetFeatureState()
    try {
      const res = await nbFetch(`/api/notebook/notebooks/${id}`)
      const data = await res.json()
      if (res.ok) setDetail(data)
      else setError(data.error || 'Failed to load notebook')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-select notebook from URL query param
  useEffect(() => {
    if (authenticated && initialId) loadDetail(initialId)
  }, [authenticated, initialId, loadDetail])

  function resetFeatureState() {
    setChatMessages([])
    setChatInput('')
    setConversationId(null)
    setAudioStatus(null)
    setAudioArtifactId(null)
    setAudioUrl(null)
    setReportContent(null)
    setQuizQuestions([])
    setQuizAnswers({})
    setQuizRevealed(false)
  }

  // Save cookies and verify
  const handleSaveCookies = useCallback(async () => {
    if (!cookieInput.trim()) return
    saveCookies(cookieInput.trim())
    setShowSettings(false)

    const res = await nbFetch('/api/notebook/auth/status')
    const data = await res.json()
    setAuthenticated(data.authenticated === true)
    if (!data.authenticated) {
      setError('쿠키 인증 실패. 쿠키가 올바른지 확인해주세요.')
    }
  }, [cookieInput])

  // Create notebook
  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await nbFetch('/api/notebook/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewTitle('')
        await loadNotebooks()
        loadDetail(data.id)
      }
    } catch { /* silent */ }
    finally { setCreating(false) }
  }, [newTitle, loadNotebooks, loadDetail])

  // Chat
  const handleChat = useCallback(async () => {
    if (!chatInput.trim() || !selectedId) return
    const question = chatInput
    setChatInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: question }])
    setChatLoading(true)

    try {
      const res = await nbFetch(`/api/notebook/notebooks/${selectedId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, conversation_id: conversationId }),
      })
      const data = await res.json()
      if (res.ok) {
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.answer, references: data.references },
        ])
        if (data.conversationId) setConversationId(data.conversationId)
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: '응답 실패' }])
    } finally { setChatLoading(false) }
  }, [chatInput, selectedId, conversationId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Audio
  const handleGenerateAudio = useCallback(async () => {
    if (!selectedId) return
    setGeneratingAudio(true)
    setAudioStatus('generating')
    setAudioUrl(null)

    try {
      const res = await nbFetch(`/api/notebook/notebooks/${selectedId}/audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'deep-dive' }),
      })
      const data = await res.json()
      if (res.ok && data.id) {
        setAudioArtifactId(data.id)
        pollAudioStatus(selectedId, data.id)
      } else {
        setAudioStatus('failed')
        setGeneratingAudio(false)
      }
    } catch {
      setAudioStatus('failed')
      setGeneratingAudio(false)
    }
  }, [selectedId])

  const pollAudioStatus = useCallback(async (notebookId: string, artifactId: string) => {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      try {
        const res = await nbFetch(`/api/notebook/notebooks/${notebookId}/audio/${artifactId}/status`)
        const data = await res.json()
        setAudioStatus(data.status)
        if (data.status === 'completed') {
          setAudioUrl(`/api/notebook/notebooks/${notebookId}/audio/${artifactId}/download`)
          setGeneratingAudio(false)
          return
        }
        if (data.status === 'failed') { setGeneratingAudio(false); return }
      } catch { /* continue */ }
    }
    setAudioStatus('timeout')
    setGeneratingAudio(false)
  }, [])

  // Report
  const handleGenerateReport = useCallback(async (type: string = 'briefing') => {
    if (!selectedId) return
    setGeneratingReport(true)
    setReportContent(null)
    try {
      const res = await nbFetch(`/api/notebook/notebooks/${selectedId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_type: type }),
      })
      const data = await res.json()
      if (res.ok) setReportContent(data.content)
    } catch { /* silent */ }
    finally { setGeneratingReport(false) }
  }, [selectedId])

  // Quiz
  const handleGenerateQuiz = useCallback(async () => {
    if (!selectedId) return
    setGeneratingQuiz(true)
    setQuizQuestions([])
    setQuizAnswers({})
    setQuizRevealed(false)
    try {
      const res = await nbFetch(`/api/notebook/notebooks/${selectedId}/quiz`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.questions) setQuizQuestions(data.questions)
    } catch { /* silent */ }
    finally { setGeneratingQuiz(false) }
  }, [selectedId])

  // --- Auth / Settings screen ---
  if (authenticated === null) {
    return <div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" /></div>
  }

  if (!authenticated) {
    return (
      <div className="space-y-6">
        <PageHeader onSettingsClick={() => setShowSettings(true)} />
        <div className="card p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#0a1628] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00e8b8" strokeWidth="1.5">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Google NotebookLM 연결</h3>
            <p className="text-sm text-[#8899b4]">
              Chrome 확장 프로그램으로 원클릭 연동하거나, 수동으로 쿠키를 입력하세요.
            </p>
          </div>

          {/* Method 1: Chrome Extension */}
          <div className="max-w-lg mx-auto">
            <div className="p-4 bg-[#0a1628] rounded-lg border border-[#00e8b8]/20 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#00e8b8]/10 flex items-center justify-center text-[#00e8b8] text-xs font-bold">1</div>
                <h4 className="text-sm font-semibold text-white">Chrome 확장 프로그램 (추천)</h4>
              </div>
              <ol className="text-xs text-[#8899b4] space-y-1.5 ml-8">
                <li>Chrome에서 <a href="https://notebooklm.google.com" target="_blank" rel="noopener noreferrer" className="text-[#00e8b8] underline">notebooklm.google.com</a>에 Google 로그인</li>
                <li>확장 프로그램 설치 후 아이콘 클릭</li>
                <li>&quot;연결하기&quot; 버튼 클릭 - 끝!</li>
              </ol>
              <div className="flex gap-2 ml-8">
                <a
                  href="https://github.com/humanist96/money_tech/tree/main/extension"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#00e8b8] to-[#00b894] text-[#040810] text-xs font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(0,232,184,0.3)] transition-all"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  확장 프로그램 다운로드
                </a>
              </div>
              <p className="text-[10px] text-[#556a8a] ml-8">
                chrome://extensions &gt; 개발자 모드 ON &gt; &quot;압축해제된 확장 프로그램을 로드합니다&quot; &gt; extension 폴더 선택
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <div className="flex-1 h-px bg-[#1a2744]" />
            <span className="text-xs text-[#556a8a]">또는</span>
            <div className="flex-1 h-px bg-[#1a2744]" />
          </div>

          {/* Method 2: Manual Cookie */}
          <div className="max-w-lg mx-auto">
            <div className="p-4 bg-[#0a1628] rounded-lg border border-[#1a2744] space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#1a2744] flex items-center justify-center text-[#556a8a] text-xs font-bold">2</div>
                <h4 className="text-sm font-semibold text-[#8899b4]">수동 쿠키 입력</h4>
              </div>
              <p className="text-[10px] text-[#556a8a] ml-8">
                F12 &gt; Application &gt; Cookies &gt; .google.com &gt; SID, HSID, SSID, APISID, SAPISID 값 복사
              </p>
              <div className="ml-8 space-y-2">
                <textarea
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  placeholder="SID=xxx; HSID=yyy; SSID=zzz; APISID=aaa; SAPISID=bbb"
                  rows={2}
                  className="w-full bg-[#060e1a] border border-[#1a2744] rounded-lg px-3 py-2 text-[11px] text-white font-mono placeholder:text-[#556a8a] focus:outline-none focus:border-[#00e8b8]/50 transition-colors resize-none"
                />
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  onClick={handleSaveCookies}
                  disabled={!cookieInput.trim()}
                  className="px-4 py-2 bg-[#1a2744] border border-[#1a2744] text-[#8899b4] text-xs font-medium rounded-lg hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  수동 연결
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Main UI ---
  return (
    <div className="space-y-6">
      <PageHeader onSettingsClick={() => setShowSettings(true)} />

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          cookies={getSavedCookies()}
          onSave={(c) => {
            saveCookies(c)
            setShowSettings(false)
            setAuthenticated(null)
            nbFetch('/api/notebook/auth/status')
              .then((r) => r.json())
              .then((data) => setAuthenticated(data.authenticated === true))
              .catch(() => setAuthenticated(false))
          }}
          onClose={() => setShowSettings(false)}
          onDisconnect={() => {
            localStorage.removeItem(NB_COOKIES_KEY)
            setAuthenticated(false)
            setShowSettings(false)
          }}
        />
      )}

      {/* Create Notebook */}
      <div className="card p-4">
        <form onSubmit={(e) => { e.preventDefault(); handleCreate() }} className="flex gap-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="새 리서치 노트북 제목 (예: 삼성전자 투자 분석)"
            className="flex-1 bg-[#0a1628] border border-[#1a2744] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#556a8a] focus:outline-none focus:border-[#00e8b8]/50 transition-colors"
          />
          <button
            type="submit"
            disabled={creating || !newTitle.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-[#00e8b8] to-[#00b894] text-[#040810] text-sm font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(0,232,184,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? '생성 중...' : '노트북 생성'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Notebook List */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[#556a8a] uppercase tracking-wider px-1">노트북 목록</h3>
          {notebooks.length === 0 && <p className="text-sm text-[#556a8a] px-1">노트북이 없습니다</p>}
          {notebooks.map((nb) => (
            <button
              key={nb.id}
              onClick={() => loadDetail(nb.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedId === nb.id
                  ? 'bg-[#0a1628] border-[#00e8b8]/30 text-white'
                  : 'bg-[#060e1a] border-[#1a2744] text-[#8899b4] hover:text-white hover:border-[#1a2744]/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                <span className="text-sm font-medium truncate">{nb.title}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Notebook Detail */}
        <div className="min-h-[500px]">
          {loading && <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>}
          {error && <div className="card p-4 border-red-500/30 text-red-400 text-sm">{error}</div>}

          {!loading && !error && !detail && (
            <div className="card p-12 text-center h-full flex flex-col items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#556a8a" strokeWidth="1.5">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <p className="text-[#556a8a] text-sm mt-3">노트북을 선택하거나 새로 생성하세요</p>
            </div>
          )}

          {!loading && detail && (
            <div className="space-y-4">
              {/* Header */}
              <div className="card p-4">
                <h2 className="text-lg font-semibold text-white">{detail.title}</h2>
                <p className="text-xs text-[#556a8a] mt-1">소스 {detail.sources?.length || 0}개</p>
                {detail.sources && detail.sources.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {detail.sources.map((s) => (
                      <span key={s.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-[#0a1628] border border-[#1a2744] rounded-full text-[#8899b4]">
                        <SourceIcon type={s.type} />
                        <span className="truncate max-w-[200px]">{s.title}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Tab Bar */}
              <div className="flex gap-1 bg-[#060e1a] border border-[#1a2744] rounded-lg p-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as ActiveTab)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                      activeTab === tab.id ? 'bg-[#1a2744] text-[#00e8b8]' : 'text-[#556a8a] hover:text-white'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="card p-4">
                {activeTab === 'chat' && (
                  <ChatPanel messages={chatMessages} input={chatInput} loading={chatLoading}
                    onInputChange={setChatInput} onSend={handleChat} chatEndRef={chatEndRef} />
                )}
                {activeTab === 'audio' && (
                  <AudioPanel status={audioStatus} audioUrl={audioUrl}
                    generating={generatingAudio} onGenerate={handleGenerateAudio} />
                )}
                {activeTab === 'report' && (
                  <ReportPanel content={reportContent} generating={generatingReport} onGenerate={handleGenerateReport} />
                )}
                {activeTab === 'quiz' && (
                  <QuizPanel questions={quizQuestions} answers={quizAnswers} revealed={quizRevealed}
                    generating={generatingQuiz} onGenerate={handleGenerateQuiz}
                    onAnswer={(idx, val) => setQuizAnswers((prev) => ({ ...prev, [idx]: val }))}
                    onReveal={() => setQuizRevealed(true)} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Sub-components ---

function PageHeader({ onSettingsClick }: { onSettingsClick?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">NotebookLM 리서치</h1>
        <p className="text-sm text-[#556a8a] mt-1">AI 오디오 브리핑, 소스 기반 Q&A, 퀴즈, 보고서</p>
      </div>
      {onSettingsClick && (
        <button onClick={onSettingsClick}
          className="p-2 rounded-lg text-[#556a8a] hover:text-white hover:bg-[#1a2744] transition-colors"
          title="설정">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>
      )}
    </div>
  )
}

function SettingsModal({
  cookies,
  onSave,
  onClose,
  onDisconnect,
}: {
  cookies: string
  onSave: (c: string) => void
  onClose: () => void
  onDisconnect: () => void
}) {
  const [input, setInput] = useState(cookies)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card p-6 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white">NotebookLM 설정</h3>
        <div className="space-y-2">
          <label className="text-xs text-[#8899b4]">Google 쿠키</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="SID=xxx; HSID=yyy; SSID=zzz; APISID=aaa; SAPISID=bbb"
            rows={4}
            className="w-full bg-[#0a1628] border border-[#1a2744] rounded-lg px-4 py-3 text-xs text-white font-mono placeholder:text-[#556a8a] focus:outline-none focus:border-[#00e8b8]/50 transition-colors resize-none"
          />
          <p className="text-[10px] text-[#556a8a]">
            쿠키는 브라우저의 localStorage에만 저장됩니다. 서버에 저장되지 않습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onSave(input)}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-[#00e8b8] to-[#00b894] text-[#040810] text-sm font-semibold rounded-lg">
            저장
          </button>
          <button onClick={onDisconnect}
            className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg hover:bg-red-500/20 transition-colors">
            연결 해제
          </button>
          <button onClick={onClose}
            className="px-4 py-2 bg-[#1a2744] text-[#8899b4] text-sm rounded-lg hover:text-white transition-colors">
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

const TABS = [
  {
    id: 'chat', label: 'Q&A',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  },
  {
    id: 'audio', label: '오디오',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>,
  },
  {
    id: 'report', label: '보고서',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  },
  {
    id: 'quiz', label: '퀴즈',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  },
]

function ChatPanel({ messages, input, loading, onInputChange, onSend, chatEndRef }: {
  messages: NotebookChatMessage[]; input: string; loading: boolean
  onInputChange: (v: string) => void; onSend: () => void; chatEndRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="space-y-4">
      <div className="h-[400px] overflow-y-auto space-y-3 pr-2">
        {messages.length === 0 && <div className="flex items-center justify-center h-full"><p className="text-sm text-[#556a8a]">소스 기반으로 질문하세요</p></div>}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
              msg.role === 'user'
                ? 'bg-[#00e8b8]/10 text-[#00e8b8] border border-[#00e8b8]/20'
                : 'bg-[#0a1628] text-[#c8d6e5] border border-[#1a2744]'
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.references && msg.references.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#1a2744]">
                  <span className="text-[10px] text-[#556a8a]">출처:</span>
                  {msg.references.map((ref, j) => <p key={j} className="text-[10px] text-[#556a8a] mt-0.5 truncate">{ref.text}</p>)}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="p-3 rounded-lg bg-[#0a1628] border border-[#1a2744]"><Spinner /></div></div>}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onSend() }} className="flex gap-2">
        <input type="text" value={input} onChange={(e) => onInputChange(e.target.value)}
          placeholder="질문을 입력하세요 (예: 이 종목의 실적 전망은?)"
          className="flex-1 bg-[#0a1628] border border-[#1a2744] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#556a8a] focus:outline-none focus:border-[#00e8b8]/50 transition-colors" />
        <button type="submit" disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-[#1a2744] border border-[#00e8b8]/30 text-[#00e8b8] text-sm font-medium rounded-lg hover:bg-[#1a2744]/80 transition-colors disabled:opacity-40">전송</button>
      </form>
    </div>
  )
}

function AudioPanel({ status, audioUrl, generating, onGenerate }: {
  status: string | null; audioUrl: string | null; generating: boolean; onGenerate: () => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#8899b4]">소스를 기반으로 AI 오디오 브리핑(팟캐스트 스타일)을 생성합니다.</p>
      {!audioUrl && (
        <button onClick={onGenerate} disabled={generating}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#00e8b8] to-[#00b894] text-[#040810] text-sm font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(0,232,184,0.3)] transition-all disabled:opacity-40">
          {generating ? <><Spinner /> 생성 중... ({status || 'preparing'})</> : '오디오 브리핑 생성'}
        </button>
      )}
      {audioUrl && (
        <div className="p-4 bg-[#0a1628] rounded-lg border border-[#1a2744] space-y-3">
          <p className="text-sm text-[#00e8b8] font-medium">오디오 브리핑 준비 완료</p>
          <audio controls className="w-full" src={audioUrl}>Your browser does not support audio.</audio>
          <a href={audioUrl} download="briefing.mp3" className="inline-flex items-center gap-1.5 text-xs text-[#8899b4] hover:text-white transition-colors">다운로드</a>
        </div>
      )}
      {status === 'failed' && <p className="text-sm text-red-400">오디오 생성 실패. 다시 시도해주세요.</p>}
      {status === 'timeout' && <p className="text-sm text-yellow-400">생성 시간 초과. 잠시 후 다시 확인해주세요.</p>}
    </div>
  )
}

function ReportPanel({ content, generating, onGenerate }: {
  content: string | null; generating: boolean; onGenerate: (type: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => onGenerate('briefing')} disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a2744] border border-[#00e8b8]/30 text-[#00e8b8] text-sm font-medium rounded-lg hover:bg-[#1a2744]/80 transition-colors disabled:opacity-40">
          {generating ? <Spinner /> : null} 브리핑 문서
        </button>
        <button onClick={() => onGenerate('study_guide')} disabled={generating}
          className="px-4 py-2 bg-[#1a2744] border border-[#1a2744] text-[#8899b4] text-sm font-medium rounded-lg hover:text-white transition-colors disabled:opacity-40">
          스터디 가이드
        </button>
      </div>
      {content && (
        <div className="p-4 bg-[#0a1628] rounded-lg border border-[#1a2744]">
          <div className="text-sm text-[#c8d6e5] leading-relaxed whitespace-pre-wrap">{content}</div>
        </div>
      )}
      {!content && !generating && <p className="text-sm text-[#556a8a]">소스를 기반으로 브리핑 문서 또는 스터디 가이드를 생성합니다.</p>}
    </div>
  )
}

function QuizPanel({ questions, answers, revealed, generating, onGenerate, onAnswer, onReveal }: {
  questions: NotebookQuizQuestion[]; answers: Record<number, string>; revealed: boolean
  generating: boolean; onGenerate: () => void; onAnswer: (idx: number, val: string) => void; onReveal: () => void
}) {
  return (
    <div className="space-y-4">
      {questions.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-[#556a8a]">소스 내용을 기반으로 투자 지식 퀴즈를 생성합니다.</p>
          <button onClick={onGenerate} disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#00e8b8] to-[#00b894] text-[#040810] text-sm font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(0,232,184,0.3)] transition-all disabled:opacity-40">
            {generating ? <><Spinner /> 퀴즈 생성 중...</> : '퀴즈 생성'}
          </button>
        </div>
      )}
      {questions.map((q, i) => (
        <div key={i} className="p-4 bg-[#0a1628] rounded-lg border border-[#1a2744] space-y-3">
          <p className="text-sm font-medium text-white">Q{i + 1}. {q.question}</p>
          <div className="space-y-1.5">
            {q.options.map((opt, j) => {
              const isSelected = answers[i] === opt
              const isCorrect = revealed && opt === q.answer
              const isWrong = revealed && isSelected && opt !== q.answer
              return (
                <button key={j} onClick={() => !revealed && onAnswer(i, opt)} disabled={revealed}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors ${
                    isCorrect ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : isWrong ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : isSelected ? 'bg-[#1a2744] border-[#00e8b8]/30 text-white'
                    : 'bg-[#060e1a] border-[#1a2744] text-[#8899b4] hover:text-white'
                  }`}>{opt}</button>
              )
            })}
          </div>
          {revealed && q.explanation && <p className="text-xs text-[#556a8a] mt-2">{q.explanation}</p>}
        </div>
      ))}
      {questions.length > 0 && !revealed && (
        <button onClick={onReveal}
          className="px-4 py-2 bg-[#1a2744] border border-[#00e8b8]/30 text-[#00e8b8] text-sm font-medium rounded-lg hover:bg-[#1a2744]/80 transition-colors">
          정답 확인
        </button>
      )}
      {revealed && questions.length > 0 && (
        <div className="p-3 bg-[#0a1628] rounded-lg border border-[#1a2744]">
          <p className="text-sm text-white">
            결과: {Object.entries(answers).filter(([i, a]) => a === questions[Number(i)]?.answer).length} / {questions.length} 정답
          </p>
        </div>
      )}
    </div>
  )
}

function SourceIcon({ type }: { type: string }) {
  if (type === 'youtube' || type === 'url') return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
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
