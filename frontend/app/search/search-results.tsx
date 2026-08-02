'use client'

// 검색 결과 표시 컴포넌트. search-client.tsx가 800줄 규칙을 넘겨(801줄)
// 분리했다 — 상태·데이터 로딩은 본체에 남기고, 순수 표시 계층만 옮겼다.
import type { SearchResult, VideoAnalysis, SearchReport, BlogSearchResult } from '@/lib/types'
import { formatDuration, formatViewCount, timeAgo } from '@/lib/queries'

export function BlogCard({ item }: { item: BlogSearchResult }) {
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

export function VideoCard({
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
              <span>조회수 {formatViewCount(result.viewCount)}</span>
              <span>{timeAgo(result.publishedAt)}</span>
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

export function ReportCard({ report }: { report: SearchReport }) {
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

export function Spinner() {
  return (
    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
