"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Channel } from "@/lib/types"
import { CATEGORY_LABELS } from "@/lib/types"
import { formatViewCount } from "@/lib/queries"

interface ChannelRankingProps {
  channels: Channel[]
  title?: string
}

export function ChannelRanking({ channels, title = "채널 랭킹" }: ChannelRankingProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>채널명</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead className="text-right">구독자</TableHead>
              <TableHead className="text-right">총 조회수</TableHead>
              <TableHead className="text-right">영상 수</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.map((channel, index) => (
              <TableRow key={channel.id}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  <Link
                    href={`/channels/${channel.id}`}
                    className="font-medium hover:underline"
                  >
                    {channel.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {CATEGORY_LABELS[channel.category] ?? channel.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatViewCount(channel.subscriber_count)}
                </TableCell>
                <TableCell className="text-right">
                  {formatViewCount(channel.total_view_count)}
                </TableCell>
                <TableCell className="text-right">
                  {channel.video_count ?? "-"}
                </TableCell>
              </TableRow>
            ))}
            {channels.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  데이터를 수집 중입니다...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
