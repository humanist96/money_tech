import { getDb } from '../db'
import type { DailyMover } from '../types'

/** The most recent session that has stored movers (skips holidays for free). */
export async function getLatestMoversDate(): Promise<string | null> {
  const sql = getDb()
  const rows = await sql`
    SELECT trade_date::text AS trade_date
    FROM daily_movers
    ORDER BY trade_date DESC
    LIMIT 1
  `
  return rows.length > 0 ? (rows[0] as { trade_date: string }).trade_date : null
}

export async function getMoversByDate(tradeDate: string): Promise<DailyMover[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      id,
      trade_date::text AS trade_date,
      stock_code,
      stock_name,
      market,
      close_price::float,
      change_pct::float,
      trading_value,
      value_ratio::float,
      selection_reason,
      headline,
      cause_type,
      summary,
      confidence,
      factors,
      evidence,
      creator_context,
      investor_flow,
      llm_model
    FROM daily_movers
    WHERE trade_date = ${tradeDate}::date
    ORDER BY selection_score DESC NULLS LAST
  `
  return rows as DailyMover[]
}

/** Top headlines for the dashboard strip. */
export async function getTopMovers(limit = 3): Promise<DailyMover[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      id,
      trade_date::text AS trade_date,
      stock_code,
      stock_name,
      market,
      close_price::float,
      change_pct::float,
      trading_value,
      value_ratio::float,
      selection_reason,
      headline,
      cause_type,
      summary,
      confidence,
      factors,
      evidence,
      creator_context,
      investor_flow,
      llm_model
    FROM daily_movers
    WHERE trade_date = (SELECT MAX(trade_date) FROM daily_movers)
    ORDER BY selection_score DESC NULLS LAST
    LIMIT ${limit}
  `
  return rows as DailyMover[]
}

/** Past explanations for one stock, used on the asset page. */
export async function getMoverHistory(stockCode: string, limit = 10): Promise<DailyMover[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      id,
      trade_date::text AS trade_date,
      stock_code,
      stock_name,
      market,
      close_price::float,
      change_pct::float,
      trading_value,
      value_ratio::float,
      selection_reason,
      headline,
      cause_type,
      summary,
      confidence,
      factors,
      evidence,
      creator_context,
      investor_flow,
      llm_model
    FROM daily_movers
    WHERE stock_code = ${stockCode}
    ORDER BY trade_date DESC
    LIMIT ${limit}
  `
  return rows as DailyMover[]
}
