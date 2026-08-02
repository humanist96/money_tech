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

interface GuardOk {
  ok: true
  userId: string
}
interface GuardFail {
  ok: false
  response: NextResponse
}

/**
 * Verifies the session and records the call against the hourly window.
 *
 * Returns the user on success, or a ready-to-return response on failure.
 * The usage row is written *before* the handler runs so a request that dies
 * mid-flight still counts — otherwise a failing upstream becomes free retries.
 */
export async function guardRoute(route: string, tier: RateTier): Promise<GuardOk | GuardFail> {
  const user = await getCurrentUser()
  if (!user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Login required' }, { status: 401 }),
    }
  }

  const limit = RATE_LIMITS[tier]
  const sql = getDb()

  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS count
      FROM user_api_usage
      WHERE user_id = ${user.id}
        AND route = ${route}
        AND created_at >= NOW() - INTERVAL '1 hour'
    `
    const used = (rows[0] as { count: number }).count

    if (used >= limit) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Rate limit exceeded: ${limit} requests/hour for ${route}` },
          { status: 429, headers: { 'Retry-After': '3600' } },
        ),
      }
    }

    await sql`
      INSERT INTO user_api_usage (user_id, route) VALUES (${user.id}, ${route})
    `
    return { ok: true, userId: user.id }
  } catch (error) {
    // A counter failure must not take the feature down, but it must be loud:
    // silently degrading to "unlimited" is how this gap survived in the first
    // place.
    console.error(`[api-guard] rate limit check failed for ${route}:`, error)
    return { ok: true, userId: user.id }
  }
}
