import { NextRequest, NextResponse } from 'next/server'
import {
  checkAuth,
  listNotebooks,
  createNotebook,
  getNotebook,
  deleteNotebook,
  addSourceUrl,
  addSourceText,
  chat,
  generateAudio,
  getArtifactStatus,
  exportArtifact,
  generateReport,
  generateQuiz,
  createResearchNotebook,
  parseCookieInput,
} from '@/lib/notebooklm'

type RouteParams = { params: Promise<{ action: string[] }> }

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

function errorJson(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

function getCookies(request: NextRequest): string {
  // Client sends Google cookies via X-NB-Cookies header
  const raw = request.headers.get('x-nb-cookies') || ''
  if (!raw) throw new Error('Google 쿠키가 설정되지 않았습니다. 설정에서 쿠키를 입력해주세요.')
  return parseCookieInput(raw)
}

async function handleGet(request: NextRequest, action: string[]): Promise<NextResponse> {
  const path = action.join('/')

  // GET /auth/status - check if cookies are valid
  if (path === 'auth/status') {
    const raw = request.headers.get('x-nb-cookies') || ''
    if (!raw) return json({ authenticated: false, error: 'No cookies' })
    const cookies = parseCookieInput(raw)
    const result = await checkAuth(cookies)
    return json(result)
  }

  const cookies = getCookies(request)

  // GET /notebooks
  if (path === 'notebooks') {
    return json(await listNotebooks(cookies))
  }

  // GET /notebooks/:id
  if (action[0] === 'notebooks' && action.length === 2) {
    return json(await getNotebook(cookies, action[1]))
  }

  // GET /notebooks/:id/sources
  if (action[0] === 'notebooks' && action[2] === 'sources' && action.length === 3) {
    const detail = await getNotebook(cookies, action[1])
    return json(detail.sources)
  }

  // GET /notebooks/:id/audio/:artifactId/status
  if (action[0] === 'notebooks' && action[2] === 'audio' && action[4] === 'status') {
    return json(await getArtifactStatus(cookies, action[1], action[3]))
  }

  // GET /notebooks/:id/audio/:artifactId/download
  if (action[0] === 'notebooks' && action[2] === 'audio' && action[4] === 'download') {
    const result = await exportArtifact(cookies, action[1], action[3])
    if (result.url) return NextResponse.redirect(result.url)
    return errorJson('Audio not available', 404)
  }

  return errorJson('Not found', 404)
}

async function handlePost(request: NextRequest, action: string[], body: unknown): Promise<NextResponse> {
  const path = action.join('/')
  const data = (body ?? {}) as Record<string, unknown>

  // POST /auth/login - no-op, auth is via cookies from client
  if (path === 'auth/login') {
    return json({ success: false, message: '설정에서 Google 쿠키를 입력해주세요' })
  }

  const cookies = getCookies(request)

  // POST /notebooks
  if (path === 'notebooks') {
    const title = data.title as string
    if (!title) return errorJson('title is required', 400)
    return json(await createNotebook(cookies, title))
  }

  // POST /notebooks/research
  if (path === 'notebooks/research') {
    const keyword = data.keyword as string
    if (!keyword) return errorJson('keyword is required', 400)
    return json(await createResearchNotebook(
      cookies, keyword, (data.youtube_urls as string[]) || [], (data.analysis_text as string) ?? ''
    ))
  }

  // POST /notebooks/:id/sources/url
  if (action[0] === 'notebooks' && action[2] === 'sources' && action[3] === 'url') {
    const url = data.url as string
    if (!url) return errorJson('url is required', 400)
    return json(await addSourceUrl(cookies, action[1], url))
  }

  // POST /notebooks/:id/sources/text
  if (action[0] === 'notebooks' && action[2] === 'sources' && action[3] === 'text') {
    const title = data.title as string
    const content = data.content as string
    if (!title || !content) return errorJson('title and content are required', 400)
    return json(await addSourceText(cookies, action[1], title, content))
  }

  // POST /notebooks/:id/chat
  if (action[0] === 'notebooks' && action[2] === 'chat' && action.length === 3) {
    const question = data.question as string
    if (!question) return errorJson('question is required', 400)
    return json(await chat(cookies, action[1], question, data.conversation_id as string | undefined))
  }

  // POST /notebooks/:id/audio
  if (action[0] === 'notebooks' && action[2] === 'audio' && action.length === 3) {
    return json(await generateAudio(cookies, action[1], (data.format as string) ?? 'deep-dive'))
  }

  // POST /notebooks/:id/report
  if (action[0] === 'notebooks' && action[2] === 'report') {
    return json(await generateReport(cookies, action[1], (data.report_type as string) ?? 'briefing'))
  }

  // POST /notebooks/:id/quiz
  if (action[0] === 'notebooks' && action[2] === 'quiz') {
    return json(await generateQuiz(cookies, action[1]))
  }

  return errorJson('Not found', 404)
}

async function handleDelete(request: NextRequest, action: string[]): Promise<NextResponse> {
  const cookies = getCookies(request)

  if (action[0] === 'notebooks' && action.length === 2) {
    return json(await deleteNotebook(cookies, action[1]))
  }

  return errorJson('Not found', 404)
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { action } = await params
  try {
    return await handleGet(request, action)
  } catch (e) {
    return errorJson(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { action } = await params
  let body: unknown
  try { body = await request.json() } catch { /* no body */ }
  try {
    return await handlePost(request, action, body)
  } catch (e) {
    return errorJson(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { action } = await params
  try {
    return await handleDelete(request, action)
  } catch (e) {
    return errorJson(e instanceof Error ? e.message : 'Unknown error')
  }
}
