import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('ids')
  if (!ids) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 })
  }

  const channelIds = ids.split(',').filter(Boolean)
  if (channelIds.length < 2 || channelIds.length > 3) {
    return NextResponse.json({ error: 'Provide 2-3 channel IDs' }, { status: 400 })
  }

  const sql = getDb()

  const [channels, assetCoverage, uploadPatterns, predictions, topVideos, engagement, reactionSpeed, profiles] = await Promise.all([
    // Channels with video counts
    sql`
      SELECT c.*,
        (SELECT COUNT(*)::int FROM videos WHERE channel_id = c.id) as total_video_count
      FROM channels c WHERE c.id = ANY(${channelIds})
    `,

    // Asset coverage per channel
    sql`
      SELECT
        v.channel_id,
        ma.asset_name,
        ma.asset_code,
        COUNT(*)::int AS mention_count,
        MODE() WITHIN GROUP (ORDER BY ma.sentiment) AS dominant_sentiment
      FROM mentioned_assets ma
      JOIN videos v ON ma.video_id = v.id
      WHERE v.channel_id = ANY(${channelIds})
        AND ma.asset_code IS NOT NULL
      GROUP BY v.channel_id, ma.asset_name, ma.asset_code
      ORDER BY mention_count DESC
    `,

    // Upload patterns (day of week + hour)
    sql`
      SELECT
        v.channel_id,
        EXTRACT(DOW FROM v.published_at)::int AS day_of_week,
        EXTRACT(HOUR FROM v.published_at)::int AS hour,
        COUNT(*)::int AS count
      FROM videos v
      WHERE v.channel_id = ANY(${channelIds})
        AND v.published_at IS NOT NULL
      GROUP BY v.channel_id, EXTRACT(DOW FROM v.published_at), EXTRACT(HOUR FROM v.published_at)
    `,

    // Prediction distribution per channel
    sql`
      SELECT
        p.channel_id,
        p.prediction_type,
        COUNT(*)::int AS count
      FROM predictions p
      WHERE p.channel_id = ANY(${channelIds})
      GROUP BY p.channel_id, p.prediction_type
    `,

    // Top 5 videos per channel by view count
    sql`
      SELECT DISTINCT ON (ranked.channel_id, ranked.rn)
        ranked.channel_id, ranked.title, ranked.youtube_video_id,
        ranked.view_count, ranked.like_count, ranked.comment_count,
        ranked.published_at
      FROM (
        SELECT v.*,
          ROW_NUMBER() OVER (PARTITION BY v.channel_id ORDER BY v.view_count DESC NULLS LAST) AS rn
        FROM videos v
        WHERE v.channel_id = ANY(${channelIds})
      ) ranked
      WHERE ranked.rn <= 5
      ORDER BY ranked.channel_id, ranked.rn
    `,

    // Engagement metrics per channel
    sql`
      SELECT
        v.channel_id,
        AVG(v.view_count)::int AS avg_views,
        AVG(v.like_count)::int AS avg_likes,
        AVG(v.comment_count)::int AS avg_comments,
        COUNT(*)::int AS total_videos,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.view_count) AS median_views
      FROM videos v
      WHERE v.channel_id = ANY(${channelIds})
        AND v.view_count IS NOT NULL
      GROUP BY v.channel_id
    `,

    // Reaction speed: first mention date per asset per channel (shared assets only)
    sql`
      SELECT
        v.channel_id,
        ma.asset_name,
        ma.asset_code,
        MIN(v.published_at) AS first_mention
      FROM mentioned_assets ma
      JOIN videos v ON ma.video_id = v.id
      WHERE v.channel_id = ANY(${channelIds})
        AND ma.asset_code IS NOT NULL
        AND ma.asset_code IN (
          SELECT ma2.asset_code
          FROM mentioned_assets ma2
          JOIN videos v2 ON ma2.video_id = v2.id
          WHERE v2.channel_id = ANY(${channelIds}) AND ma2.asset_code IS NOT NULL
          GROUP BY ma2.asset_code
          HAVING COUNT(DISTINCT v2.channel_id) >= 2
        )
      GROUP BY v.channel_id, ma.asset_name, ma.asset_code
      ORDER BY ma.asset_name, first_mention
    `,

    // Channel profiles (sentiment-based)
    sql`
      SELECT
        v.channel_id,
        COUNT(CASE WHEN ma.sentiment = 'positive' THEN 1 END)::int AS positive_count,
        COUNT(CASE WHEN ma.sentiment = 'negative' THEN 1 END)::int AS negative_count,
        COUNT(CASE WHEN ma.sentiment = 'neutral' THEN 1 END)::int AS neutral_count,
        COUNT(DISTINCT ma.asset_code)::int AS unique_assets,
        COUNT(ma.id)::int AS total_mentions,
        AVG(v.duration)::int AS avg_duration
      FROM videos v
      LEFT JOIN mentioned_assets ma ON ma.video_id = v.id
      WHERE v.channel_id = ANY(${channelIds})
      GROUP BY v.channel_id
    `,
  ])

  return NextResponse.json({
    channels,
    assetCoverage,
    uploadPatterns,
    predictions,
    topVideos,
    engagement,
    reactionSpeed,
    profiles,
  })
}
