import { NextRequest, NextResponse } from 'next/server'
import type { NewsItem } from '@/lib/research-types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('keyword')?.trim()
  const maxResults = Math.min(Number(searchParams.get('maxResults') || 10), 20)

  if (!keyword) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 })
  }

  try {
    const items: NewsItem[] = []

    // Google News RSS (no API key needed)
    const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ko&gl=KR&ceid=KR:ko`
    const rssRes = await fetch(googleNewsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })

    if (rssRes.ok) {
      const xml = await rssRes.text()
      const parsed = parseRssItems(xml, maxResults)
      items.push(...parsed)
    }

    return NextResponse.json({ items, keyword })
  } catch (error) {
    console.error('News search error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch news', items: [] },
      { status: 500 }
    )
  }
}

function parseRssItems(xml: string, maxResults: number): NewsItem[] {
  const items: NewsItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null && items.length < maxResults) {
    const itemXml = match[1]
    const title = extractTag(itemXml, 'title')
    const link = extractTag(itemXml, 'link')
    const pubDate = extractTag(itemXml, 'pubDate')
    const source = extractTag(itemXml, 'source')
    const description = extractTag(itemXml, 'description')

    if (title && link) {
      items.push({
        title: decodeHtmlEntities(title),
        link,
        source: source || 'Unknown',
        publishedAt: pubDate || new Date().toISOString(),
        snippet: decodeHtmlEntities(stripHtml(description || '')).slice(0, 200),
      })
    }
  }

  return items
}

function extractTag(xml: string, tag: string): string {
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`))
  if (cdataMatch) return cdataMatch[1].trim()

  const simpleMatch = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
  if (simpleMatch) return simpleMatch[1].trim()

  return ''
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}
