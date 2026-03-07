"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"
import type { DailyStat } from "@/lib/types"

interface TrendLineChartProps {
  stats: DailyStat[]
  title?: string
}

export function TrendLineChart({
  stats,
  title = "업로드 빈도 추이",
}: TrendLineChartProps) {
  const dateMap = new Map<string, Record<string, number>>()

  for (const stat of stats) {
    const dateKey = new Date(stat.date).toISOString().split("T")[0]
    const existing = dateMap.get(dateKey) ?? {}
    dateMap.set(dateKey, {
      ...existing,
      [stat.category]: stat.total_videos ?? 0,
    })
  }

  const chartData = Array.from(dateMap.entries())
    .map(([date, categories]) => ({
      date: date.slice(5), // MM-DD
      ...categories,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const categories = ["stock", "coin", "real_estate", "economy"]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {categories.map((cat) => (
                <Line
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  name={CATEGORY_LABELS[cat]}
                  stroke={CATEGORY_COLORS[cat]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            데이터를 수집 중입니다...
          </p>
        )}
      </CardContent>
    </Card>
  )
}
