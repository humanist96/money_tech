import { getDb } from '../db'
import type { CrowdSentiment } from '../types'

export async function getCrowdSentiment(stockCode: string, days: number = 7): Promise<CrowdSentiment[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM crowd_sentiment
    WHERE stock_code = ${stockCode}
    AND period_start >= NOW() - (${days} || ' days')::interval
    ORDER BY period_start DESC
  `
  return rows as unknown as CrowdSentiment[]
}

export async function getCrowdSentimentLatest(limit: number = 20): Promise<CrowdSentiment[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT DISTINCT ON (stock_code) *
    FROM crowd_sentiment
    ORDER BY stock_code, period_start DESC
    LIMIT ${limit}
  `
  return rows as unknown as CrowdSentiment[]
}

export async function getCrowdSentimentTrend(stockCode: string, days: number = 30): Promise<CrowdSentiment[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM crowd_sentiment
    WHERE stock_code = ${stockCode}
    AND period_start >= NOW() - (${days} || ' days')::interval
    ORDER BY period_start ASC
  `
  return rows as unknown as CrowdSentiment[]
}
