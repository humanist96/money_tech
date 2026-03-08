/**
 * Background service worker - handles NotebookLM API calls from user's browser.
 * All requests go directly from the user's IP (not Vercel), so Google accepts cookies.
 */

const BASE_URL = 'https://notebooklm.google.com'
const BATCH_URL = `${BASE_URL}/_/LabsTailwindUi/data/batchexecute`

const RPC = {
  LIST_NOTEBOOKS: 'wXbhsf',
  CREATE_NOTEBOOK: 'CCqFvf',
  GET_NOTEBOOK: 'rLM1Ne',
  DELETE_NOTEBOOK: 'WWINqb',
  ADD_SOURCE: 'izAoDd',
  LIST_ARTIFACTS: 'gArtLc',
  CREATE_ARTIFACT: 'R7cb6c',
  EXPORT_ARTIFACT: 'Krh3pd',
  GET_CONVERSATION_ID: 'hPTbtc',
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
}

// --- Cookie helpers ---

async function getGoogleCookieString() {
  const cookieMap = new Map()
  const urls = [
    'https://notebooklm.google.com',
    'https://accounts.google.com',
    'https://www.google.com',
  ]
  for (const url of urls) {
    const cookies = await chrome.cookies.getAll({ url })
    for (const c of cookies) {
      if (!cookieMap.has(c.name)) cookieMap.set(c.name, c)
    }
  }
  // Also brute force
  const all = await chrome.cookies.getAll({})
  for (const c of all) {
    if (c.domain.includes('google') && !cookieMap.has(c.name)) {
      cookieMap.set(c.name, c)
    }
  }
  return Array.from(cookieMap.values())
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')
}

// --- Auth token extraction ---

let cachedAuth = null
let cacheTime = 0
const CACHE_TTL = 10 * 60 * 1000

async function getAuth() {
  if (cachedAuth && Date.now() - cacheTime < CACHE_TTL) return cachedAuth

  const cookies = await getGoogleCookieString()
  if (!cookies) throw new Error('Google 쿠키를 찾을 수 없습니다. Google에 로그인하세요.')

  const res = await fetch(BASE_URL, {
    headers: { ...BROWSER_HEADERS, Cookie: cookies },
    redirect: 'follow',
  })

  const html = await res.text()
  const csrfMatch = html.match(/"SNlM0e"\s*:\s*"([^"]+)"/)
  const sessionMatch = html.match(/"FdrFJe"\s*:\s*"([^"]+)"/)

  if (!csrfMatch || !sessionMatch) {
    const hasLoginForm = html.includes('accounts.google.com') || html.includes('ServiceLogin')
    if (hasLoginForm) {
      throw new Error('Google 로그인이 필요합니다. notebooklm.google.com에 로그인하세요.')
    }
    throw new Error('인증 토큰 추출 실패. 페이지 구조가 변경되었을 수 있습니다.')
  }

  cachedAuth = { cookies, csrfToken: csrfMatch[1], sessionId: sessionMatch[1] }
  cacheTime = Date.now()
  return cachedAuth
}

function clearAuthCache() {
  cachedAuth = null
  cacheTime = 0
}

// --- batchexecute ---

function buildBatchRequest(rpcId, params, auth, sourcePath = '/') {
  const paramsJson = JSON.stringify(params)
  const outerArray = [[[rpcId, paramsJson, null, 'generic']]]
  const fReq = JSON.stringify(outerArray)

  const urlParams = new URLSearchParams({
    rpcids: rpcId,
    'source-path': sourcePath,
    'f.sid': auth.sessionId,
    rt: 'c',
  })

  const bodyParams = new URLSearchParams({
    'f.req': fReq,
    at: auth.csrfToken,
  })

  return {
    url: `${BATCH_URL}?${urlParams}`,
    body: bodyParams.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Cookie: auth.cookies,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      'User-Agent': BROWSER_HEADERS['User-Agent'],
    },
  }
}

function decodeBatchResponse(text, rpcId) {
  const cleaned = text.replace(/^\)\]\}'/, '')
  const lines = cleaned.split('\n').filter((l) => l.trim())

  for (const line of lines) {
    if (!line.trim().startsWith('[')) continue
    try {
      const parsed = JSON.parse(line)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (Array.isArray(item) && item[0] === 'wrb.fr' && item[1] === rpcId) {
            const resultStr = item[2]
            if (typeof resultStr === 'string') return JSON.parse(resultStr)
            return resultStr
          }
        }
      }
    } catch {
      continue
    }
  }
  throw new Error(`RPC ${rpcId}: 응답 파싱 실패`)
}

async function rpcCall(rpcId, params, sourcePath) {
  const auth = await getAuth()
  const { url, body, headers } = buildBatchRequest(rpcId, params, auth, sourcePath)
  const res = await fetch(url, { method: 'POST', headers, body })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RPC 실패 (${res.status}): ${text.slice(0, 200)}`)
  }
  const text = await res.text()
  return decodeBatchResponse(text, rpcId)
}

// --- API handlers ---

const handlers = {
  async checkAuth() {
    try {
      await getAuth()
      return { authenticated: true }
    } catch (e) {
      return { authenticated: false, error: e.message }
    }
  },

  async listNotebooks() {
    const result = await rpcCall(RPC.LIST_NOTEBOOKS, [null, 1, null, [2]])
    const notebooks = []
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
  },

  async createNotebook({ title }) {
    const result = await rpcCall(RPC.CREATE_NOTEBOOK, [title, null, null, [2], [1]])
    const id = Array.isArray(result) ? result[0] : null
    if (!id) throw new Error('노트북 생성 실패')
    return { id, title }
  },

  async getNotebook({ notebookId }) {
    const result = await rpcCall(
      RPC.GET_NOTEBOOK,
      [notebookId, null, [2], null, 0],
      `/notebook/${notebookId}`
    )
    let title = 'Untitled'
    const sources = []
    if (Array.isArray(result)) {
      title = result[0]?.[3]?.[1] ?? result[0]?.[0] ?? 'Untitled'
      const sourceList = result[2]
      if (Array.isArray(sourceList)) {
        for (const s of sourceList) {
          if (Array.isArray(s)) {
            const sourceId = s[0]
            const sourceTitle = s[2]?.[0] ?? s[1] ?? 'Untitled'
            const sourceType =
              s[3] != null ? ['text', 'url', 'youtube', 'file'][s[3]] ?? 'unknown' : 'unknown'
            if (sourceId) sources.push({ id: sourceId, title: sourceTitle, type: sourceType, status: 'ready' })
          }
        }
      }
    }
    return { id: notebookId, title, sources }
  },

  async deleteNotebook({ notebookId }) {
    await rpcCall(RPC.DELETE_NOTEBOOK, [[notebookId], [2]])
    return { deleted: true }
  },

  async addSourceUrl({ notebookId, url }) {
    const isYoutube = url.includes('youtube.com') || url.includes('youtu.be')
    const params = isYoutube
      ? [[[null, null, null, null, null, null, null, [url], null, null, 1]], notebookId, [2], [1, null, null, null, null, null, null, null, null, null, [1]]]
      : [[[null, null, [url], null, null, null, null, null]], notebookId, [2], null, null]

    const result = await rpcCall(RPC.ADD_SOURCE, params, `/notebook/${notebookId}`)
    let sourceId = '', sourceTitle = url
    if (Array.isArray(result)) {
      sourceId = result[0]?.[0] ?? result[0] ?? ''
      sourceTitle = result[0]?.[2]?.[0] ?? url
    }
    return { id: sourceId, title: sourceTitle }
  },

  async addSourceText({ notebookId, title, content }) {
    const params = [
      [[null, [title, content], null, null, null, null, null, null]],
      notebookId, [2], null, null,
    ]
    const result = await rpcCall(RPC.ADD_SOURCE, params, `/notebook/${notebookId}`)
    let sourceId = ''
    if (Array.isArray(result)) {
      sourceId = result[0]?.[0] ?? result[0] ?? ''
    }
    return { id: sourceId, title }
  },

  async chat({ notebookId, question, conversationId }) {
    const auth = await getAuth()
    let convId = conversationId
    if (!convId) {
      try {
        const result = await rpcCall(
          RPC.GET_CONVERSATION_ID,
          [[], null, notebookId, 1],
          `/notebook/${notebookId}`
        )
        if (Array.isArray(result) && result[0]) convId = result[0]
      } catch {}
      if (!convId) convId = crypto.randomUUID()
    }

    const innerParams = [[], question, null, [2, null, [1], [1]], convId, null, null, notebookId, 1]
    const outerParams = [null, JSON.stringify(innerParams)]
    const fReq = JSON.stringify([[['gEBPpe', JSON.stringify(outerParams), null, 'generic']]])

    const chatUrl = `${BASE_URL}/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed`
    const urlParams = new URLSearchParams({
      hl: 'en',
      _reqid: String(Math.floor(Math.random() * 900000) + 100000),
      rt: 'c',
      'f.sid': auth.sessionId,
    })
    const bodyParams = new URLSearchParams({ 'f.req': fReq, at: auth.csrfToken })

    const res = await fetch(`${chatUrl}?${urlParams}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Cookie: auth.cookies,
        Origin: BASE_URL,
        'User-Agent': BROWSER_HEADERS['User-Agent'],
      },
      body: bodyParams.toString(),
    })

    const text = await res.text()
    const cleaned = text.replace(/^\)\]\}'/, '')

    let answer = ''
    const references = []
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
                  if (Array.isArray(ref) && typeof ref[0] === 'string') references.push({ text: ref[0] })
                }
              }
            }
          }
        }
      } catch {
        continue
      }
    }

    return { answer: answer || '응답을 받지 못했습니다', conversationId: convId, references }
  },

  async generateAudio({ notebookId, format = 'deep-dive' }) {
    const formatMap = { 'deep-dive': 1, brief: 2, critique: 3, debate: 4 }
    const result = await rpcCall(
      RPC.CREATE_ARTIFACT,
      [notebookId, [2], [1, formatMap[format] ?? 1], null, null],
      `/notebook/${notebookId}`
    )
    return { id: Array.isArray(result) ? result[0] ?? '' : '', status: 'generating' }
  },

  async getArtifactStatus({ notebookId, artifactId }) {
    const result = await rpcCall(RPC.LIST_ARTIFACTS, [notebookId, [2]], `/notebook/${notebookId}`)
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
  },

  async exportArtifact({ notebookId, artifactId }) {
    const result = await rpcCall(
      RPC.EXPORT_ARTIFACT,
      [notebookId, artifactId, [2]],
      `/notebook/${notebookId}`
    )
    if (Array.isArray(result)) {
      return {
        url: typeof result[0] === 'string' ? result[0] : undefined,
        content: typeof result[1] === 'string' ? result[1] : undefined,
      }
    }
    return {}
  },

  async generateReport({ notebookId, reportType = 'briefing' }) {
    const typeMap = { briefing: 2, study_guide: 3 }
    const result = await rpcCall(
      RPC.CREATE_ARTIFACT,
      [notebookId, [2], [typeMap[reportType] ?? 2], null, null],
      `/notebook/${notebookId}`
    )
    let id = '', content = ''
    if (Array.isArray(result)) {
      id = result[0] ?? ''
      content = result[1] ?? result[2] ?? ''
    }
    return { id, content: typeof content === 'string' ? content : JSON.stringify(content) }
  },

  async generateQuiz({ notebookId }) {
    const result = await rpcCall(
      RPC.CREATE_ARTIFACT,
      [notebookId, [2], [4], null, null],
      `/notebook/${notebookId}`
    )
    const questions = []
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
  },

  async createResearchNotebook({ keyword, youtubeUrls, analysisText }) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
    const title = `${keyword} 투자 분석 - ${today}`

    const nb = await handlers.createNotebook({ title })
    const sources = []

    for (const url of (youtubeUrls || []).slice(0, 5)) {
      try {
        const source = await handlers.addSourceUrl({ notebookId: nb.id, url })
        sources.push({ ...source, type: 'youtube' })
      } catch {}
    }

    if (analysisText && analysisText.trim()) {
      try {
        const source = await handlers.addSourceText({
          notebookId: nb.id,
          title: `${keyword} AI 분석 리포트`,
          content: analysisText,
        })
        sources.push({ ...source, type: 'text' })
      } catch {}
    }

    return { id: nb.id, title, sources }
  },
}

// --- Message listener ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, data } = message

  if (action === 'clearAuthCache') {
    clearAuthCache()
    sendResponse({ success: true })
    return false
  }

  const handler = handlers[action]
  if (!handler) {
    sendResponse({ error: `Unknown action: ${action}` })
    return false
  }

  // Run async handler
  handler(data || {})
    .then((result) => sendResponse({ success: true, data: result }))
    .catch((err) => sendResponse({ success: false, error: err.message }))

  return true // keep message channel open for async response
})
