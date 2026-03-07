"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Channel } from "@/lib/types"
import { CATEGORY_LABELS } from "@/lib/types"
import { formatViewCount } from "@/lib/queries"

interface ChannelListProps {
  channels: Channel[]
}

const CATEGORIES = [
  { value: "all", label: "전체" },
  { value: "stock", label: "주식" },
  { value: "coin", label: "코인" },
  { value: "real_estate", label: "부동산" },
  { value: "economy", label: "경제" },
]

type SortKey = "subscriber_count" | "total_view_count" | "video_count"

export function ChannelList({ channels }: ChannelListProps) {
  const [category, setCategory] = useState("all")
  const [sortBy, setSortBy] = useState<SortKey>("subscriber_count")

  const filtered = channels
    .filter((ch) => category === "all" || ch.category === category)
    .sort((a, b) => ((b[sortBy] ?? 0) as number) - ((a[sortBy] ?? 0) as number))

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs value={category} onValueChange={setCategory}>
          <TabsList>
            {CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.value} value={cat.value}>
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">정렬:</span>
          {(
            [
              ["subscriber_count", "구독자"],
              ["total_view_count", "조회수"],
              ["video_count", "영상 수"],
            ] as [SortKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-2 py-1 rounded text-xs ${
                sortBy === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((channel) => (
          <Link key={channel.id} href={`/channels/${channel.id}`}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  {channel.thumbnail_url ? (
                    <img
                      src={channel.thumbnail_url}
                      alt={channel.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold">
                      {channel.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{channel.name}</h3>
                    <Badge variant="secondary" className="mt-1">
                      {CATEGORY_LABELS[channel.category]}
                    </Badge>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">구독자</p>
                    <p className="text-sm font-semibold">
                      {formatViewCount(channel.subscriber_count)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">조회수</p>
                    <p className="text-sm font-semibold">
                      {formatViewCount(channel.total_view_count)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">영상</p>
                    <p className="text-sm font-semibold">
                      {channel.video_count ?? "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          해당 카테고리에 채널이 없습니다.
        </p>
      )}
    </div>
  )
}
