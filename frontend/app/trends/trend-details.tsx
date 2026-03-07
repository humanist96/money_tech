"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { DailyStat } from "@/lib/types"
import { CATEGORY_LABELS } from "@/lib/types"

interface TrendDetailsProps {
  stats: DailyStat[]
}

export function TrendDetails({ stats }: TrendDetailsProps) {
  const categories = ["stock", "coin", "real_estate", "economy"]

  // Group stats by category, get latest day's top channels and keywords
  const categoryDetails = categories.map((cat) => {
    const catStats = stats.filter((s) => s.category === cat)
    const latest = catStats[catStats.length - 1]
    return {
      category: cat,
      label: CATEGORY_LABELS[cat],
      topChannels: latest?.top_channels ?? [],
      topKeywords: latest?.top_keywords ?? [],
      totalVideos: catStats.reduce((sum, s) => sum + (s.total_videos ?? 0), 0),
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>카테고리별 상세</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="stock">
          <TabsList>
            {categoryDetails.map((cd) => (
              <TabsTrigger key={cd.category} value={cd.category}>
                {cd.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {categoryDetails.map((cd) => (
            <TabsContent key={cd.category} value={cd.category}>
              <div className="grid gap-6 md:grid-cols-2 mt-4">
                <div>
                  <h4 className="font-semibold mb-3">활발한 채널</h4>
                  {cd.topChannels.length > 0 ? (
                    <div className="space-y-2">
                      {cd.topChannels.slice(0, 5).map((ch, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm border rounded-md p-2"
                        >
                          <span className="font-medium">
                            {i + 1}. {ch.channel_name}
                          </span>
                          <span className="text-muted-foreground">
                            {ch.video_count}개 영상
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      데이터를 수집 중입니다.
                    </p>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold mb-3">주요 키워드</h4>
                  {cd.topKeywords.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {cd.topKeywords.slice(0, 15).map((kw, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm"
                        >
                          {kw.keyword}
                          <span className="ml-1 text-muted-foreground text-xs">
                            ({kw.count})
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      데이터를 수집 중입니다.
                    </p>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-4">
                최근 30일 총 {cd.totalVideos}개 영상 수집됨
              </p>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
