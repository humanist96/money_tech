// Research types for NotebookLM integration

export type SourceType = 'youtube' | 'news' | 'db_insight' | 'ai_report'

export interface ResearchSource {
  type: SourceType
  title: string
  url?: string
  content?: string
  status: 'pending' | 'collecting' | 'injecting' | 'done' | 'error'
  errorMessage?: string
}

export interface ResearchConfig {
  keyword: string
  sources: {
    youtube: boolean
    news: boolean
    dbInsight: boolean
    aiReport: boolean
  }
  youtubeCount: number
  newsCount: number
}

export type ResearchPhase =
  | 'idle'
  | 'collecting'
  | 'injecting'
  | 'waiting'
  | 'ready'
  | 'error'

export interface ResearchProgress {
  phase: ResearchPhase
  notebookId: string | null
  totalSteps: number
  completedSteps: number
  currentAction: string
  sources: ResearchSource[]
}

export interface NewsItem {
  title: string
  link: string
  source: string
  publishedAt: string
  snippet: string
}

export interface DbInsight {
  keyword: string
  channelMentions: Array<{
    channelName: string
    category: string
    videoCount: number
    sentiment: string
  }>
  assetMentions: Array<{
    assetName: string
    assetCode: string | null
    mentionCount: number
    positivePct: number
    negativePct: number
  }>
  summary: string
}

export interface ArtifactItem {
  id: string
  type: 'audio' | 'report' | 'study_guide' | 'quiz' | 'infographic' | 'slide_deck'
  label: string
  status: 'idle' | 'generating' | 'completed' | 'error'
  errorMessage?: string
}

export interface SavedNotebook {
  id: string
  title: string
  keyword: string
  sourceCount: number
  createdAt: string
}

export const ARTIFACT_CONFIGS: Array<{
  type: ArtifactItem['type']
  action: string
  label: string
  icon: string
  desc: string
  extraData?: Record<string, unknown>
}> = [
  { type: 'audio', action: 'generateAudio', label: '오디오 브리핑', icon: 'audio', desc: 'AI 팟캐스트 생성', extraData: { format: 'deep-dive' } },
  { type: 'report', action: 'generateReport', label: '브리핑 문서', icon: 'report', desc: '핵심 인사이트 정리', extraData: { reportType: 'briefing' } },
  { type: 'study_guide', action: 'generateReport', label: '스터디 가이드', icon: 'study', desc: '학습 자료 생성', extraData: { reportType: 'study_guide' } },
  { type: 'quiz', action: 'generateQuiz', label: '퀴즈', icon: 'quiz', desc: '투자 지식 테스트' },
]

export const SAVED_NOTEBOOKS_KEY = 'moneytech_saved_notebooks'
