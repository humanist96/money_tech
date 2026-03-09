import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// GET /api/predictions?channelId=xxx  → prediction details for a channel
// GET /api/predictions?assetName=xxx  → per-channel references for an asset
export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get('channelId')
  const assetName = req.nextUrl.searchParams.get('assetName')
  const sql = getDb()

  if (channelId) {
    const rows = await sql`
      SELECT
        p.id,
        p.prediction_type,
        p.reason,
        p.predicted_at,
        p.is_accurate,
        p.target_price,
        COALESCE(ma.asset_name, '(미지정)') AS asset_name,
        ma.asset_code,
        ma.sentiment,
        ma.context_text,
        ma.price_at_mention,
        v.title AS video_title,
        v.youtube_video_id,
        v.published_at AS video_published_at,
        v.thumbnail_url AS video_thumbnail
      FROM predictions p
      JOIN videos v ON p.video_id = v.id
      LEFT JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
      WHERE p.channel_id = ${channelId}
      ORDER BY p.predicted_at DESC NULLS LAST
      LIMIT 30
    `
    return NextResponse.json(rows)
  }

  if (assetName) {
    const rows = await sql`
      SELECT
        c.name AS channel_name,
        c.id AS channel_id,
        c.thumbnail_url AS channel_thumbnail,
        c.channel_type,
        ma.sentiment,
        ma.context_text,
        p.prediction_type,
        p.reason,
        p.is_accurate,
        v.title AS video_title,
        v.youtube_video_id,
        v.published_at,
        v.thumbnail_url AS video_thumbnail
      FROM mentioned_assets ma
      JOIN videos v ON ma.video_id = v.id
      JOIN channels c ON v.channel_id = c.id
      LEFT JOIN predictions p ON p.video_id = v.id AND p.mentioned_asset_id = ma.id
      WHERE ma.asset_name = ${assetName}
        AND ma.sentiment IS NOT NULL
      ORDER BY v.published_at DESC
      LIMIT 30
    `
    return NextResponse.json(rows)
  }

  return NextResponse.json({ error: 'channelId or assetName required' }, { status: 400 })
}
