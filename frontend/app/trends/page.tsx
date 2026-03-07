import { supabase } from "@/lib/supabase"
import type { DailyStat } from "@/lib/types"
import { KeywordCloud } from "@/components/dashboard/keyword-cloud"
import { TrendLineChart } from "@/components/charts/trend-line-chart"
import { CategoryBarChart } from "@/components/charts/category-bar-chart"
import { TrendDetails } from "./trend-details"

export const dynamic = "force-dynamic"
export const revalidate = 3600

async function getTrendData() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .split("T")[0]

    const { data } = await supabase
      .from("daily_stats")
      .select("*")
      .gte("date", thirtyDaysAgo)
      .order("date", { ascending: true })

    const stats = (data ?? []) as DailyStat[]

  // Aggregate keywords from last 7 days
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

  // Category totals for last 7 days
  const catCounts: Record<string, number> = {}
  for (const s of recentStats) {
    catCounts[s.category] = (catCounts[s.category] ?? 0) + (s.total_videos ?? 0)
  }
  const categoryData = Object.entries(catCounts).map(([category, count]) => ({
    category,
    count,
  }))

  return { stats, topKeywords, categoryData }
  } catch {
    return { stats: [] as DailyStat[], topKeywords: [], categoryData: [] }
  }
}

export default async function TrendsPage() {
  const { stats, topKeywords, categoryData } = await getTrendData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">트렌드</h1>
        <p className="text-muted-foreground">
          재테크 유튜브 키워드 및 업로드 트렌드
        </p>
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
