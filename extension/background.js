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

  // Extract bl (build label) for chat API
  const blMatch = html.match(/"cfb2h"\s*:\s*"([^"]+)"/)
  const bl = blMatch ? blMatch[1] : 'boq_labs-tailwind-frontend_20251221.14_p0'
  console.log('[NB] auth extracted bl:', bl)

  cachedAuth = { cookies, csrfToken: csrfMatch[1], sessionId: sessionMatch[1], bl }
  cacheTime = Date.now()
  return cachedAuth
}

function clearAuthCache() {
  cachedAuth = null
  cacheTime = 0
}

// --- batchexecute ---

function buildBatchRequest(rpcId, params, auth, sourcePath = '/') {
  // Match notebooklm-py encoder.py: compact JSON (no spaces)
  const paramsJson = JSON.stringify(params)
  const outerArray = [[[rpcId, paramsJson, null, 'generic']]]
  const fReq = JSON.stringify(outerArray)

  const urlParams = new URLSearchParams({
    rpcids: rpcId,
    'source-path': sourcePath,
    'f.sid': auth.sessionId,
    hl: 'en',
    rt: 'c',
  })

  // Match Python's quote(safe='') + form encoding
  const body = `f.req=${encodeURIComponent(fReq)}&at=${encodeURIComponent(auth.csrfToken)}&`

  return {
    url: `${BATCH_URL}?${urlParams}`,
    body,
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
  // Step 1: Strip anti-XSSI prefix
  let cleaned = text
  const xssiMatch = cleaned.match(/^\)\]\}'\r?\n/)
  if (xssiMatch) cleaned = cleaned.slice(xssiMatch[0].length)

  // Step 2: Parse chunked response (alternating byte_count + json_payload lines)
  const chunks = []
  const lines = cleaned.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }
    // Try as byte count
    if (/^\d+$/.test(line)) {
      i++
      if (i < lines.length) {
        try { chunks.push(JSON.parse(lines[i])) } catch {}
      }
      i++
    } else {
      try { chunks.push(JSON.parse(line)) } catch {}
      i++
    }
  }

  // Step 3: Extract RPC result
  for (const chunk of chunks) {
    if (!Array.isArray(chunk)) continue
    const items = (chunk.length > 0 && Array.isArray(chunk[0])) ? chunk : [chunk]
    for (const item of items) {
      if (!Array.isArray(item) || item.length < 3) continue
      if (item[0] === 'er' && item[1] === rpcId) {
        throw new Error(`RPC 에러: ${item[2]}`)
      }
      if (item[0] === 'wrb.fr' && item[1] === rpcId) {
        const resultData = item[2]
        if (typeof resultData === 'string') {
          try { return JSON.parse(resultData) } catch { return resultData }
        }
        return resultData
      }
    }
  }
  return null
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

// --- Chat response parser (matches notebooklm-py _chat.py._extract_answer_from_chunk) ---

function extractAnswerFromChunk(jsonStr) {
  try {
    const data = JSON.parse(jsonStr)
    if (!Array.isArray(data)) return { text: null, isAnswer: false }

    for (const item of data) {
      if (!Array.isArray(item) || item.length < 3) continue
      if (item[0] !== 'wrb.fr') continue

      const innerJson = item[2]
      if (typeof innerJson !== 'string') continue

      try {
        const innerData = JSON.parse(innerJson)
        if (!Array.isArray(innerData) || innerData.length === 0) continue

        const first = innerData[0]
        if (!Array.isArray(first) || first.length === 0) continue

        const text = first[0]
        if (typeof text !== 'string' || text.length <= 20) continue

        // Check answer type flag: first[4][-1] === 1
        let isAnswer = false
        if (first.length > 4 && Array.isArray(first[4])) {
          const typeInfo = first[4]
          if (typeInfo.length > 0 && typeInfo[typeInfo.length - 1] === 1) {
            isAnswer = true
          }
        }

        // Fallback: if text is long enough and looks like an answer, accept it
        if (!isAnswer && text.length > 100) {
          isAnswer = true
        }

        return { text, isAnswer }
      } catch { /* inner parse error */ }
    }
  } catch { /* outer parse error */ }

  return { text: null, isAnswer: false }
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
    const rawStr = JSON.stringify(result)?.slice(0, 3000)
    console.log('[NB] listNotebooks raw:', rawStr)
    const notebooks = []
    if (Array.isArray(result)) {
      const rawList = Array.isArray(result[0]) ? result[0] : result
      for (const item of rawList) {
        if (!Array.isArray(item)) continue
        // Notebook.from_api_response: data[0]=title, data[2]=id
        const rawTitle = (typeof item[0] === 'string') ? item[0] : ''
        const title = rawTitle.replace('thought\n', '').trim() || 'Untitled'
        const id = (typeof item[2] === 'string') ? item[2] : ''
        console.log('[NB] notebook:', { id: id?.slice(0, 20), title })
        if (id) notebooks.push({ id, title })
      }
    }
    // Return debug info along with notebooks
    return { notebooks, _debug: rawStr }
  },

  async createNotebook({ title }) {
    const result = await rpcCall(RPC.CREATE_NOTEBOOK, [title, null, null, [2], [1]])
    console.log('[NB] createNotebook raw:', JSON.stringify(result)?.slice(0, 500))
    // from_api_response: data[0]=title, data[2]=id
    const id = Array.isArray(result) && typeof result[2] === 'string' ? result[2] : (Array.isArray(result) ? result[0] : null)
    if (!id) throw new Error('노트북 생성 실패')
    return { id, title }
  },

  async getNotebook({ notebookId }) {
    const result = await rpcCall(
      RPC.GET_NOTEBOOK,
      [notebookId, null, [2], null, 0],
      `/notebook/${notebookId}`
    )
    console.log('[NB] getNotebook raw:', JSON.stringify(result)?.slice(0, 2000))
    // result[0] = notebook info (data[0]=title, data[2]=id)
    // result[0][1] = sources list (from _sources.py)
    let title = 'Untitled'
    const sources = []
    if (Array.isArray(result)) {
      const nbInfo = Array.isArray(result[0]) ? result[0] : result
      const rawTitle = (typeof nbInfo[0] === 'string') ? nbInfo[0] : ''
      title = rawTitle.replace('thought\n', '').trim() || 'Untitled'

      // Sources at nbInfo[1]
      const sourceList = nbInfo[1]
      if (Array.isArray(sourceList)) {
        for (const src of sourceList) {
          if (!Array.isArray(src)) continue
          // src[0][0] = source ID, src[1] = title
          const sourceId = Array.isArray(src[0]) ? src[0][0] : src[0]
          const sourceTitle = src[1] ?? 'Untitled'
          // src[2][7] = URL for web/youtube sources
          let url = null
          if (Array.isArray(src[2]) && src[2].length > 7 && Array.isArray(src[2][7])) {
            url = src[2][7][0] ?? null
          }
          // src[3][1] = status (1=processing, 2=ready, 3=error)
          let status = 'ready'
          if (Array.isArray(src[3]) && src[3].length > 1) {
            status = src[3][1] === 1 ? 'processing' : src[3][1] === 3 ? 'error' : 'ready'
          }
          let sourceType = 'text'
          if (url) {
            sourceType = (url.includes('youtube.com') || url.includes('youtu.be')) ? 'youtube' : 'url'
          }
          if (sourceId) sources.push({ id: String(sourceId), title: sourceTitle, type: sourceType, status, url })
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

  // Helper: get source IDs from notebook
  async _getSourceIds(notebookId) {
    const result = await rpcCall(RPC.GET_NOTEBOOK, [notebookId, null, [2], null, 0], `/notebook/${notebookId}`)
    const sourceIds = []
    if (Array.isArray(result) && Array.isArray(result[0]) && Array.isArray(result[0][1])) {
      for (const src of result[0][1]) {
        if (Array.isArray(src) && Array.isArray(src[0]) && typeof src[0][0] === 'string') {
          sourceIds.push(src[0][0])
        }
      }
    }
    return sourceIds
  },

  async chat({ notebookId, question, conversationId }) {
    const auth = await getAuth()

    // Get source IDs for the notebook
    const sourceIds = await handlers._getSourceIds(notebookId)
    const sourcesArray = sourceIds.map(sid => [[sid]])

    const convId = conversationId || crypto.randomUUID()

    // Match notebooklm-py _chat.py exactly:
    // params = [sources_array, question, conversation_history, [2, None, [1]], conversation_id]
    const params = [sourcesArray, question, null, [2, null, [1]], convId]
    // Compact JSON (no spaces) matching Python separators=(",",":")
    const paramsJson = JSON.stringify(params)
    const fReqInner = [null, paramsJson]
    const fReqJson = JSON.stringify(fReqInner)
    console.log('[NB] chat sourceIds:', sourceIds.length, 'convId:', convId)

    // URL-encode body matching Python's quote(safe='')
    const body = `f.req=${encodeURIComponent(fReqJson)}&at=${encodeURIComponent(auth.csrfToken)}&`

    const chatUrl = `${BASE_URL}/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed`
    const urlParams = new URLSearchParams({
      bl: auth.bl || 'boq_labs-tailwind-frontend_20251221.14_p0',
      hl: 'en',
      _reqid: String(Math.floor(Math.random() * 900000) + 100000),
      rt: 'c',
    })
    if (auth.sessionId) urlParams.set('f.sid', auth.sessionId)

    const res = await fetch(`${chatUrl}?${urlParams}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Cookie: auth.cookies,
        Origin: BASE_URL,
        Referer: `${BASE_URL}/notebook/${notebookId}`,
        'User-Agent': BROWSER_HEADERS['User-Agent'],
      },
      body,
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[NB] chat HTTP error:', res.status, errText.slice(0, 300))
      throw new Error(`Chat 요청 실패 (${res.status})`)
    }

    const text = await res.text()
    console.log('[NB] chat raw response length:', text.length)
    console.log('[NB] chat raw first 500:', text.slice(0, 500))

    // Parse response matching notebooklm-py _chat.py._parse_ask_response exactly
    let cleaned = text
    if (cleaned.startsWith(")]}'")) cleaned = cleaned.slice(4)

    let longestAnswer = ''
    const lines = cleaned.trim().split('\n')
    let i = 0
    while (i < lines.length) {
      const line = lines[i].trim()
      if (!line) { i++; continue }

      let jsonStr = null
      // Try as byte count (number-only line)
      if (/^\d+$/.test(line)) {
        i++
        if (i < lines.length) jsonStr = lines[i]
        i++
      } else {
        jsonStr = line
        i++
      }
      if (!jsonStr) continue

      const extracted = extractAnswerFromChunk(jsonStr)
      if (extracted.text && extracted.isAnswer && extracted.text.length > longestAnswer.length) {
        longestAnswer = extracted.text
      }
    }

    console.log('[NB] chat parsed answer length:', longestAnswer.length)
    return { answer: longestAnswer || '응답을 받지 못했습니다', conversationId: convId, references: [] }
  },

  async generateAudio({ notebookId, format = 'deep-dive', language = 'ko' }) {
    const sourceIds = await handlers._getSourceIds(notebookId)
    const sourceIdsTriple = sourceIds.map(sid => [[sid]])
    const sourceIdsDouble = sourceIds.map(sid => [sid])
    // AudioFormat: 1=DEEP_DIVE, 2=BRIEF, 3=CRITIQUE, 4=DEBATE
    const formatMap = { 'deep-dive': 1, brief: 2, critique: 3, debate: 4 }
    // AudioLength: 1=SHORT, 2=DEFAULT, 3=LONG
    const audioLength = 2

    // Match notebooklm-py _artifacts.py generate_audio exactly
    const params = [
      [2], notebookId,
      [null, null, 1, sourceIdsTriple, null, null,
        [null, [null, audioLength, null, sourceIdsDouble, language, null, formatMap[format] ?? 1]]
      ]
    ]
    const result = await rpcCall('R7cb6c', params, `/notebook/${notebookId}`)
    console.log('[NB] generateAudio raw:', JSON.stringify(result)?.slice(0, 500))
    let id = '', status = 'generating'
    if (Array.isArray(result) && Array.isArray(result[0])) {
      id = result[0][0] ?? ''
      status = result[0][4] === 3 ? 'completed' : result[0][4] === 1 ? 'in_progress' : 'generating'
    }
    return { id, status }
  },

  async getArtifactStatus({ notebookId, artifactId }) {
    // Matches _artifacts.py list params
    const params = [[2], notebookId, 'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"']
    const result = await rpcCall(RPC.LIST_ARTIFACTS, params, `/notebook/${notebookId}`)
    if (Array.isArray(result)) {
      const artifacts = Array.isArray(result[0]) ? result[0] : result
      for (const a of artifacts) {
        if (!Array.isArray(a)) continue
        // a[0]=id, a[1]=title, a[2]=type, a[4]=status (1=processing, 3=completed)
        if (a[0] === artifactId) {
          const status = a[4] === 3 ? 'completed' : a[4] === 1 ? 'in_progress' : 'generating'
          return { id: artifactId, status }
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

  async generateReport({ notebookId, reportType = 'briefing', language = 'ko' }) {
    const sourceIds = await handlers._getSourceIds(notebookId)
    const sourceIdsTriple = sourceIds.map(sid => [[sid]])
    const sourceIdsDouble = sourceIds.map(sid => [sid])

    const configs = {
      briefing: { title: 'Briefing Doc', desc: 'Key insights and important quotes', prompt: 'Create a comprehensive briefing document that includes an Executive Summary, detailed analysis of key themes, important quotes with context, and actionable insights.' },
      study_guide: { title: 'Study Guide', desc: 'Short-answer quiz, essay questions, glossary', prompt: 'Create a comprehensive study guide that includes key concepts, short-answer practice questions, essay prompts for deeper exploration, and a glossary of important terms.' },
    }
    const config = configs[reportType] || configs.briefing

    // Match notebooklm-py _artifacts.py generate_report exactly
    const params = [
      [2], notebookId,
      [null, null, 2, sourceIdsTriple, null, null, null,
        [null, [config.title, config.desc, null, sourceIdsDouble, language, config.prompt, null, true]]
      ]
    ]
    const result = await rpcCall('R7cb6c', params, `/notebook/${notebookId}`)
    console.log('[NB] generateReport raw:', JSON.stringify(result)?.slice(0, 500))
    let id = '', status = 'generating'
    if (Array.isArray(result) && Array.isArray(result[0])) {
      id = result[0][0] ?? ''
      status = result[0][4] === 3 ? 'completed' : 'in_progress'
    }
    return { id, status, content: '' }
  },

  async generateQuiz({ notebookId }) {
    const sourceIds = await handlers._getSourceIds(notebookId)
    const sourceIdsTriple = sourceIds.map(sid => [[sid]])

    // Match notebooklm-py _artifacts.py generate_quiz exactly
    // type=4 (QUIZ_FLASHCARD), variant=2 (quiz, not flashcard)
    // QuizQuantity: 2=STANDARD, QuizDifficulty: 2=MEDIUM
    const params = [
      [2], notebookId,
      [null, null, 4, sourceIdsTriple, null, null, null, null, null,
        [null, [2, null, null, null, null, null, null, [2, 2]]]
      ]
    ]
    const result = await rpcCall('R7cb6c', params, `/notebook/${notebookId}`)
    console.log('[NB] generateQuiz raw:', JSON.stringify(result)?.slice(0, 500))
    let id = '', status = 'generating'
    if (Array.isArray(result) && Array.isArray(result[0])) {
      id = result[0][0] ?? ''
      status = result[0][4] === 3 ? 'completed' : 'in_progress'
    }
    return { id, status, questions: [] }
  },

  async exportCookies() {
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
    const all = await chrome.cookies.getAll({})
    for (const c of all) {
      if (c.domain.includes('google') && !cookieMap.has(c.name)) {
        cookieMap.set(c.name, c)
      }
    }
    const storageCookies = Array.from(cookieMap.values()).map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : c.sameSite === 'lax' ? 'Lax' : 'Strict',
      expires: c.expirationDate || -1,
    }))
    return { cookies: storageCookies, origins: [] }
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
