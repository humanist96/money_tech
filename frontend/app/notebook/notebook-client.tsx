'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import type {
  NotebookItem,
  NotebookDetail,
  NotebookChatMessage,
} from '@/lib/types'

// --- Extension bridge ---

let requestId = 0
const pendingRequests = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

function extensionCall<T = unknown>(action: string, data?: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++requestId
    const timeout = setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error('확장 프로그램 응답 시간 초과'))
    }, 60000)

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

export default function NotebookClient() {
  const searchParams = useSearchParams()
  const initialId = searchParams.get('id')

  const [extensionReady, setExtensionReady] = useState(false)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [notebooks, setNotebooks] = useState<NotebookItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<NotebookDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Create notebook
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  // Add source
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [addingSource, setAddingSource] = useState(false)
  const [sourceTab, setSourceTab] = useState<'url' | 'text'>('url')

  // Chat
  const [chatMessages, setChatMessages] = useState<NotebookChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Feature states
  const [featureLoading, setFeatureLoading] = useState<string | null>(null)
  const [featureResult, setFeatureResult] = useState<string | null>(null)
  const [featureError, setFeatureError] = useState<string | null>(null)

  // Listen for extension ready signal
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return
      if (event.data?.type === 'MONEYTECH_NB_READY') setExtensionReady(true)
    }
    window.addEventListener('message', handleMessage)
    window.postMessage({ type: 'MONEYTECH_NB_PING' }, '*')
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Check auth
  useEffect(() => {
    if (!extensionReady) return
    extensionCall<{ authenticated: boolean }>('checkAuth')
      .then((r) => setAuthenticated(r.authenticated))
      .catch(() => setAuthenticated(false))
  }, [extensionReady])

  // Load notebooks
  const loadNotebooks = useCallback(async () => {
    try {
      const data = await extensionCall<{ notebooks: NotebookItem[]; _debug?: string }>('listNotebooks')
      if (data && typeof data === 'object' && 'notebooks' in data) {
        setNotebooks(Array.isArray(data.notebooks) ? data.notebooks : [])
      } else if (Array.isArray(data)) {
        setNotebooks(data as unknown as NotebookItem[])
      }
    } catch (e) {
      setError(`목록 로드 실패: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [])

  useEffect(() => {
    if (authenticated) loadNotebooks()
  }, [authenticated, loadNotebooks])

  // Load notebook detail
  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id)
    setLoading(true)
    setError('')
    setFeatureResult(null)
    setFeatureError(null)
    setChatMessages([])
    setConversationId(null)
    try {
      const data = await extensionCall<NotebookDetail>('getNotebook', { notebookId: id })
      setDetail(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notebook')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authenticated && initialId) loadDetail(initialId)
  }, [authenticated, initialId, loadDetail])

  // Create notebook
  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    setError('')
    try {
      const data = await extensionCall<{ id: string; title: string }>('createNotebook', { title: newTitle })
      setNewTitle('')
      await loadNotebooks()
      loadDetail(data.id)
    } catch (e) {
      setError(`노트북 생성 실패: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setCreating(false) }
  }, [newTitle, loadNotebooks, loadDetail])

  // Delete notebook
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('이 노트북을 삭제하시겠습니까?')) return
    try {
      await extensionCall('deleteNotebook', { notebookId: id })
      if (selectedId === id) { setSelectedId(null); setDetail(null) }
      await loadNotebooks()
    } catch (e) {
      setError(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [selectedId, loadNotebooks])

  // Add source
  const handleAddSource = useCallback(async () => {
    if (!selectedId) return
    setAddingSource(true)
    setError('')
    try {
      if (sourceTab === 'url' && sourceUrl.trim()) {
        await extensionCall('addSourceUrl', { notebookId: selectedId, url: sourceUrl.trim() })
        setSourceUrl('')
      } else if (sourceTab === 'text' && sourceText.trim()) {
        await extensionCall('addSourceText', {
          notebookId: selectedId,
          title: sourceTitle.trim() || '텍스트 소스',
          content: sourceText.trim(),
        })
        setSourceText('')
        setSourceTitle('')
      }
      await loadDetail(selectedId)
    } catch (e) {
      setError(`소스 추가 실패: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setAddingSource(false) }
  }, [selectedId, sourceTab, sourceUrl, sourceText, sourceTitle, loadDetail])

  // Chat
  const handleChat = useCallback(async () => {
    if (!chatInput.trim() || !selectedId) return
    const question = chatInput
    setChatInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: question }])
    setChatLoading(true)

    try {
      const data = await extensionCall<{ answer: string; conversationId: string; references: Array<{ text: string }> }>(
        'chat', { notebookId: selectedId, question, conversationId }
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
  }, [chatInput, selectedId, conversationId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Generic feature trigger (audio, report, quiz)
  const handleFeature = useCallback(async (action: string, label: string, extraData?: Record<string, unknown>) => {
    if (!selectedId) return
    setFeatureLoading(action)
    setFeatureResult(null)
    setFeatureError(null)

    try {
      const data = await extensionCall<Record<string, unknown>>(action, { notebookId: selectedId, ...extraData })
      const resultStr = JSON.stringify(data, null, 2)
      if (data.id) {
        setFeatureResult(`${label} 생성 요청 완료 (ID: ${String(data.id).slice(0, 12)}...)\n상태: ${data.status || 'processing'}\n\n전체 응답:\n${resultStr}`)
      } else {
        setFeatureResult(`${label} 응답:\n${resultStr}`)
      }
    } catch (e) {
      setFeatureError(`${label} 오류: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setFeatureLoading(null) }
  }, [selectedId])

  // --- Extension not installed ---
  if (!extensionReady) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="card p-8 space-y-6">
          <div className="text-center space-y-2">
            <IconBox icon="warning" color="#ff5757" />
            <h3 className="text-lg font-semibold text-white">Chrome 확장 프로그램 필요</h3>
            <p className="text-sm text-[#8899b4]">NotebookLM 기능을 사용하려면 MoneyTech 확장 프로그램을 설치해야 합니다.</p>
          </div>
          <div className="max-w-lg mx-auto p-5 bg-[#0a1628] rounded-lg border border-[#1a2744] space-y-4">
            <h4 className="text-sm font-semibold text-white">설치 방법</h4>
            <ol className="text-sm text-[#8899b4] space-y-3">
              {['chrome://extensions 접속', '우측 상단 개발자 모드 활성화', '"압축해제된 확장 프로그램을 로드합니다" 클릭', 'extension/ 폴더 선택', '이 페이지를 새로고침'].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded bg-[#00e8b8]/10 flex items-center justify-center text-[#00e8b8] text-xs font-bold">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <a href="https://github.com/humanist96/money_tech/tree/main/extension" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 btn-primary">
              확장 프로그램 다운로드
            </a>
          </div>
        </div>
      </div>
    )
  }

  // --- Auth checking ---
  if (authenticated === null) {
    return <div className="flex items-center justify-center min-h-[400px]"><Spinner size="lg" /></div>
  }

  // --- Not authenticated ---
  if (!authenticated) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="card p-8 space-y-6">
          <div className="text-center space-y-2">
            <IconBox icon="book" color="#00e8b8" />
            <h3 className="text-lg font-semibold text-white">Google 로그인 필요</h3>
            <p className="text-sm text-[#8899b4]">NotebookLM을 사용하려면 Chrome에서 Google에 로그인되어 있어야 합니다.</p>
          </div>
          <div className="max-w-lg mx-auto p-5 bg-[#0a1628] rounded-lg border border-[#1a2744] space-y-3">
            <ol className="text-sm text-[#8899b4] space-y-2">
              <li>1. <a href="https://notebooklm.google.com" target="_blank" rel="noopener noreferrer" className="text-[#00e8b8] underline">notebooklm.google.com</a>에 Google 계정으로 로그인</li>
              <li>2. 이 페이지를 새로고침</li>
            </ol>
            <button onClick={() => {
              setAuthenticated(null)
              extensionCall<{ authenticated: boolean }>('checkAuth')
                .then((r) => setAuthenticated(r.authenticated))
                .catch(() => setAuthenticated(false))
            }} className="px-5 py-2.5 bg-gradient-to-r from-[#00e8b8] to-[#00b894] text-[#040810] text-sm font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(0,232,184,0.3)] transition-all">다시 확인</button>
          </div>
        </div>
      </div>
    )
  }

  // --- Main UI ---
  return (
    <div className="space-y-6">
      <PageHeader />

      {/* Create Notebook */}
      <div className="card p-4">
        <form onSubmit={(e) => { e.preventDefault(); handleCreate() }} className="flex gap-3">
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="새 리서치 노트북 제목 (예: 삼성전자 투자 분석)"
            className="bg-[#0a1628] border border-[#1a2744] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#556a8a] focus:outline-none focus:border-[#00e8b8]/50 transition-colors flex-1" />
          <button type="submit" disabled={creating || !newTitle.trim()} className="px-5 py-2.5 bg-gradient-to-r from-[#00e8b8] to-[#00b894] text-[#040810] text-sm font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(0,232,184,0.3)] transition-all disabled:opacity-40">
            {creating ? '생성 중...' : '+ 노트북 생성'}
          </button>
        </form>
      </div>

      {error && <div className="card p-4 border-red-500/30 bg-red-500/5 text-red-400 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Notebook List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-[#556a8a] uppercase tracking-wider">노트북 목록 ({notebooks.length})</h3>
            <button onClick={loadNotebooks} className="text-[10px] text-[#556a8a] hover:text-[#00e8b8] transition-colors">새로고침</button>
          </div>
          {notebooks.length === 0 && <p className="text-sm text-[#556a8a] px-1 py-4">노트북이 없습니다. 위에서 새로 생성하세요.</p>}
          {notebooks.map((nb) => (
            <div key={nb.id} className={`group relative rounded-lg border transition-colors ${
              selectedId === nb.id
                ? 'bg-[#0a1628] border-[#00e8b8]/30'
                : 'bg-[#060e1a] border-[#1a2744] hover:border-[#1a2744]/80'
            }`}>
              <button onClick={() => loadDetail(nb.id)}
                className="w-full text-left p-3 pr-10">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={selectedId === nb.id ? '#00e8b8' : 'currentColor'} strokeWidth="2">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                  <span className={`text-sm font-medium truncate ${selectedId === nb.id ? 'text-white' : 'text-[#8899b4]'}`}>{nb.title}</span>
                </div>
              </button>
              {/* Actions */}
              <div className="absolute right-1 top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={`${NB_BASE}/notebook/${nb.id}`} target="_blank" rel="noopener noreferrer"
                  title="NotebookLM에서 열기"
                  className="p-1.5 rounded hover:bg-[#1a2744] text-[#556a8a] hover:text-[#00e8b8] transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
                <button onClick={() => handleDelete(nb.id)} title="삭제"
                  className="p-1.5 rounded hover:bg-red-500/10 text-[#556a8a] hover:text-red-400 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        <div className="min-h-[500px]">
          {loading && <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>}

          {!loading && !detail && (
            <div className="card p-12 text-center h-full flex flex-col items-center justify-center gap-3">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#556a8a" strokeWidth="1.5">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <p className="text-[#556a8a] text-sm">노트북을 선택하거나 새로 생성하세요</p>
            </div>
          )}

          {!loading && detail && (
            <div className="space-y-4">
              {/* Header with actions */}
              <div className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{detail.title}</h2>
                    <p className="text-xs text-[#556a8a] mt-1">소스 {detail.sources?.length || 0}개</p>
                  </div>
                  <a href={`${NB_BASE}/notebook/${selectedId}`} target="_blank" rel="noopener noreferrer"
                    className="px-5 py-2.5 bg-gradient-to-r from-[#00e8b8] to-[#00b894] text-[#040810] text-sm font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(0,232,184,0.3)] transition-all text-xs flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    NotebookLM에서 열기
                  </a>
                </div>

                {/* Sources list */}
                {detail.sources && detail.sources.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {detail.sources.map((s) => (
                      <span key={s.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-[#0a1628] border border-[#1a2744] rounded-full text-[#8899b4]">
                        <SourceIcon type={s.type} />
                        <span className="truncate max-w-[200px]">{s.title}</span>
                        {s.status === 'processing' && <span className="text-yellow-400">(처리중)</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Source */}
              <div className="card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-white">소스 추가</h3>
                <div className="flex gap-2">
                  <button onClick={() => setSourceTab('url')}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${sourceTab === 'url' ? 'bg-[#1a2744] text-[#00e8b8]' : 'text-[#556a8a] hover:text-white'}`}>
                    URL / YouTube
                  </button>
                  <button onClick={() => setSourceTab('text')}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${sourceTab === 'text' ? 'bg-[#1a2744] text-[#00e8b8]' : 'text-[#556a8a] hover:text-white'}`}>
                    텍스트
                  </button>
                </div>
                {sourceTab === 'url' ? (
                  <div className="flex gap-2">
                    <input type="text" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder="https://youtu.be/... 또는 웹 URL"
                      className="bg-[#0a1628] border border-[#1a2744] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#556a8a] focus:outline-none focus:border-[#00e8b8]/50 transition-colors flex-1" />
                    <button onClick={handleAddSource} disabled={addingSource || !sourceUrl.trim()}
                      className="px-4 py-2.5 bg-[#1a2744] border border-[#00e8b8]/30 text-[#00e8b8] text-sm font-medium rounded-lg hover:bg-[#1a2744]/80 transition-colors disabled:opacity-40">
                      {addingSource ? <Spinner /> : '추가'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input type="text" value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)}
                      placeholder="소스 제목" className="bg-[#0a1628] border border-[#1a2744] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#556a8a] focus:outline-none focus:border-[#00e8b8]/50 transition-colors w-full" />
                    <textarea value={sourceText} onChange={(e) => setSourceText(e.target.value)}
                      placeholder="분석 내용, 리포트, 메모 등..."
                      rows={4} className="bg-[#0a1628] border border-[#1a2744] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#556a8a] focus:outline-none focus:border-[#00e8b8]/50 transition-colors w-full resize-none" />
                    <button onClick={handleAddSource} disabled={addingSource || !sourceText.trim()}
                      className="px-4 py-2.5 bg-[#1a2744] border border-[#00e8b8]/30 text-[#00e8b8] text-sm font-medium rounded-lg hover:bg-[#1a2744]/80 transition-colors disabled:opacity-40">
                      {addingSource ? <Spinner /> : '텍스트 소스 추가'}
                    </button>
                  </div>
                )}
              </div>

              {/* Feature Buttons Grid */}
              <div className="card p-4 space-y-4">
                <h3 className="text-sm font-semibold text-white">NotebookLM 기능</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <FeatureButton
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>}
                    label="오디오 브리핑"
                    desc="AI 팟캐스트 생성"
                    loading={featureLoading === 'generateAudio'}
                    onClick={() => handleFeature('generateAudio', '오디오 브리핑', { format: 'deep-dive' })}
                  />
                  <FeatureButton
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
                    label="브리핑 문서"
                    desc="핵심 인사이트 정리"
                    loading={featureLoading === 'generateReport'}
                    onClick={() => handleFeature('generateReport', '브리핑 문서', { reportType: 'briefing' })}
                  />
                  <FeatureButton
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>}
                    label="스터디 가이드"
                    desc="학습 자료 생성"
                    loading={featureLoading === 'generateStudyGuide'}
                    onClick={() => handleFeature('generateReport', '스터디 가이드', { reportType: 'study_guide' })}
                  />
                  <FeatureButton
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
                    label="퀴즈"
                    desc="투자 지식 테스트"
                    loading={featureLoading === 'generateQuiz'}
                    onClick={() => handleFeature('generateQuiz', '퀴즈')}
                  />
                </div>

                {/* Feature result/error display */}
                {featureError && (
                  <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400">{featureError}</p>
                    <p className="text-xs text-[#556a8a] mt-2">
                      NotebookLM에서 직접 실행해보세요:{' '}
                      <a href={`${NB_BASE}/notebook/${selectedId}`} target="_blank" rel="noopener noreferrer" className="text-[#00e8b8] underline">
                        노트북 열기
                      </a>
                    </p>
                  </div>
                )}
                {featureResult && (
                  <div className="p-3 bg-[#0a1628] border border-[#1a2744] rounded-lg">
                    <pre className="text-xs text-[#c8d6e5] whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">{featureResult}</pre>
                  </div>
                )}

                {/* NotebookLM direct link hint */}
                <div className="flex items-center gap-2 p-3 bg-[#060e1a] rounded-lg border border-[#1a2744]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e8b8" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  <p className="text-xs text-[#8899b4]">
                    오디오/보고서/퀴즈는{' '}
                    <a href={`${NB_BASE}/notebook/${selectedId}`} target="_blank" rel="noopener noreferrer" className="text-[#00e8b8] underline">
                      NotebookLM에서 직접 실행
                    </a>
                    하면 더 안정적입니다.
                  </p>
                </div>
              </div>

              {/* Q&A Chat */}
              <div className="card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Q&A 소스 기반 질의응답</h3>
                  <a href={`${NB_BASE}/notebook/${selectedId}`} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-[#556a8a] hover:text-[#00e8b8] transition-colors">NotebookLM에서 Q&A</a>
                </div>

                <div className="h-[350px] overflow-y-auto space-y-3 pr-2 bg-[#060e1a] rounded-lg p-3">
                  {chatMessages.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center space-y-2">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#556a8a" strokeWidth="1.5" className="mx-auto">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <p className="text-sm text-[#556a8a]">소스 기반으로 질문하세요</p>
                        <p className="text-[10px] text-[#334]">예: &quot;이 영상의 핵심 내용은?&quot;, &quot;투자 전략을 요약해줘&quot;</p>
                      </div>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
                        msg.role === 'user'
                          ? 'bg-[#00e8b8]/10 text-[#00e8b8] border border-[#00e8b8]/20'
                          : 'bg-[#0a1628] text-[#c8d6e5] border border-[#1a2744]'
                      }`}>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="p-3 rounded-lg bg-[#0a1628] border border-[#1a2744] flex items-center gap-2">
                        <Spinner /> <span className="text-xs text-[#556a8a]">응답 생성 중...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleChat() }} className="flex gap-2">
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    placeholder="질문을 입력하세요..."
                    className="bg-[#0a1628] border border-[#1a2744] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#556a8a] focus:outline-none focus:border-[#00e8b8]/50 transition-colors flex-1" />
                  <button type="submit" disabled={chatLoading || !chatInput.trim()} className="px-4 py-2.5 bg-[#1a2744] border border-[#00e8b8]/30 text-[#00e8b8] text-sm font-medium rounded-lg hover:bg-[#1a2744]/80 transition-colors disabled:opacity-40">
                    {chatLoading ? <Spinner /> : '전송'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Sub-components ---

function PageHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">NotebookLM 리서치</h1>
        <p className="text-sm text-[#556a8a] mt-1">노트북 관리, 소스 추가, AI 분석</p>
      </div>
      <a href={NB_BASE} target="_blank" rel="noopener noreferrer"
        className="text-xs text-[#556a8a] hover:text-[#00e8b8] transition-colors flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        NotebookLM 홈
      </a>
    </div>
  )
}

function FeatureButton({ icon, label, desc, loading, onClick }: {
  icon: React.ReactNode; label: string; desc: string; loading: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className="flex flex-col items-center gap-2 p-4 rounded-lg border border-[#1a2744] bg-[#060e1a] hover:bg-[#0a1628] hover:border-[#00e8b8]/30 transition-all text-center disabled:opacity-50 group">
      <div className="text-[#556a8a] group-hover:text-[#00e8b8] transition-colors">
        {loading ? <Spinner /> : icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="text-[10px] text-[#556a8a] mt-0.5">{desc}</p>
      </div>
    </button>
  )
}

function IconBox({ icon, color }: { icon: 'warning' | 'book'; color: string }) {
  return (
    <div className="w-16 h-16 mx-auto rounded-2xl bg-[#0a1628] flex items-center justify-center">
      {icon === 'warning' ? (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ) : (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      )}
    </div>
  )
}

function SourceIcon({ type }: { type: string }) {
  if (type === 'youtube') return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="#ff4444"/>
    </svg>
  )
  if (type === 'url') return (
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
