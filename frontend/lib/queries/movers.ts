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

/**
 * 특정 거래일의 movers. `tradeDate`가 null이면 최신 세션을 한 번의 쿼리로
 * 함께 해결한다 — MAX(trade_date)를 따로 물어보면 왕복이 두 번이 된다.
 */
export async function getMoversByDate(tradeDate: string | null): Promise<DailyMover[]> {
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
    WHERE trade_date = COALESCE(${tradeDate}::date, (SELECT MAX(trade_date) FROM daily_movers))
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
