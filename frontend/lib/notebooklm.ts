/**
 * NotebookLM TypeScript client - Direct Google RPC API calls.
 * Replaces Python notebooklm-py, runs on Vercel serverless.
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

function parseCookiesFromStorageState(storageState: string): string {
  try {
    const state = JSON.parse(storageState)
    const cookies = state.cookies || []
    const googleCookies = cookies.filter(
      (c: { domain: string }) =>
        c.domain === '.google.com' || c.domain.endsWith('.google.com')
    )
    return googleCookies
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join('; ')
  } catch {
    return storageState // assume it's already a cookie string
  }
}

async function extractTokens(cookies: string): Promise<AuthTokens> {
  const res = await fetch(BASE_URL, {
    headers: { Cookie: cookies },
    redirect: 'follow',
  })

  const html = await res.text()

  const csrfMatch = html.match(/"SNlM0e"\s*:\s*"([^"]+)"/)
  const sessionMatch = html.match(/"FdrFJe"\s*:\s*"([^"]+)"/)

  if (!csrfMatch || !sessionMatch) {
    throw new Error('Failed to extract auth tokens from NotebookLM. Cookie may be expired.')
  }

  return {
    cookies,
    csrfToken: csrfMatch[1],
    sessionId: sessionMatch[1],
  }
}

let cachedAuth: AuthTokens | null = null
let cacheTimestamp = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

async function getAuth(): Promise<AuthTokens> {
  const now = Date.now()
  if (cachedAuth && now - cacheTimestamp < CACHE_TTL) {
    return cachedAuth
  }

  const authJson = process.env.NOTEBOOKLM_AUTH_JSON
  if (!authJson) {
    throw new Error('NOTEBOOKLM_AUTH_JSON environment variable not set')
  }

  const cookies = parseCookiesFromStorageState(authJson)
  cachedAuth = await extractTokens(cookies)
  cacheTimestamp = now
  return cachedAuth
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
    },
  }
}

function decodeBatchResponse(text: string, rpcId: string): unknown {
  // Strip anti-XSSI prefix
  const cleaned = text.replace(/^\)\]\}'/, '')

  // Parse chunked format: alternating lines of byte_count and json_payload
  const lines = cleaned.split('\n').filter((l) => l.trim())
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('[')) continue

    try {
      const parsed = JSON.parse(line)
      // Look for ["wrb.fr", "<rpcId>", <result>, ...]
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

  throw new Error(`No result found for RPC ${rpcId}`)
}

async function rpcCall(
  rpcId: string,
  params: unknown[],
  sourcePath?: string
): Promise<unknown> {
  const auth = await getAuth()
  const { url, body, headers } = buildBatchRequest(rpcId, params, auth, sourcePath)

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RPC ${rpcId} failed: ${res.status} ${text.slice(0, 200)}`)
  }

  const text = await res.text()
  return decodeBatchResponse(text, rpcId)
}

// --- Public API ---

export async function checkAuth(): Promise<{ authenticated: boolean; error?: string }> {
  try {
    await getAuth()
    return { authenticated: true }
  } catch (e) {
    return { authenticated: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function listNotebooks(): Promise<
  Array<{ id: string; title: string }>
> {
  const result = await rpcCall(RPC.LIST_NOTEBOOKS, [null, 1, null, [2]])
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

export async function createNotebook(title: string): Promise<{ id: string; title: string }> {
  const result = await rpcCall(RPC.CREATE_NOTEBOOK, [title, null, null, [2], [1]])
  const id = Array.isArray(result) ? result[0] : null
  if (!id) throw new Error('Failed to create notebook')
  return { id, title }
}

export async function getNotebook(
  notebookId: string
): Promise<{
  id: string
  title: string
  sources: Array<{ id: string; title: string; type: string; status: string }>
}> {
  const result = await rpcCall(
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
            sources.push({
              id: sourceId,
              title: sourceTitle,
              type: sourceType,
              status: 'ready',
            })
          }
        }
      }
    }
  }

  return { id: notebookId, title, sources }
}

export async function deleteNotebook(notebookId: string): Promise<{ deleted: boolean }> {
  await rpcCall(RPC.DELETE_NOTEBOOK, [[notebookId], [2]])
  return { deleted: true }
}

export async function addSourceUrl(
  notebookId: string,
  url: string
): Promise<{ id: string; title: string }> {
  const isYoutube = url.includes('youtube.com') || url.includes('youtu.be')

  const params = isYoutube
    ? [
        [[null, null, null, null, null, null, null, [url], null, null, 1]],
        notebookId,
        [2],
        [1, null, null, null, null, null, null, null, null, null, [1]],
      ]
    : [
        [[null, null, [url], null, null, null, null, null]],
        notebookId,
        [2],
        null,
        null,
      ]

  const result = await rpcCall(RPC.ADD_SOURCE, params, `/notebook/${notebookId}`)

  let sourceId = ''
  let sourceTitle = url
  if (Array.isArray(result)) {
    sourceId = result[0]?.[0] ?? result[0] ?? ''
    sourceTitle = result[0]?.[2]?.[0] ?? url
  }

  return { id: sourceId, title: sourceTitle }
}

export async function addSourceText(
  notebookId: string,
  title: string,
  content: string
): Promise<{ id: string; title: string }> {
  const params = [
    [[null, [title, content], null, null, null, null, null, null]],
    notebookId,
    [2],
    null,
    null,
  ]

  const result = await rpcCall(RPC.ADD_SOURCE, params, `/notebook/${notebookId}`)

  let sourceId = ''
  if (Array.isArray(result)) {
    sourceId = result[0]?.[0] ?? result[0] ?? ''
  }

  return { id: sourceId, title }
}

// --- Chat ---

let chatReqId = 100000

export async function chat(
  notebookId: string,
  question: string,
  conversationId?: string | null
): Promise<{ answer: string; conversationId: string; references: Array<{ text: string }> }> {
  const auth = await getAuth()
  const bl = process.env.NOTEBOOKLM_BL || 'boq_labs-tailwind-frontend_20260301.03_p0'

  // Get or create conversation ID
  let convId = conversationId
  if (!convId) {
    try {
      const result = await rpcCall(
        RPC.GET_CONVERSATION_ID,
        [[], null, notebookId, 1],
        `/notebook/${notebookId}`
      )
      if (Array.isArray(result) && result[0]) {
        convId = result[0]
      }
    } catch {
      // Will create new conversation
    }
    if (!convId) {
      convId = crypto.randomUUID()
    }
  }

  const innerParams = [
    [],          // sources (empty = all)
    question,
    null,        // conversation history
    [2, null, [1], [1]],
    convId,
    null,
    null,
    notebookId,
    1,
  ]

  const outerParams = [null, JSON.stringify(innerParams)]
  const fReq = JSON.stringify([[[RPC.GET_CONVERSATION_ID.length > 0 ? 'gEBPpe' : 'gEBPpe', JSON.stringify(outerParams), null, 'generic']]])

  // For chat, we use a simpler approach via the batchexecute endpoint
  // since the streaming endpoint is complex
  chatReqId += 100000

  const urlParams = new URLSearchParams({
    'bl': bl,
    'hl': 'en',
    '_reqid': String(chatReqId),
    'rt': 'c',
    'f.sid': auth.sessionId,
  })

  const bodyParams = new URLSearchParams({
    'f.req': fReq,
    'at': auth.csrfToken,
  })

  const res = await fetch(`${CHAT_URL}?${urlParams}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'Cookie': auth.cookies,
      'Origin': BASE_URL,
    },
    body: bodyParams.toString(),
  })

  const text = await res.text()
  const cleaned = text.replace(/^\)\]\}'/, '')

  // Parse streaming response for answer
  let answer = ''
  const references: Array<{ text: string }> = []

  const lines = cleaned.split('\n').filter((l) => l.trim())
  for (const line of lines) {
    if (!line.startsWith('[')) continue
    try {
      const parsed = JSON.parse(line)
      if (Array.isArray(parsed)) {
        for (const chunk of parsed) {
          if (Array.isArray(chunk) && chunk[0] === 'wrb.fr') {
            const inner = typeof chunk[2] === 'string' ? JSON.parse(chunk[2]) : chunk[2]
            if (Array.isArray(inner) && inner[0]) {
              const data = Array.isArray(inner[0]) ? inner[0] : inner
              if (typeof data[0] === 'string') {
                answer = data[0]
              }
              // Extract references if available
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
      }
    } catch {
      continue
    }
  }

  return { answer: answer || 'No response received', conversationId: convId, references }
}

// --- Artifacts (Audio, Reports, Quiz) ---

export async function generateAudio(
  notebookId: string,
  format: string = 'deep-dive'
): Promise<{ id: string; status: string }> {
  // Audio artifact type mapping
  const formatMap: Record<string, number> = {
    'deep-dive': 1,
    'brief': 2,
    'critique': 3,
    'debate': 4,
  }
  const formatType = formatMap[format] ?? 1

  const result = await rpcCall(
    RPC.CREATE_ARTIFACT,
    [notebookId, [2], [1, formatType], null, null],
    `/notebook/${notebookId}`
  )

  let artifactId = ''
  if (Array.isArray(result)) {
    artifactId = result[0] ?? ''
  }

  return { id: artifactId, status: 'generating' }
}

export async function getArtifactStatus(
  notebookId: string,
  artifactId: string
): Promise<{ id: string; status: string; downloadUrl?: string }> {
  const result = await rpcCall(
    RPC.LIST_ARTIFACTS,
    [notebookId, [2]],
    `/notebook/${notebookId}`
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
  notebookId: string,
  artifactId: string
): Promise<{ url?: string; content?: string }> {
  const result = await rpcCall(
    RPC.EXPORT_ARTIFACT,
    [notebookId, artifactId, [2]],
    `/notebook/${notebookId}`
  )

  if (Array.isArray(result)) {
    // Export result may contain a URL or content
    const url = result[0]
    const content = result[1]
    return {
      url: typeof url === 'string' ? url : undefined,
      content: typeof content === 'string' ? content : undefined,
    }
  }

  return {}
}

export async function generateReport(
  notebookId: string,
  reportType: string = 'briefing'
): Promise<{ id: string; content: string }> {
  const typeMap: Record<string, number> = {
    'briefing': 2,
    'study_guide': 3,
  }
  const type = typeMap[reportType] ?? 2

  const result = await rpcCall(
    RPC.CREATE_ARTIFACT,
    [notebookId, [2], [type], null, null],
    `/notebook/${notebookId}`
  )

  let id = ''
  let content = ''
  if (Array.isArray(result)) {
    id = result[0] ?? ''
    content = result[1] ?? result[2] ?? ''
  }

  return { id, content: typeof content === 'string' ? content : JSON.stringify(content) }
}

export async function generateQuiz(
  notebookId: string
): Promise<{
  id: string
  questions: Array<{
    question: string
    options: string[]
    answer: string
    explanation: string
  }>
}> {
  const result = await rpcCall(
    RPC.CREATE_ARTIFACT,
    [notebookId, [2], [4], null, null], // 4 = quiz type
    `/notebook/${notebookId}`
  )

  const questions: Array<{
    question: string
    options: string[]
    answer: string
    explanation: string
  }> = []

  let id = ''
  if (Array.isArray(result)) {
    id = result[0] ?? ''
    const quizData = result[1] ?? result[2]
    if (Array.isArray(quizData)) {
      for (const q of quizData) {
        if (Array.isArray(q)) {
          questions.push({
            question: q[0] ?? '',
            options: Array.isArray(q[1]) ? q[1] : [],
            answer: q[2] ?? '',
            explanation: q[3] ?? '',
          })
        }
      }
    }
  }

  return { id, questions }
}

// --- High-level: Research notebook ---

export async function createResearchNotebook(
  keyword: string,
  youtubeUrls: string[],
  analysisText: string
): Promise<{
  id: string
  title: string
  sources: Array<{ id: string; title: string; type: string }>
}> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
  const title = `${keyword} 투자 분석 - ${today}`

  const nb = await createNotebook(title)
  const sources: Array<{ id: string; title: string; type: string }> = []

  // Add YouTube URLs
  for (const url of youtubeUrls.slice(0, 5)) {
    try {
      const source = await addSourceUrl(nb.id, url)
      sources.push({ ...source, type: 'youtube' })
    } catch {
      // skip failed sources
    }
  }

  // Add analysis text
  if (analysisText.trim()) {
    try {
      const source = await addSourceText(
        nb.id,
        `${keyword} AI 분석 리포트`,
        analysisText
      )
      sources.push({ ...source, type: 'text' })
    } catch {
      // skip
    }
  }

  return { id: nb.id, title, sources }
}
