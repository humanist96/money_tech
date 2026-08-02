'use client'

import { useState, useCallback, useEffect } from 'react'
import type { SearchResult, VideoAnalysis, SearchReport, BlogSearchResult } from '@/lib/types'
import { BlogCard, VideoCard, ReportCard, Spinner } from './search-results'

const RECENT_SEARCHES_KEY = 'moneytech_recent_searches'
const MAX_RECENT = 10

type SearchTab = 'youtube' | 'blog'

export default function SearchClient() {
  const [keyword, setKeyword] = useState('')
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance')
  const [activeTab, setActiveTab] = useState<SearchTab>('youtube')
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // YouTube state
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Blog state
  const [blogResults, setBlogResults] = useState<BlogSearchResult[]>([])
  const [blogSearching, setBlogSearching] = useState(false)
  const [blogError, setBlogError] = useState('')
  const [blogTotal, setBlogTotal] = useState(0)

  // Analysis state
  const [analyses, setAnalyses] = useState<Record<string, VideoAnalysis>>({})
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Report state
  const [report, setReport] = useState<SearchReport | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)


  // Track if search was performed
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY)
      if (saved) setRecentSearches(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  const saveRecentSearch = useCallback((term: string) => {
    setRecentSearches((prev) => {
      const updated = [term, ...prev.filter((s) => s !== term)].slice(0, MAX_RECENT)
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const searchYouTube = useCallback(async (term: string) => {
    setSearching(true)
    setSearchError('')
    setResults([])
    setReport(null)
    setAnalyses({})
    setExpandedIds(new Set())

    try {
      const params = new URLSearchParams({ keyword: term, sortBy })
      const res = await fetch(`/api/search/youtube?${params}`)
      const data = await res.json()

      if (!res.ok) {
        setSearchError(data.error || 'Search failed')
        return
      }

      setResults(data.results)
    } catch {
      setSearchError('Network error')
    } finally {
      setSearching(false)
    }
  }, [sortBy])

  const searchBlog = useCallback(async (term: string) => {
    setBlogSearching(true)
    setBlogError('')
    setBlogResults([])
    setBlogTotal(0)

    try {
      const naverSort = sortBy === 'date' ? 'date' : 'sim'
      const params = new URLSearchParams({ keyword: term, sortBy: naverSort })
      const res = await fetch(`/api/search/blog?${params}`)
      const data = await res.json()

      if (!res.ok) {
        setBlogError(data.error || 'Blog search failed')
        return
      }

      setBlogResults(data.results)
      setBlogTotal(data.total ?? 0)
    } catch {
      setBlogError('Network error')
    } finally {
      setBlogSearching(false)
    }
  }, [sortBy])

  const handleSearch = useCallback(async (searchKeyword?: string) => {
    const term = searchKeyword || keyword
    if (!term.trim()) return

    setHasSearched(true)
    saveRecentSearch(term)

    // Search both in parallel
    await Promise.all([
      searchYouTube(term),
      searchBlog(term),
    ])
  }, [keyword, saveRecentSearch, searchYouTube, searchBlog])

  const handleAnalyze = useCallback(async (videoId: string) => {
    if (analyses[videoId]) {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        if (next.has(videoId)) next.delete(videoId)
        else next.add(videoId)
        return next
      })
      return
    }

    setAnalyzingIds((prev) => new Set(prev).add(videoId))
    setExpandedIds((prev) => new Set(prev).add(videoId))

    try {
      const res = await fetch('/api/search/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      const data = await res.json()

      if (res.ok && data.analysis) {
        setAnalyses((prev) => ({ ...prev, [videoId]: data.analysis }))
      }
    } catch {
      // silently fail
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev)
        next.delete(videoId)
        return next
      })
    }
  }, [analyses])

  const handleReport = useCallback(async () => {
    const top5 = results.slice(0, 5)
    if (top5.length === 0) return

    setGeneratingReport(true)

    const unanalyzed = top5.filter((r) => !analyses[r.videoId])
    await Promise.all(
      unanalyzed.map(async (r) => {
        try {
          const res = await fetch('/api/search/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId: r.videoId }),
          })
          const data = await res.json()
          if (res.ok && data.analysis) {
            setAnalyses((prev) => ({ ...prev, [r.videoId]: data.analysis }))
          }
        } catch { /* ignore */ }
      })
    )

    try {
      const res = await fetch('/api/search/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds: top5.map((r) => r.videoId) }),
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      const data = await res.json()
      if (res.ok && data.report) {
        setReport(data.report)
      }
    } catch {
      // silently fail
    } finally {
      setGeneratingReport(false)
    }
  }, [results, analyses])

  const isSearching = searching || blogSearching

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="card p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSearch()
          }}
          className="flex gap-3"
        >
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-th-dim"
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="종목명, 이슈 키워드 검색 (예: 삼성전자, 비트코인, 금리)"
              className="w-full bg-th-secondary border border-th-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-th-primary placeholder:text-th-dim focus:outline-none focus:border-th-accent/50 transition-colors"
            />
          </div>

          {/* Sort Toggle */}
          <div className="flex items-center gap-1 bg-th-secondary border border-th-border rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setSortBy('relevance')}
              className={`px-3 py-2 text-xs rounded-md transition-colors ${
                sortBy === 'relevance'
                  ? 'bg-th-tertiary text-th-accent'
                  : 'text-th-dim hover:text-th-primary'
              }`}
            >
              정확도
            </button>
            <button
              type="button"
              onClick={() => setSortBy('date')}
              className={`px-3 py-2 text-xs rounded-md transition-colors ${
                sortBy === 'date'
                  ? 'bg-th-tertiary text-th-accent'
                  : 'text-th-dim hover:text-th-primary'
              }`}
            >
              최신순
            </button>
          </div>

          <button
            type="submit"
            disabled={isSearching || !keyword.trim()}
            className="btn-accent px-5 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSearching ? '검색 중...' : '검색'}
          </button>
        </form>

        {/* Recent Searches */}
        {recentSearches.length > 0 && !hasSearched && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-th-dim">최근:</span>
            {recentSearches.map((term) => (
              <button
                key={term}
                onClick={() => {
                  setKeyword(term)
                  handleSearch(term)
                }}
                className="text-xs px-2.5 py-1 bg-th-secondary border border-th-border rounded-full text-th-muted hover:text-th-primary hover:border-th-accent/30 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      {hasSearched && (
        <div className="flex items-center gap-1 border-b border-th-border">
          <TabButton
            active={activeTab === 'youtube'}
            onClick={() => setActiveTab('youtube')}
            loading={searching}
            count={results.length}
            icon={<span className="text-red-400">▶</span>}
            label="YouTube"
          />
          <TabButton
            active={activeTab === 'blog'}
            onClick={() => setActiveTab('blog')}
            loading={blogSearching}
            count={blogResults.length}
            icon={<span className="text-[#03c75a]">✎</span>}
            label="네이버 블로그"
          />
        </div>
      )}

      {/* YouTube Tab */}
      {hasSearched && activeTab === 'youtube' && (
        <>
          {searchError && (
            <div className="card p-4 border-red-500/30 text-red-400 text-sm">
              {searchError}
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-th-muted">{results.length}개 결과</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReport}
                    disabled={generatingReport}
                    className="px-4 py-2 bg-th-tertiary border border-th-accent/30 text-th-accent text-sm font-medium rounded-lg hover:bg-th-tertiary/80 transition-colors disabled:opacity-40"
                  >
                    {generatingReport ? (
                      <span className="flex items-center gap-2">
                        <Spinner /> 종합 분석 중...
                      </span>
                    ) : (
                      'Top 5 종합 분석'
                    )}
                  </button>
                </div>
              </div>

              {report && <ReportCard report={report} />}

              <div className="space-y-3">
                {results.map((result) => (
                  <VideoCard
                    key={result.videoId}
                    result={result}
                    analysis={analyses[result.videoId]}
                    isAnalyzing={analyzingIds.has(result.videoId)}
                    isExpanded={expandedIds.has(result.videoId)}
                    onAnalyze={() => handleAnalyze(result.videoId)}
                  />
                ))}
              </div>
            </>
          )}

          {!searching && results.length === 0 && !searchError && (
            <div className="card p-12 text-center">
              <p className="text-th-dim text-sm">YouTube 검색 결과가 없습니다</p>
            </div>
          )}
        </>
      )}

      {/* Blog Tab */}
      {hasSearched && activeTab === 'blog' && (
        <>
          {blogError && (
            <div className="card p-4 border-red-500/30 text-red-400 text-sm">
              {blogError}
            </div>
          )}

          {blogResults.length > 0 && (
            <>
              <p className="text-sm text-th-muted">
                {blogResults.length}개 결과
                {blogTotal > blogResults.length && (
                  <span className="text-th-dim"> (전체 {blogTotal.toLocaleString()}건)</span>
                )}
              </p>
              <div className="space-y-3">
                {blogResults.map((item, i) => (
                  <BlogCard key={`${item.link}-${i}`} item={item} />
                ))}
              </div>
            </>
          )}

          {!blogSearching && blogResults.length === 0 && !blogError && (
            <div className="card p-12 text-center">
              <p className="text-th-dim text-sm">블로그 검색 결과가 없습니다</p>
            </div>
          )}
        </>
      )}

      {/* Initial Empty State */}
      {!hasSearched && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-th-secondary flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--th-text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <p className="text-th-dim text-sm">
            투자 키워드를 검색하여 YouTube 영상과 네이버 블로그를 AI로 분석하세요
          </p>
        </div>
      )}
    </div>
  )
}

// --- Sub-components ---

function TabButton({ active, onClick, loading, count, icon, label }: {
  active: boolean
  onClick: () => void
  loading: boolean
  count: number
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-th-accent text-th-accent'
          : 'border-transparent text-th-dim hover:text-th-muted'
      }`}
    >
      {icon}
      {label}
      {loading ? (
        <Spinner />
      ) : (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
          active ? 'bg-th-accent/10 text-th-accent' : 'bg-th-secondary text-th-dim'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

