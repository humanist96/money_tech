"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
}

function StatCard({ title, value, description }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

interface StatsCardsProps {
  totalChannels: number
  totalVideos: number
  todayVideos: number
  topCategory: string
}

export function StatsCards({
  totalChannels,
  totalVideos,
  todayVideos,
  topCategory,
}: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="수집 채널"
        value={totalChannels}
        description="모니터링 중인 채널"
      />
      <StatCard
        title="총 영상"
        value={totalVideos.toLocaleString()}
        description="수집된 전체 영상"
      />
      <StatCard
        title="오늘 신규"
        value={todayVideos}
        description="지난 24시간 업로드"
      />
      <StatCard
        title="가장 활발한 카테고리"
        value={topCategory}
        description="최근 7일 기준"
      />
    </div>
  )
}
