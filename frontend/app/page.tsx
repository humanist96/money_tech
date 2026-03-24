import {
  getChannels, getRecentVideosWithAssets, getDailyStats, getTotalVideoCount,
  getAssetConsensus, getAssetMentions,
  getRecentPredictions, getTopAssetSentiments,
  getBuzzAlerts, getChannelPredictionProfiles,
  getMarketSentimentGauge, getContrarianSignals,
} from "@/lib/queries"
import type { Channel } from "@/lib/types"
import { CATEGORY_LABELS } from "@/lib/types"
import { DashboardContent } from "@/components/dashboard/dashboard-content"

export const dynamic = "force-dynamic"

async function safeQuery<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    console.error(`[Dashboard] ${name} failed:`, e instanceof Error ? e.message : e)
    return fallback
  }
}

async function getDashboardData() {
  const [channels, videos, stats, totalVideos, consensus, assetMentions, predictions, assetSentiments, buzzAlerts, predictionProfiles, marketGauge, contrarianSignals] = await Promise.all([
    safeQuery("getChannels", () => getChannels(), [] as Channel[]),
    safeQuery("getRecentVideosWithAssets", () => getRecentVideosWithAssets(15), []),
    safeQuery("getDailyStats", () => getDailyStats(30), []),
    safeQuery("getTotalVideoCount", () => getTotalVideoCount(), 0),
    safeQuery("getAssetConsensus", () => getAssetConsensus(30), []),
    safeQuery("getAssetMentions", () => getAssetMentions(30), []),
    safeQuery("getRecentPredictions", () => getRecentPredictions(20), []),
    safeQuery("getTopAssetSentiments", () => getTopAssetSentiments(10, 30), []),
    safeQuery("getBuzzAlerts", () => getBuzzAlerts(48), []),
    safeQuery("getChannelPredictionProfiles", () => getChannelPredictionProfiles(), []),
    safeQuery("getMarketSentimentGauge", () => getMarketSentimentGauge(), { overall_score: 50, category_scores: [], historical_extremes: [], current_warning: null }),
    safeQuery("getContrarianSignals", () => getContrarianSignals(30, 75), []),
  ])

  const today = new Date().toISOString().split("T")[0]
  const todayStats = (stats as any[]).filter((s) => new Date(s.date).toISOString().split("T")[0] === today)
  const todayVideos = todayStats.reduce((sum, s) => sum + (s.total_videos ?? 0), 0)

  const last7 = (stats as any[]).filter((s) => new Date(s.date) >= new Date(Date.now() - 7 * 86400000))
  const catCounts: Record<string, number> = {}
  for (const s of last7) {
    catCounts[s.category] = (catCounts[s.category] ?? 0) + (s.total_videos ?? 0)
  }
  const topCatEntry = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]
  const topCategory = topCatEntry ? CATEGORY_LABELS[topCatEntry[0]] ?? topCatEntry[0] : "-"

  return {
    channels, videos, totalVideos, todayVideos, topCategory,
    consensus, assetMentions, predictions, assetSentiments,
    buzzAlerts, predictionProfiles, marketGauge, contrarianSignals,
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <div className="space-y-8">
      <DashboardContent {...data} />
    </div>
  )
}
