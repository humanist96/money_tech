'use client'

import { useState, useEffect, useCallback } from 'react'

// --- Extension bridge (same as notebook-client) ---
let requestId = 0
const pendingRequests = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

function extensionCall<T = unknown>(action: string, data?: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++requestId
    const timeout = setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error('타임아웃 (60초)'))
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

interface TestResult {
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  duration?: number
  result?: string
  error?: string
}

const TEST_NOTEBOOK_TITLE = `MoneyTech 테스트 - ${new Date().toISOString().slice(0, 16)}`

export default function TestClient() {
  const [extensionReady, setExtensionReady] = useState(false)
  const [tests, setTests] = useState<TestResult[]>([])
  const [running, setRunning] = useState(false)
  const [createdNotebookId, setCreatedNotebookId] = useState<string | null>(null)

  // Extension ready detection
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window && event.data?.type === 'MONEYTECH_NB_READY') return
      if (event.data?.type === 'MONEYTECH_NB_READY') setExtensionReady(true)
    }
    window.addEventListener('message', handleMessage)
    window.postMessage({ type: 'MONEYTECH_NB_PING' }, '*')
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const updateTest = useCallback((name: string, update: Partial<TestResult>) => {
    setTests(prev => prev.map(t => t.name === name ? { ...t, ...update } : t))
  }, [])

  const runTest = useCallback(async (
    name: string,
    fn: () => Promise<{ result: string; data?: unknown }>
  ) => {
    updateTest(name, { status: 'running' })
    const start = Date.now()
    try {
      const { result, data } = await fn()
      updateTest(name, {
        status: 'success',
        duration: Date.now() - start,
        result: result + (data ? `\n\nRAW: ${JSON.stringify(data, null, 2).slice(0, 1000)}` : ''),
      })
      return data
    } catch (e) {
      updateTest(name, {
        status: 'error',
        duration: Date.now() - start,
        error: e instanceof Error ? e.message : String(e),
      })
      return null
    }
  }, [updateTest])

  const runAllTests = useCallback(async () => {
    setRunning(true)
    setCreatedNotebookId(null)

    const testList: TestResult[] = [
      { name: '1. 인증 확인 (checkAuth)', status: 'pending' },
      { name: '2. 노트북 목록 (listNotebooks)', status: 'pending' },
      { name: '3. 노트북 생성 (createNotebook)', status: 'pending' },
      { name: '4. 노트북 상세 (getNotebook)', status: 'pending' },
      { name: '5. YouTube URL 소스 추가 (addSourceUrl)', status: 'pending' },
      { name: '6. 텍스트 소스 추가 (addSourceText)', status: 'pending' },
      { name: '7. 소스 추가 확인 (getNotebook)', status: 'pending' },
      { name: '8. Q&A 채팅 (chat)', status: 'pending' },
      { name: '9. 오디오 생성 (generateAudio)', status: 'pending' },
      { name: '10. 보고서 생성 (generateReport)', status: 'pending' },
      { name: '11. 퀴즈 생성 (generateQuiz)', status: 'pending' },
      { name: '12. 노트북 삭제 (deleteNotebook)', status: 'pending' },
    ]
    setTests(testList)

    // Test 1: checkAuth
    const authResult = await runTest('1. 인증 확인 (checkAuth)', async () => {
      const data = await extensionCall<{ authenticated: boolean }>('checkAuth')
      return {
        result: data.authenticated ? '인증됨' : '미인증',
        data,
      }
    })
    if (!authResult || !(authResult as { authenticated: boolean }).authenticated) {
      setTests(prev => prev.map(t =>
        t.status === 'pending' ? { ...t, status: 'error', error: '인증 필요 - 나머지 테스트 건너뜀' } : t
      ))
      setRunning(false)
      return
    }

    // Test 2: listNotebooks
    const listResult = await runTest('2. 노트북 목록 (listNotebooks)', async () => {
      const data = await extensionCall<{ notebooks: Array<{ id: string; title: string }> }>('listNotebooks')
      const count = data.notebooks?.length ?? 0
      return {
        result: `${count}개 노트북 발견`,
        data: { count, first3: data.notebooks?.slice(0, 3) },
      }
    })

    // Test 3: createNotebook
    let notebookId: string | null = null
    const createResult = await runTest('3. 노트북 생성 (createNotebook)', async () => {
      const data = await extensionCall<{ id: string; title: string }>('createNotebook', {
        title: TEST_NOTEBOOK_TITLE,
      })
      notebookId = data.id
      setCreatedNotebookId(data.id)
      return {
        result: `생성 완료 - ID: ${data.id?.slice(0, 20)}...`,
        data,
      }
    })

    if (!notebookId) {
      setTests(prev => prev.map(t =>
        t.status === 'pending' ? { ...t, status: 'error', error: '노트북 생성 실패 - 나머지 테스트 건너뜀' } : t
      ))
      setRunning(false)
      return
    }

    // Test 4: getNotebook
    await runTest('4. 노트북 상세 (getNotebook)', async () => {
      const data = await extensionCall<{ id: string; title: string; sources: unknown[] }>('getNotebook', {
        notebookId,
      })
      return {
        result: `제목: "${data.title}", 소스: ${data.sources?.length ?? 0}개`,
        data,
      }
    })

    // Test 5: addSourceUrl (YouTube)
    await runTest('5. YouTube URL 소스 추가 (addSourceUrl)', async () => {
      const data = await extensionCall<{ id: string; title: string }>('addSourceUrl', {
        notebookId,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      })
      return {
        result: `소스 추가됨 - ID: ${String(data.id).slice(0, 20)}`,
        data,
      }
    })

    // Test 6: addSourceText
    await runTest('6. 텍스트 소스 추가 (addSourceText)', async () => {
      const data = await extensionCall<{ id: string; title: string }>('addSourceText', {
        notebookId,
        title: 'MoneyTech 테스트 분석 데이터',
        content: `# 삼성전자 분석 데이터 (테스트)
## 감성 분석
- 긍정: 62%
- 부정: 18%
- 중립: 20%

## 채널별 예측
- 슈카월드: 매수 (적중률 72%)
- 삼프로TV: 보유 (적중률 65%)

## 최근 시세
- 현재가: 82,400원
- 52주 고: 89,000원
- 52주 저: 65,200원`,
      })
      return {
        result: `텍스트 소스 추가됨 - ID: ${String(data.id).slice(0, 20)}`,
        data,
      }
    })

    // Test 7: getNotebook (소스 확인)
    await runTest('7. 소스 추가 확인 (getNotebook)', async () => {
      // 잠시 대기 (소스 인덱싱)
      await new Promise(r => setTimeout(r, 3000))
      const data = await extensionCall<{ id: string; title: string; sources: Array<{ id: string; title: string; type: string; status: string }> }>('getNotebook', {
        notebookId,
      })
      const sourceInfo = data.sources?.map(s => `[${s.type}] ${s.title} (${s.status})`).join('\n') || '소스 없음'
      return {
        result: `소스 ${data.sources?.length ?? 0}개:\n${sourceInfo}`,
        data,
      }
    })

    // Test 8: chat
    await runTest('8. Q&A 채팅 (chat)', async () => {
      const data = await extensionCall<{ answer: string; conversationId: string }>('chat', {
        notebookId,
        question: '이 노트북의 소스를 요약해줘',
      })
      return {
        result: data.answer ? `응답 (${data.answer.length}자): ${data.answer.slice(0, 200)}` : '빈 응답',
        data: { answer_length: data.answer?.length, conversationId: data.conversationId },
      }
    })

    // Test 9: generateAudio
    await runTest('9. 오디오 생성 (generateAudio)', async () => {
      const data = await extensionCall<{ id: string; status: string }>('generateAudio', {
        notebookId,
        format: 'deep-dive',
      })
      return {
        result: `ID: ${String(data.id).slice(0, 20)}, 상태: ${data.status}`,
        data,
      }
    })

    // Test 10: generateReport
    await runTest('10. 보고서 생성 (generateReport)', async () => {
      const data = await extensionCall<{ id: string; status: string; content: string }>('generateReport', {
        notebookId,
        reportType: 'briefing',
      })
      return {
        result: `ID: ${String(data.id).slice(0, 20)}, 상태: ${data.status}${data.content ? `, 내용: ${data.content.slice(0, 100)}` : ''}`,
        data,
      }
    })

    // Test 11: generateQuiz
    await runTest('11. 퀴즈 생성 (generateQuiz)', async () => {
      const data = await extensionCall<{ id: string; status: string }>('generateQuiz', {
        notebookId,
      })
      return {
        result: `ID: ${String(data.id).slice(0, 20)}, 상태: ${data.status}`,
        data,
      }
    })

    // Test 12: deleteNotebook (cleanup)
    await runTest('12. 노트북 삭제 (deleteNotebook)', async () => {
      const data = await extensionCall<{ deleted: boolean }>('deleteNotebook', {
        notebookId,
      })
      setCreatedNotebookId(null)
      return {
        result: data.deleted ? '삭제 완료' : '삭제 실패',
        data,
      }
    })

    setRunning(false)
  }, [runTest, updateTest])

  // --- Extension not ready ---
  if (!extensionReady) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-th-primary">NotebookLM API 테스트</h1>
        <div className="card p-8 text-center space-y-3">
          <p className="text-red-400 text-sm">Chrome 확장 프로그램이 감지되지 않습니다.</p>
          <p className="text-th-dim text-xs">chrome://extensions에서 MoneyTech 확장 프로그램을 리로드하고 이 페이지를 새로고침하세요.</p>
        </div>
      </div>
    )
  }

  const successCount = tests.filter(t => t.status === 'success').length
  const errorCount = tests.filter(t => t.status === 'error').length
  const totalDone = successCount + errorCount

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-th-primary">NotebookLM API 테스트</h1>
          <p className="text-sm text-th-dim mt-1">확장 프로그램의 각 기능을 순차적으로 테스트합니다</p>
        </div>
        <button
          onClick={runAllTests}
          disabled={running}
          className="btn-accent px-5 py-2.5 text-sm disabled:opacity-40"
        >
          {running ? '테스트 실행 중...' : '전체 테스트 실행'}
        </button>
      </div>

      {/* Summary */}
      {tests.length > 0 && (
        <div className="flex gap-4">
          <div className="card px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-sm text-emerald-400">{successCount} 성공</span>
          </div>
          <div className="card px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-sm text-red-400">{errorCount} 실패</span>
          </div>
          <div className="card px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-th-dim" />
            <span className="text-sm text-th-dim">{tests.length - totalDone} 대기</span>
          </div>
        </div>
      )}

      {/* Test Results */}
      <div className="space-y-3">
        {tests.map((test) => (
          <div key={test.name} className={`card p-4 border-l-4 ${
            test.status === 'success' ? 'border-l-emerald-500' :
            test.status === 'error' ? 'border-l-red-500' :
            test.status === 'running' ? 'border-l-yellow-500' :
            'border-l-th-border'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusIcon status={test.status} />
                <span className="text-sm font-medium text-th-primary">{test.name}</span>
              </div>
              {test.duration !== undefined && (
                <span className="text-[10px] text-th-dim">{test.duration}ms</span>
              )}
            </div>

            {test.result && (
              <pre className="mt-2 p-2 bg-th-card-deep rounded text-xs text-emerald-400 whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                {test.result}
              </pre>
            )}

            {test.error && (
              <pre className="mt-2 p-2 bg-red-500/5 border border-red-500/20 rounded text-xs text-red-400 whitespace-pre-wrap break-all">
                {test.error}
              </pre>
            )}
          </div>
        ))}
      </div>

      {/* Created notebook link */}
      {createdNotebookId && (
        <div className="card p-4 border-yellow-500/30 bg-yellow-500/5">
          <p className="text-xs text-yellow-400">
            테스트 노트북이 아직 존재합니다:{' '}
            <a href={`https://notebooklm.google.com/notebook/${createdNotebookId}`}
              target="_blank" rel="noopener noreferrer" className="underline">
              NotebookLM에서 확인
            </a>
          </p>
        </div>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: TestResult['status'] }) {
  if (status === 'running') return (
    <svg className="animate-spin h-4 w-4 text-yellow-400" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
  if (status === 'success') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
  if (status === 'error') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
  return <div className="w-4 h-4 rounded-full border-2 border-[#1a2744]" />
}
