import { NextRequest, NextResponse } from 'next/server'

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET
const NAVER_BLOG_API = 'https://openapi.naver.com/v1/search/blog.json'

interface NaverBlogItem {
  title: string
  link: string
  description: string
  bloggername: string
  bloggerlink: string
  postdate: string
}

export interface BlogSearchResult {
  title: string
  link: string
  description: string
  bloggerName: string
  bloggerLink: string
  postDate: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('keyword')?.trim()
  const sortBy = searchParams.get('sortBy') === 'date' ? 'date' : 'sim'
  const display = Math.min(Number(searchParams.get('maxResults') || 10), 20)

  if (!keyword) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 })
  }

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return NextResponse.json({ error: 'Naver API credentials not configured' }, { status: 500 })
  }

  try {
    const url = new URL(NAVER_BLOG_API)
    url.searchParams.set('query', keyword)
    url.searchParams.set('sort', sortBy)
    url.searchParams.set('display', String(display))

    const res = await fetch(url.toString(), {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json(
        { error: `Naver API error: ${err}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    const items: NaverBlogItem[] = data.items || []

    const results: BlogSearchResult[] = items.map((item) => ({
      title: stripHtml(item.title),
      link: item.link,
      description: stripHtml(item.description),
      bloggerName: item.bloggername,
      bloggerLink: item.bloggerlink,
      postDate: formatPostDate(item.postdate),
    }))

    return NextResponse.json({ results, total: data.total })
  } catch (error) {
    console.error('Naver blog search error:', error)
    return NextResponse.json(
      { error: 'Failed to search Naver blogs' },
      { status: 500 }
    )
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

function formatPostDate(dateStr: string): string {
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
  }
  return dateStr
}
