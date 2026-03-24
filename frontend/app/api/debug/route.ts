import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const results: Record<string, unknown> = {}

  try {
    const sql = getDb()
    const channels = await sql`SELECT count(*) as cnt FROM channels`
    results.channels = channels[0].cnt
  } catch (e) {
    results.channels_error = e instanceof Error ? e.message : String(e)
  }

  try {
    const sql = getDb()
    const videos = await sql`SELECT count(*) as cnt FROM videos`
    results.videos = videos[0].cnt
  } catch (e) {
    results.videos_error = e instanceof Error ? e.message : String(e)
  }

  try {
    const sql = getDb()
    const predictions = await sql`SELECT count(*) as cnt FROM predictions`
    results.predictions = predictions[0].cnt
  } catch (e) {
    results.predictions_error = e instanceof Error ? e.message : String(e)
  }

  results.env_check = {
    has_database_url: !!process.env.DATABASE_URL,
    database_url_length: process.env.DATABASE_URL?.length ?? 0,
    database_url_preview: process.env.DATABASE_URL?.substring(0, 30) + "...",
  }

  return NextResponse.json(results)
}
