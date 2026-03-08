import { NextRequest, NextResponse } from 'next/server'

const NOTEBOOKLM_API_URL = process.env.NOTEBOOKLM_API_URL || 'http://localhost:8000'

async function proxyRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<NextResponse> {
  const url = `${NOTEBOOKLM_API_URL}/api/${path}`

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body)
    }

    const res = await fetch(url, fetchOptions)

    if (res.headers.get('content-type')?.includes('audio/')) {
      const audioData = await res.arrayBuffer()
      return new NextResponse(audioData, {
        status: res.status,
        headers: { 'Content-Type': 'audio/mpeg' },
      })
    }

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || 'NotebookLM API error' },
        { status: res.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `NotebookLM API unavailable: ${message}` },
      { status: 503 }
    )
  }
}

function buildPath(action: string[]): string {
  return action.join('/')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string[] }> }
) {
  const { action } = await params
  return proxyRequest('GET', buildPath(action))
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string[] }> }
) {
  const { action } = await params
  let body: unknown = undefined
  try {
    body = await request.json()
  } catch {
    // No body is fine for some POST requests
  }
  return proxyRequest('POST', buildPath(action), body)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ action: string[] }> }
) {
  const { action } = await params
  return proxyRequest('DELETE', buildPath(action))
}
