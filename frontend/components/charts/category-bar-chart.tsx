"use client"

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/types"

interface CategoryBarChartProps {
  data: { category: string; count: number }[]
  title?: string
}

export function CategoryBarChart({
  data,
  title = "카테고리별 영상 수",
}: CategoryBarChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    name: CATEGORY_LABELS[item.category] ?? item.category,
    fill: CATEGORY_COLORS[item.category] ?? "#6b7280",
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" name="영상 수" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
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
