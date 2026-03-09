'use client'

import { useState, useCallback, useEffect } from 'react'
import type { SearchResult, VideoAnalysis, SearchReport, BlogSearchResult } from '@/lib/types'

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

  // NotebookLM state
  const [sendingToNotebook, setSendingToNotebook] = useState(false)

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

  const handleSendToNotebook = useCallback(async () => {
    if (results.length === 0) return
    setSendingToNotebook(true)

    const top5 = results.slice(0, 5)
    const youtubeUrls = top5.map((r) => `https://www.youtube.com/watch?v=${r.videoId}`)

    let analysisText = ''
    if (report) {
      analysisText += `[종합 분석]\n${report.overall_summary}\n\n공통 의견: ${report.consensus}\n\n`
      if (report.key_arguments.length > 0) {
        analysisText += `주요 근거:\n${report.key_arguments.map((a) => `- ${a}`).join('\n')}\n\n`
      }
    }
    const analyzedVideos = top5.filter((r) => analyses[r.videoId])
    for (const v of analyzedVideos) {
      const a = analyses[v.videoId]
      if (a?.summary) {
        analysisText += `[${v.title}]\n${a.summary}\n\n`
      }
    }

    try {
      const nbCookies = localStorage.getItem('moneytech_nb_cookies') || ''
      if (!nbCookies) {
        window.location.href = '/notebook'
        return
      }
      const res = await fetch('/api/notebook/notebooks/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-nb-cookies': nbCookies,
        },
        body: JSON.stringify({
          keyword,
          youtube_urls: youtubeUrls,
          analysis_text: analysisText,
        }),
      })
      const data = await res.json()
      if (res.ok && data.id) {
        window.location.href = `/notebook?id=${data.id}`
      }
    } catch {
      // silent
    } finally {
      setSendingToNotebook(false)
    }
  }, [results, keyword, report, analyses])

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
                  <button
                    onClick={handleSendToNotebook}
                    disabled={sendingToNotebook}
                    className="flex items-center gap-1.5 px-4 py-2 bg-th-tertiary border border-[#7c6cf0]/30 text-[#7c6cf0] text-sm font-medium rounded-lg hover:bg-th-tertiary/80 transition-colors disabled:opacity-40"
                  >
                    {sendingToNotebook ? (
                      <span className="flex items-center gap-2">
                        <Spinner /> 전송 중...
                      </span>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                        NotebookLM 리서치
                      </>
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

function BlogCard({ item }: { item: BlogSearchResult }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="card block p-4 hover:border-[#03c75a]/30 transition-colors"
    >
      <div className="flex gap-4">
        {/* Blog Icon */}
        <div className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center border border-[#03c75a]/20" style={{ background: 'color-mix(in srgb, #03c75a 8%, var(--th-bg-card))' }}>
          <span className="text-lg font-bold text-[#03c75a]">B</span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-th-primary line-clamp-1 leading-snug">
            {item.title}
          </h3>
          <p className="text-xs text-th-dim mt-1 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-th-dim">
            <span className="text-[#03c75a] font-medium">{item.bloggerName}</span>
            <span>{item.postDate}</span>
          </div>
        </div>
      </div>
    </a>
  )
}

function VideoCard({
  result,
  analysis,
  isAnalyzing,
  isExpanded,
  onAnalyze,
}: {
  result: SearchResult
  analysis?: VideoAnalysis
  isAnalyzing: boolean
  isExpanded: boolean
  onAnalyze: () => void
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex gap-4 p-4">
        <a
          href={`https://www.youtube.com/watch?v=${result.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0"
        >
          <div className="relative w-[200px] aspect-video rounded-lg overflow-hidden bg-th-secondary">
            <img
              src={result.thumbnailUrl}
              alt={result.title}
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-1 right-1 bg-black/80 text-th-primary text-[10px] px-1.5 py-0.5 rounded">
              {formatDuration(result.duration)}
            </span>
          </div>
        </a>

        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium text-th-primary line-clamp-2 leading-snug">
              {result.title}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-th-muted">{result.channelTitle}</span>
              {result.isRegisteredChannel && (
                <a
                  href={`/channels/${result.registeredChannelId}`}
                  className="text-[10px] px-1.5 py-0.5 bg-th-accent/10 text-th-accent rounded-full border border-th-accent/20"
                >
                  등록 채널
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3 text-xs text-th-dim">
              <span>조회수 {formatCount(result.viewCount)}</span>
              <span>{formatDate(result.publishedAt)}</span>
            </div>
            <button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                analysis
                  ? 'bg-th-accent/10 text-th-accent border border-th-accent/20'
                  : 'bg-th-tertiary text-th-muted hover:text-th-primary border border-th-border'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <Spinner /> 분석 중...
                </>
              ) : analysis ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points={isExpanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                  </svg>
                  분석 결과
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a4 4 0 0 0-4 4c0 2 2 3 2 6H14c0-3 2-4 2-6a4 4 0 0 0-4-4Z" />
                    <path d="M10 18h4" /><path d="M10 22h4" />
                  </svg>
                  AI 분석
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {isExpanded && analysis && <AnalysisPanel analysis={analysis} />}
    </div>
  )
}

function AnalysisPanel({ analysis }: { analysis: VideoAnalysis }) {
  return (
    <div className="border-t border-th-border bg-th-card-deep p-4 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-xs font-semibold text-th-muted uppercase tracking-wider">요약</h4>
          <SentimentBadge sentiment={analysis.sentiment} />
        </div>
        <p className="text-sm text-th-primary leading-relaxed whitespace-pre-line">
          {analysis.summary}
        </p>
      </div>

      {analysis.key_points.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-th-muted uppercase tracking-wider mb-2">핵심 포인트</h4>
          <ul className="space-y-1">
            {analysis.key_points.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-th-primary">
                <span className="text-th-accent mt-0.5">-</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.mentioned_assets.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-th-muted uppercase tracking-wider mb-2">언급 종목</h4>
          <div className="flex flex-wrap gap-2">
            {analysis.mentioned_assets.map((asset, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${
                  asset.sentiment === 'positive'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : asset.sentiment === 'negative'
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-th-tertiary text-th-muted border-th-border'
                }`}
              >
                {asset.name}
                {asset.code && (
                  <span className="opacity-60">({asset.code})</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {analysis.predictions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-th-muted uppercase tracking-wider mb-2">예측</h4>
          <div className="space-y-2">
            {analysis.predictions.map((pred, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-2.5 bg-th-secondary rounded-lg border border-th-border"
              >
                <span
                  className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    pred.type === 'buy'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : pred.type === 'sell'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {pred.type === 'buy' ? '매수' : pred.type === 'sell' ? '매도' : '보유'}
                </span>
                <div>
                  <span className="text-sm font-medium text-th-primary">{pred.asset}</span>
                  <p className="text-xs text-th-muted mt-0.5">{pred.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ReportCard({ report }: { report: SearchReport }) {
  const total =
    report.sentiment_distribution.positive +
    report.sentiment_distribution.negative +
    report.sentiment_distribution.neutral

  return (
    <div className="card p-5 border-th-accent/20 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-th-accent/10 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--th-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-th-accent">종합 분석 리포트</h3>
      </div>

      <p className="text-sm text-th-primary leading-relaxed">{report.overall_summary}</p>

      {report.consensus && (
        <div className="p-3 bg-th-secondary rounded-lg border border-th-border">
          <h4 className="text-xs font-semibold text-th-muted mb-1">공통 의견</h4>
          <p className="text-sm text-th-primary">{report.consensus}</p>
        </div>
      )}

      {total > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-th-muted mb-2">감성 분포</h4>
          <div className="flex h-3 rounded-full overflow-hidden bg-th-secondary">
            {report.sentiment_distribution.positive > 0 && (
              <div
                className="bg-emerald-500 transition-all"
                style={{ width: `${(report.sentiment_distribution.positive / total) * 100}%` }}
              />
            )}
            {report.sentiment_distribution.neutral > 0 && (
              <div
                className="bg-yellow-500 transition-all"
                style={{ width: `${(report.sentiment_distribution.neutral / total) * 100}%` }}
              />
            )}
            {report.sentiment_distribution.negative > 0 && (
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${(report.sentiment_distribution.negative / total) * 100}%` }}
              />
            )}
          </div>
          <div className="flex gap-4 mt-1.5 text-xs">
            <span className="text-emerald-400">긍정 {report.sentiment_distribution.positive}</span>
            <span className="text-yellow-400">중립 {report.sentiment_distribution.neutral}</span>
            <span className="text-red-400">부정 {report.sentiment_distribution.negative}</span>
          </div>
        </div>
      )}

      {report.key_arguments.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-th-muted mb-2">주요 근거</h4>
          <ul className="space-y-1">
            {report.key_arguments.map((arg, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-th-primary">
                <span className="text-th-accent mt-0.5">-</span>
                {arg}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.conflicts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-th-muted mb-2">의견 충돌</h4>
          <ul className="space-y-1">
            {report.conflicts.map((conflict, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-th-primary">
                <span className="text-red-400 mt-0.5">!</span>
                {conflict}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  const config = {
    positive: { label: '긍정', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    negative: { label: '부정', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
    neutral: { label: '중립', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  }
  const c = config[sentiment as keyof typeof config] || config.neutral
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${c.className}`}>
      {c.label}
    </span>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}만`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}천`
  return String(count)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '어제'
  if (diffDays < 7) return `${diffDays}일 전`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`
  return `${Math.floor(diffDays / 365)}년 전`
}
