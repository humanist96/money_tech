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
} from '@/lib/notebooklm'

type RouteParams = { params: Promise<{ action: string[] }> }

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

function errorJson(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

async function handleGet(action: string[]): Promise<NextResponse> {
  const path = action.join('/')

  // GET /auth/status
  if (path === 'auth/status') {
    const result = await checkAuth()
    return json(result)
  }

  // GET /notebooks
  if (path === 'notebooks') {
    const notebooks = await listNotebooks()
    return json(notebooks)
  }

  // GET /notebooks/:id
  if (action[0] === 'notebooks' && action.length === 2) {
    const detail = await getNotebook(action[1])
    return json(detail)
  }

  // GET /notebooks/:id/sources
  if (action[0] === 'notebooks' && action[2] === 'sources' && action.length === 3) {
    const detail = await getNotebook(action[1])
    return json(detail.sources)
  }

  // GET /notebooks/:id/audio/:artifactId/status
  if (action[0] === 'notebooks' && action[2] === 'audio' && action[4] === 'status') {
    const result = await getArtifactStatus(action[1], action[3])
    return json(result)
  }

  // GET /notebooks/:id/audio/:artifactId/download
  if (action[0] === 'notebooks' && action[2] === 'audio' && action[4] === 'download') {
    const result = await exportArtifact(action[1], action[3])
    if (result.url) {
      return NextResponse.redirect(result.url)
    }
    return errorJson('Audio not available', 404)
  }

  return errorJson('Not found', 404)
}

async function handlePost(action: string[], body: unknown): Promise<NextResponse> {
  const path = action.join('/')
  const data = (body ?? {}) as Record<string, unknown>

  // POST /notebooks
  if (path === 'notebooks') {
    const title = data.title as string
    if (!title) return errorJson('title is required', 400)
    const nb = await createNotebook(title)
    return json(nb)
  }

  // POST /notebooks/research
  if (path === 'notebooks/research') {
    const keyword = data.keyword as string
    const youtubeUrls = data.youtube_urls as string[]
    const analysisText = (data.analysis_text as string) ?? ''
    if (!keyword) return errorJson('keyword is required', 400)
    const nb = await createResearchNotebook(keyword, youtubeUrls || [], analysisText)
    return json(nb)
  }

  // POST /notebooks/:id/sources/url
  if (action[0] === 'notebooks' && action[2] === 'sources' && action[3] === 'url') {
    const url = data.url as string
    if (!url) return errorJson('url is required', 400)
    const source = await addSourceUrl(action[1], url)
    return json(source)
  }

  // POST /notebooks/:id/sources/text
  if (action[0] === 'notebooks' && action[2] === 'sources' && action[3] === 'text') {
    const title = data.title as string
    const content = data.content as string
    if (!title || !content) return errorJson('title and content are required', 400)
    const source = await addSourceText(action[1], title, content)
    return json(source)
  }

  // POST /notebooks/:id/chat
  if (action[0] === 'notebooks' && action[2] === 'chat' && action.length === 3) {
    const question = data.question as string
    const conversationId = data.conversation_id as string | undefined
    if (!question) return errorJson('question is required', 400)
    const result = await chat(action[1], question, conversationId)
    return json(result)
  }

  // POST /notebooks/:id/audio
  if (action[0] === 'notebooks' && action[2] === 'audio' && action.length === 3) {
    const format = (data.format as string) ?? 'deep-dive'
    const result = await generateAudio(action[1], format)
    return json(result)
  }

  // POST /notebooks/:id/report
  if (action[0] === 'notebooks' && action[2] === 'report') {
    const reportType = (data.report_type as string) ?? 'briefing'
    const result = await generateReport(action[1], reportType)
    return json(result)
  }

  // POST /notebooks/:id/quiz
  if (action[0] === 'notebooks' && action[2] === 'quiz') {
    const result = await generateQuiz(action[1])
    return json(result)
  }

  // POST /auth/login (no-op in Vercel mode, auth via env var)
  if (path === 'auth/login') {
    return json({
      success: false,
      message: 'Set NOTEBOOKLM_AUTH_JSON environment variable in Vercel dashboard',
    })
  }

  return errorJson('Not found', 404)
}

async function handleDelete(action: string[]): Promise<NextResponse> {
  // DELETE /notebooks/:id
  if (action[0] === 'notebooks' && action.length === 2) {
    const result = await deleteNotebook(action[1])
    return json(result)
  }

  return errorJson('Not found', 404)
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { action } = await params
  try {
    return await handleGet(action)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return errorJson(msg)
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { action } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    // no body
  }
  try {
    return await handlePost(action, body)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return errorJson(msg)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { action } = await params
  try {
    return await handleDelete(action)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return errorJson(msg)
  }
}
