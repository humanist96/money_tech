/**
 * NotebookLM TypeScript client - Direct Google RPC API calls.
 * Each user provides their own Google cookies (per-user auth).
 * No server-side env var needed - runs on Vercel serverless.
 */

// --- RPC Method IDs ---
const RPC = {
  LIST_NOTEBOOKS: 'wXbhsf',
  CREATE_NOTEBOOK: 'CCqFvf',
  GET_NOTEBOOK: 'rLM1Ne',
  DELETE_NOTEBOOK: 'WWINqb',
  ADD_SOURCE: 'izAoDd',
  DELETE_SOURCE: 'tGMBJ',
  LIST_ARTIFACTS: 'gArtLc',
  CREATE_ARTIFACT: 'R7cb6c',
  EXPORT_ARTIFACT: 'Krh3pd',
  GET_CONVERSATION_ID: 'hPTbtc',
  GET_CONVERSATION_TURNS: 'khqZz',
} as const

const BASE_URL = 'https://notebooklm.google.com'
const BATCH_URL = `${BASE_URL}/_/LabsTailwindUi/data/batchexecute`
const CHAT_URL = `${BASE_URL}/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed`

// --- Auth ---

interface AuthTokens {
  cookies: string
  csrfToken: string
  sessionId: string
}

export function parseCookieInput(input: string): string {
  // Accept either Playwright storage_state.json format or raw cookie string
  try {
    const state = JSON.parse(input)
    const cookies = state.cookies || []
    const googleCookies = cookies.filter(
      (c: { domain: string }) =>
        c.domain === '.google.com' || c.domain.endsWith('.google.com')
    )
    return googleCookies
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join('; ')
  } catch {
    return input // already a cookie string like "SID=xxx; HSID=yyy"
  }
}

export async function extractTokens(cookieString: string): Promise<AuthTokens> {
  const res = await fetch(BASE_URL, {
    headers: {
      'Cookie': cookieString,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    },
    redirect: 'follow',
  })

  const html = await res.text()

  const csrfMatch = html.match(/"SNlM0e"\s*:\s*"([^"]+)"/)
  const sessionMatch = html.match(/"FdrFJe"\s*:\s*"([^"]+)"/)

  if (!csrfMatch || !sessionMatch) {
    // Provide debug info about what we got
    const hasLoginForm = html.includes('accounts.google.com') || html.includes('ServiceLogin')
    const htmlLen = html.length
    const cookieNames = cookieString
      .split(';')
      .map((c) => c.trim().split('=')[0])
      .filter(Boolean)
      .join(', ')

    if (hasLoginForm) {
      throw new Error(
        `Google 로그인 페이지로 리다이렉트됨. 쿠키가 유효하지 않습니다. ` +
        `(쿠키 ${cookieNames.split(', ').length}개: ${cookieNames.slice(0, 100)})`
      )
    }
    throw new Error(
      `인증 토큰 추출 실패. 응답 길이: ${htmlLen}, 쿠키: ${cookieNames.slice(0, 100)}`
    )
  }

  return {
    cookies: cookieString,
    csrfToken: csrfMatch[1],
    sessionId: sessionMatch[1],
  }
}

// Per-user token cache (keyed by first 20 chars of cookie string)
const tokenCache = new Map<string, { auth: AuthTokens; ts: number }>()
const CACHE_TTL = 10 * 60 * 1000

async function getAuth(cookieString: string): Promise<AuthTokens> {
  const cacheKey = cookieString.slice(0, 40)
  const now = Date.now()
  const cached = tokenCache.get(cacheKey)
  if (cached && now - cached.ts < CACHE_TTL) {
    return cached.auth
  }

  const auth = await extractTokens(cookieString)
  tokenCache.set(cacheKey, { auth, ts: now })
  return auth
}

// --- batchexecute protocol ---

function buildBatchRequest(
  rpcId: string,
  params: unknown[],
  auth: AuthTokens,
  sourcePath: string = '/'
): { url: string; body: string; headers: Record<string, string> } {
  const paramsJson = JSON.stringify(params)
  const outerArray = [[[rpcId, paramsJson, null, 'generic']]]
  const fReq = JSON.stringify(outerArray)

  const urlParams = new URLSearchParams({
    'rpcids': rpcId,
    'source-path': sourcePath,
    'f.sid': auth.sessionId,
    'rt': 'c',
  })

  const bodyParams = new URLSearchParams({
    'f.req': fReq,
    'at': auth.csrfToken,
  })

  return {
    url: `${BATCH_URL}?${urlParams}`,
    body: bodyParams.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'Cookie': auth.cookies,
      'Origin': BASE_URL,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Referer': `${BASE_URL}/`,
    },
  }
}

function decodeBatchResponse(text: string, rpcId: string): unknown {
  const cleaned = text.replace(/^\)\]\}'/, '')
  const lines = cleaned.split('\n').filter((l) => l.trim())

  for (const line of lines) {
    if (!line.trim().startsWith('[')) continue
    try {
      const parsed = JSON.parse(line)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (
            Array.isArray(item) &&
            item[0] === 'wrb.fr' &&
            item[1] === rpcId
          ) {
            const resultStr = item[2]
            if (typeof resultStr === 'string') {
              return JSON.parse(resultStr)
            }
            return resultStr
          }
        }
      }
    } catch {
      continue
    }
  }

  throw new Error(`RPC ${rpcId}: 응답을 파싱할 수 없습니다`)
}

async function rpcCall(
  cookies: string,
  rpcId: string,
  params: unknown[],
  sourcePath?: string
): Promise<unknown> {
  const auth = await getAuth(cookies)
  const { url, body, headers } = buildBatchRequest(rpcId, params, auth, sourcePath)

  const res = await fetch(url, { method: 'POST', headers, body })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RPC 실패 (${res.status}): ${text.slice(0, 200)}`)
  }

  const text = await res.text()
  return decodeBatchResponse(text, rpcId)
}

// --- Public API (all functions take cookies as first param) ---

export async function checkAuth(cookies: string): Promise<{ authenticated: boolean; error?: string }> {
  try {
    await getAuth(cookies)
    return { authenticated: true }
  } catch (e) {
    return { authenticated: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function listNotebooks(cookies: string): Promise<Array<{ id: string; title: string }>> {
  const result = await rpcCall(cookies, RPC.LIST_NOTEBOOKS, [null, 1, null, [2]])
  const notebooks: Array<{ id: string; title: string }> = []

  if (Array.isArray(result)) {
    const list = result[0]
    if (Array.isArray(list)) {
      for (const item of list) {
        if (Array.isArray(item)) {
          const id = item[0]
          const title = item[2]?.[0]?.[3]?.[1] ?? item[2]?.[0]?.[0] ?? 'Untitled'
          if (id) notebooks.push({ id, title })
        }
      }
    }
  }

  return notebooks
}

export async function createNotebook(cookies: string, title: string): Promise<{ id: string; title: string }> {
  const result = await rpcCall(cookies, RPC.CREATE_NOTEBOOK, [title, null, null, [2], [1]])
  const id = Array.isArray(result) ? result[0] : null
  if (!id) throw new Error('노트북 생성 실패')
  return { id, title }
}

export async function getNotebook(
  cookies: string,
  notebookId: string
): Promise<{
  id: string
  title: string
  sources: Array<{ id: string; title: string; type: string; status: string }>
}> {
  const result = await rpcCall(
    cookies,
    RPC.GET_NOTEBOOK,
    [notebookId, null, [2], null, 0],
    `/notebook/${notebookId}`
  )

  let title = 'Untitled'
  const sources: Array<{ id: string; title: string; type: string; status: string }> = []

  if (Array.isArray(result)) {
    title = result[0]?.[3]?.[1] ?? result[0]?.[0] ?? 'Untitled'

    const sourceList = result[2]
    if (Array.isArray(sourceList)) {
      for (const s of sourceList) {
        if (Array.isArray(s)) {
          const sourceId = s[0]
          const sourceTitle = s[2]?.[0] ?? s[1] ?? 'Untitled'
          const sourceType = s[3] != null ? (['text', 'url', 'youtube', 'file'][s[3]] ?? 'unknown') : 'unknown'
          if (sourceId) {
            sources.push({ id: sourceId, title: sourceTitle, type: sourceType, status: 'ready' })
          }
        }
      }
    }
  }

  return { id: notebookId, title, sources }
}

export async function deleteNotebook(cookies: string, notebookId: string): Promise<{ deleted: boolean }> {
  await rpcCall(cookies, RPC.DELETE_NOTEBOOK, [[notebookId], [2]])
  return { deleted: true }
}

export async function addSourceUrl(
  cookies: string,
  notebookId: string,
  url: string
): Promise<{ id: string; title: string }> {
  const isYoutube = url.includes('youtube.com') || url.includes('youtu.be')

  const params = isYoutube
    ? [
        [[null, null, null, null, null, null, null, [url], null, null, 1]],
        notebookId, [2],
        [1, null, null, null, null, null, null, null, null, null, [1]],
      ]
    : [
        [[null, null, [url], null, null, null, null, null]],
        notebookId, [2], null, null,
      ]

  const result = await rpcCall(cookies, RPC.ADD_SOURCE, params, `/notebook/${notebookId}`)

  let sourceId = ''
  let sourceTitle = url
  if (Array.isArray(result)) {
    sourceId = result[0]?.[0] ?? result[0] ?? ''
    sourceTitle = result[0]?.[2]?.[0] ?? url
  }

  return { id: sourceId, title: sourceTitle }
}

export async function addSourceText(
  cookies: string,
  notebookId: string,
  title: string,
  content: string
): Promise<{ id: string; title: string }> {
  const params = [
    [[null, [title, content], null, null, null, null, null, null]],
    notebookId, [2], null, null,
  ]

  const result = await rpcCall(cookies, RPC.ADD_SOURCE, params, `/notebook/${notebookId}`)

  let sourceId = ''
  if (Array.isArray(result)) {
    sourceId = result[0]?.[0] ?? result[0] ?? ''
  }

  return { id: sourceId, title }
}

// --- Chat ---

let chatReqId = 100000

export async function chat(
  cookies: string,
  notebookId: string,
  question: string,
  conversationId?: string | null
): Promise<{ answer: string; conversationId: string; references: Array<{ text: string }> }> {
  const auth = await getAuth(cookies)
  const bl = process.env.NOTEBOOKLM_BL || 'boq_labs-tailwind-frontend_20260301.03_p0'

  let convId = conversationId
  if (!convId) {
    try {
      const result = await rpcCall(
        cookies, RPC.GET_CONVERSATION_ID,
        [[], null, notebookId, 1],
        `/notebook/${notebookId}`
      )
      if (Array.isArray(result) && result[0]) convId = result[0] as string
    } catch { /* new conversation */ }
    if (!convId) convId = crypto.randomUUID()
  }

  const innerParams = [[], question, null, [2, null, [1], [1]], convId, null, null, notebookId, 1]
  const outerParams = [null, JSON.stringify(innerParams)]
  const fReq = JSON.stringify([[['gEBPpe', JSON.stringify(outerParams), null, 'generic']]])

  chatReqId += 100000

  const urlParams = new URLSearchParams({
    bl, hl: 'en', '_reqid': String(chatReqId), rt: 'c', 'f.sid': auth.sessionId,
  })

  const bodyParams = new URLSearchParams({ 'f.req': fReq, at: auth.csrfToken })

  const res = await fetch(`${CHAT_URL}?${urlParams}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Cookie: auth.cookies,
      Origin: BASE_URL,
    },
    body: bodyParams.toString(),
  })

  const text = await res.text()
  const cleaned = text.replace(/^\)\]\}'/, '')

  let answer = ''
  const references: Array<{ text: string }> = []

  for (const line of cleaned.split('\n')) {
    if (!line.trim().startsWith('[')) continue
    try {
      const parsed = JSON.parse(line)
      if (!Array.isArray(parsed)) continue
      for (const chunk of parsed) {
        if (Array.isArray(chunk) && chunk[0] === 'wrb.fr') {
          const inner = typeof chunk[2] === 'string' ? JSON.parse(chunk[2]) : chunk[2]
          if (Array.isArray(inner) && inner[0]) {
            const data = Array.isArray(inner[0]) ? inner[0] : inner
            if (typeof data[0] === 'string') answer = data[0]
            const refs = data[4]
            if (Array.isArray(refs)) {
              for (const ref of refs) {
                if (Array.isArray(ref) && typeof ref[0] === 'string') {
                  references.push({ text: ref[0] })
                }
              }
            }
          }
        }
      }
    } catch { continue }
  }

  return { answer: answer || '응답을 받지 못했습니다', conversationId: convId, references }
}

// --- Artifacts ---

export async function generateAudio(
  cookies: string, notebookId: string, format: string = 'deep-dive'
): Promise<{ id: string; status: string }> {
  const formatMap: Record<string, number> = { 'deep-dive': 1, brief: 2, critique: 3, debate: 4 }
  const result = await rpcCall(
    cookies, RPC.CREATE_ARTIFACT,
    [notebookId, [2], [1, formatMap[format] ?? 1], null, null],
    `/notebook/${notebookId}`
  )
  return { id: Array.isArray(result) ? (result[0] ?? '') : '', status: 'generating' }
}

export async function getArtifactStatus(
  cookies: string, notebookId: string, artifactId: string
): Promise<{ id: string; status: string }> {
  const result = await rpcCall(
    cookies, RPC.LIST_ARTIFACTS, [notebookId, [2]], `/notebook/${notebookId}`
  )
  if (Array.isArray(result)) {
    const artifacts = result[0] ?? result
    if (Array.isArray(artifacts)) {
      for (const a of artifacts) {
        if (Array.isArray(a) && a[0] === artifactId) {
          const status = a[3] === 2 ? 'completed' : a[3] === 3 ? 'failed' : 'generating'
          return { id: artifactId, status }
        }
      }
    }
  }
  return { id: artifactId, status: 'unknown' }
}

export async function exportArtifact(
  cookies: string, notebookId: string, artifactId: string
): Promise<{ url?: string; content?: string }> {
  const result = await rpcCall(
    cookies, RPC.EXPORT_ARTIFACT, [notebookId, artifactId, [2]], `/notebook/${notebookId}`
  )
  if (Array.isArray(result)) {
    return {
      url: typeof result[0] === 'string' ? result[0] : undefined,
      content: typeof result[1] === 'string' ? result[1] : undefined,
    }
  }
  return {}
}

export async function generateReport(
  cookies: string, notebookId: string, reportType: string = 'briefing'
): Promise<{ id: string; content: string }> {
  const typeMap: Record<string, number> = { briefing: 2, study_guide: 3 }
  const result = await rpcCall(
    cookies, RPC.CREATE_ARTIFACT,
    [notebookId, [2], [typeMap[reportType] ?? 2], null, null],
    `/notebook/${notebookId}`
  )
  let id = '', content = ''
  if (Array.isArray(result)) {
    id = result[0] ?? ''
    content = result[1] ?? result[2] ?? ''
  }
  return { id, content: typeof content === 'string' ? content : JSON.stringify(content) }
}

export async function generateQuiz(
  cookies: string, notebookId: string
): Promise<{
  id: string
  questions: Array<{ question: string; options: string[]; answer: string; explanation: string }>
}> {
  const result = await rpcCall(
    cookies, RPC.CREATE_ARTIFACT,
    [notebookId, [2], [4], null, null],
    `/notebook/${notebookId}`
  )
  const questions: Array<{ question: string; options: string[]; answer: string; explanation: string }> = []
  let id = ''
  if (Array.isArray(result)) {
    id = result[0] ?? ''
    const quizData = result[1] ?? result[2]
    if (Array.isArray(quizData)) {
      for (const q of quizData) {
        if (Array.isArray(q)) {
          questions.push({
            question: q[0] ?? '', options: Array.isArray(q[1]) ? q[1] : [],
            answer: q[2] ?? '', explanation: q[3] ?? '',
          })
        }
      }
    }
  }
  return { id, questions }
}

// --- High-level: Research notebook ---

export async function createResearchNotebook(
  cookies: string, keyword: string, youtubeUrls: string[], analysisText: string
): Promise<{ id: string; title: string; sources: Array<{ id: string; title: string; type: string }> }> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
  const title = `${keyword} 투자 분석 - ${today}`

  const nb = await createNotebook(cookies, title)
  const sources: Array<{ id: string; title: string; type: string }> = []

  for (const url of youtubeUrls.slice(0, 5)) {
    try {
      const source = await addSourceUrl(cookies, nb.id, url)
      sources.push({ ...source, type: 'youtube' })
    } catch { /* skip */ }
  }

  if (analysisText.trim()) {
    try {
      const source = await addSourceText(cookies, nb.id, `${keyword} AI 분석 리포트`, analysisText)
      sources.push({ ...source, type: 'text' })
    } catch { /* skip */ }
  }

  return { id: nb.id, title, sources }
}
