import { getDailyStats } from "@/lib/queries"
import type { DailyStat } from "@/lib/types"
import { KeywordCloud } from "@/components/dashboard/keyword-cloud"
import { TrendLineChart } from "@/components/charts/trend-line-chart"
import { CategoryBarChart } from "@/components/charts/category-bar-chart"
import { TrendDetails } from "./trend-details"

export const dynamic = "force-dynamic"

async function getTrendData() {
  try {
    const stats = await getDailyStats(30)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
    const recentStats = stats.filter((s) => new Date(s.date) >= sevenDaysAgo)

    const keywordMap = new Map<string, number>()
    for (const stat of recentStats) {
      if (stat.top_keywords) {
        for (const kw of stat.top_keywords) {
          keywordMap.set(kw.keyword, (keywordMap.get(kw.keyword) ?? 0) + kw.count)
        }
      }
    }
    const topKeywords = Array.from(keywordMap.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)

    const catCounts: Record<string, number> = {}
    for (const s of recentStats) {
      catCounts[s.category] = (catCounts[s.category] ?? 0) + (s.total_videos ?? 0)
    }
    const categoryData = Object.entries(catCounts).map(([category, count]) => ({ category, count }))

    return { stats, topKeywords, categoryData }
  } catch {
    return { stats: [] as DailyStat[], topKeywords: [], categoryData: [] }
  }
}

export default async function TrendsPage() {
  const { stats, topKeywords, categoryData } = await getTrendData()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-white glow-text" style={{ fontFamily: 'var(--font-outfit)' }}>
          트렌드
        </h1>
        <p className="text-[#64748b] mt-1.5 text-sm">재테크 유튜브 키워드 및 업로드 트렌드</p>
      </div>

      <KeywordCloud keywords={topKeywords} title="최근 7일 인기 키워드" />

      <div className="grid gap-6 lg:grid-cols-2">
        <TrendLineChart stats={stats} title="30일 업로드 추이" />
        <CategoryBarChart data={categoryData} title="최근 7일 카테고리별 영상" />
      </div>

      <TrendDetails stats={stats} />
    </div>
  )
}
