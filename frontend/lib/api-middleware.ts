import crypto from "crypto"
import { getDb } from "@/lib/db"

interface KeyInfo {
  id: string
  user_id: string
  name: string
  tier: string
  rate_limit: number
  remaining: number
}

interface ValidateResult {
  valid: boolean
  keyInfo?: KeyInfo
  error?: string
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex")
}

export async function validateApiKey(request: Request): Promise<ValidateResult> {
  const authHeader = request.headers.get("authorization")

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or invalid Authorization header. Use: Bearer mt_live_xxx" }
  }

  const apiKey = authHeader.slice(7).trim()
  if (!apiKey.startsWith("mt_live_")) {
    return { valid: false, error: "Invalid API key format. Keys must start with mt_live_" }
  }

  const keyHash = hashKey(apiKey)
  const sql = getDb()

  try {
    const rows = await sql`
      SELECT id, user_id, name, tier, rate_limit, is_active, expires_at
      FROM api_keys
      WHERE key_hash = ${keyHash}
      LIMIT 1
    `

    if (rows.length === 0) {
      return { valid: false, error: "Invalid API key" }
    }

    const key = rows[0] as {
      id: string
      user_id: string
      name: string
      tier: string
      rate_limit: number
      is_active: boolean
      expires_at: string | null
    }

    if (!key.is_active) {
      return { valid: false, error: "API key has been deactivated" }
    }

    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return { valid: false, error: "API key has expired" }
    }

    const usageRows = await sql`
      SELECT COUNT(*)::int AS count
      FROM api_usage_log
      WHERE api_key_id = ${key.id}
        AND created_at >= NOW() - INTERVAL '1 hour'
    `
    const usageCount = (usageRows[0] as { count: number }).count
    const remaining = Math.max(0, key.rate_limit - usageCount)

    if (remaining <= 0) {
      return { valid: false, error: "Rate limit exceeded. Try again later." }
    }

    await sql`
      UPDATE api_keys SET last_used_at = NOW() WHERE id = ${key.id}
    `

    return {
      valid: true,
      keyInfo: {
        id: key.id,
        user_id: key.user_id,
        name: key.name,
        tier: key.tier,
        rate_limit: key.rate_limit,
        remaining: remaining - 1,
      },
    }
  } catch (error) {
    return { valid: false, error: "Internal error validating API key" }
  }
}

export async function logApiUsage(
  apiKeyId: string,
  endpoint: string,
  statusCode: number,
  responseTimeMs: number,
): Promise<void> {
  const sql = getDb()
  try {
    await sql`
      INSERT INTO api_usage_log (api_key_id, endpoint, status_code, response_time_ms)
      VALUES (${apiKeyId}, ${endpoint}, ${statusCode}, ${responseTimeMs})
    `
  } catch {
    // best-effort logging
  }
}

export function apiError(message: string, status: number) {
  return Response.json(
    { success: false, error: message },
    { status },
  )
}

export function apiSuccess<T>(data: T, meta?: Record<string, unknown>, keyInfo?: KeyInfo) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (keyInfo) {
    headers["X-RateLimit-Limit"] = String(keyInfo.rate_limit)
    headers["X-RateLimit-Remaining"] = String(keyInfo.remaining)
  }

  return new Response(
    JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) }),
    { status: 200, headers },
  )
}
