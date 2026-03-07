import { getChannels, getRecentVideos, getDailyStats, getTotalVideoCount } from "@/lib/queries"
import type { Channel, VideoWithChannel, DailyStat } from "@/lib/types"
import { CATEGORY_LABELS } from "@/lib/types"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { ChannelRanking } from "@/components/dashboard/channel-ranking"
import { VideoFeed } from "@/components/dashboard/video-feed"
import { KeywordCloud } from "@/components/dashboard/keyword-cloud"
import { CategoryBarChart } from "@/components/charts/category-bar-chart"
import { TrendLineChart } from "@/components/charts/trend-line-chart"

export const dynamic = "force-dynamic"

async function getDashboardData() {
  try {
    const [channels, videos, stats, totalVideos] = await Promise.all([
      getChannels(),
      getRecentVideos(15),
      getDailyStats(30),
      getTotalVideoCount(),
    ])

    const today = new Date().toISOString().split("T")[0]
    const todayStats = stats.filter((s) => new Date(s.date).toISOString().split("T")[0] === today)
    const todayVideos = todayStats.reduce((sum, s) => sum + (s.total_videos ?? 0), 0)

    const last7 = stats.filter(
      (s) => new Date(s.date) >= new Date(Date.now() - 7 * 86400000)
    )
    const catCounts: Record<string, number> = {}
    for (const s of last7) {
      catCounts[s.category] = (catCounts[s.category] ?? 0) + (s.total_videos ?? 0)
    }
    const topCatEntry = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]
    const topCategory = topCatEntry
      ? CATEGORY_LABELS[topCatEntry[0]] ?? topCatEntry[0]
      : "-"

    const categoryData = Object.entries(catCounts).map(([category, count]) => ({
      category,
      count,
    }))

    const keywordMap = new Map<string, number>()
    for (const stat of last7) {
      if (stat.top_keywords) {
        for (const kw of stat.top_keywords) {
          keywordMap.set(kw.keyword, (keywordMap.get(kw.keyword) ?? 0) + kw.count)
        }
      }
    }
    const topKeywords = Array.from(keywordMap.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 40)

    return { channels, videos, stats, totalVideos, todayVideos, topCategory, categoryData, topKeywords }
  } catch {
    return {
      channels: [] as Channel[],
      videos: [] as VideoWithChannel[],
      stats: [] as DailyStat[],
      totalVideos: 0,
      todayVideos: 0,
      topCategory: "-",
      categoryData: [],
      topKeywords: [],
    }
  }
}

export default async function DashboardPage() {
  const { channels, videos, stats, totalVideos, todayVideos, topCategory, categoryData, topKeywords } =
    await getDashboardData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground">재테크 유튜브 채널 분석 현황</p>
      </div>

      <StatsCards
        totalChannels={channels.length}
        totalVideos={totalVideos}
        todayVideos={todayVideos}
        topCategory={topCategory}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryBarChart data={categoryData} />
        <TrendLineChart stats={stats} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VideoFeed videos={videos} />
        </div>
        <KeywordCloud keywords={topKeywords} />
      </div>

      <ChannelRanking channels={channels.slice(0, 10)} />
    </div>
  )
}
