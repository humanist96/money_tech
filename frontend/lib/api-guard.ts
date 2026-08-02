import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { getDb } from '@/lib/db'

/**
 * Session-auth + rate limit for the /api/search and /api/research routes.
 *
 * These are not the public v1 API — they are called from the app with a login
 * session, so `validateApiKey` does not apply. Four of the six spend an
 * external quota (OpenAI, YouTube Data, Naver), and until now any anonymous
 * caller could drain them (plan 2.2).
 *
 * `requireAuth()` is not used here: it redirects to /login, which is right for
 * a page and wrong for fetch() — the caller gets an HTML body where it expects
 * JSON. These return 401 instead.
 */

/** Per-hour ceiling by cost. LLM calls are the expensive ones. */
export const RATE_LIMITS = {
  llm: 20,
  external: 60,
  internal: 120,
} as const

export type RateTier = keyof typeof RATE_LIMITS

/**
 * Verifies the session and books the call against the hourly window.
 *
 * Returns a response to return as-is when the caller is rejected, or null when
 * the handler may proceed.
 *
 * Count and insert are one statement, not two: the driver is HTTP, so each
 * round trip to Singapore costs ~85ms on a warm connection, and a separate
 * check-then-write also lets two concurrent instances both pass on the last
 * slot. Booking happens before the handler runs, so a request that dies
 * mid-flight still counts — otherwise a failing upstream becomes free retries.
 */
export async function guardRoute(route: string, tier: RateTier): Promise<NextResponse | null> {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 })
  }

  const limit = RATE_LIMITS[tier]

  try {
    const rows = await getDb()`
      WITH window_usage AS (
        SELECT COUNT(*)::int AS used
        FROM user_api_usage
        WHERE user_id = ${user.id}
          AND route = ${route}
          AND created_at >= NOW() - INTERVAL '1 hour'
      ), booked AS (
        INSERT INTO user_api_usage (user_id, route)
        SELECT ${user.id}, ${route} FROM window_usage WHERE used < ${limit}
        RETURNING 1
      )
      SELECT EXISTS (SELECT 1 FROM booked) AS allowed FROM window_usage
    `
    const allowed = (rows[0] as { allowed: boolean } | undefined)?.allowed ?? true

    if (!allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded: ${limit} requests/hour for ${route}` },
        { status: 429, headers: { 'Retry-After': '3600' } },
      )
    }
    return null
  } catch (error) {
    // A counter failure must not take the feature down, but it must be loud:
    // silently degrading to "unlimited" is how this gap survived in the first
    // place.
    console.error(`[api-guard] rate limit check failed for ${route}:`, error)
    return null
  }
}
