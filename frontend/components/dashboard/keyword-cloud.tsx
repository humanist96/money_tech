"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { KeywordEntry } from "@/lib/types"

interface KeywordCloudProps {
  keywords: KeywordEntry[]
  title?: string
}

export function KeywordCloud({ keywords, title = "인기 키워드" }: KeywordCloudProps) {
  if (keywords.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            데이터를 수집 중입니다...
          </p>
        </CardContent>
      </Card>
    )
  }

  const maxCount = Math.max(...keywords.map((k) => k.count))
  const minCount = Math.min(...keywords.map((k) => k.count))

  function getFontSize(count: number): number {
    if (maxCount === minCount) return 16
    const ratio = (count - minCount) / (maxCount - minCount)
    return 12 + ratio * 24
  }

  function getOpacity(count: number): number {
    if (maxCount === minCount) return 1
    const ratio = (count - minCount) / (maxCount - minCount)
    return 0.4 + ratio * 0.6
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 justify-center py-4">
          {keywords.map((kw) => (
            <span
              key={kw.keyword}
              className="inline-block px-2 py-1 rounded-md bg-primary/10 text-primary font-medium cursor-default transition-transform hover:scale-110"
              style={{
                fontSize: `${getFontSize(kw.count)}px`,
                opacity: getOpacity(kw.count),
              }}
              title={`${kw.keyword}: ${kw.count}회`}
            >
              {kw.keyword}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
