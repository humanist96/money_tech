import crypto from "crypto"
import { auth } from "@/auth"
import { getDb } from "@/lib/db"

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex")
}

function generateApiKey(): string {
  const random = crypto.randomBytes(32).toString("hex")
  return `mt_live_${random}`
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const sql = getDb()
  try {
    const rows = await sql`
      SELECT id, key_prefix, name, tier, rate_limit, is_active, last_used_at, created_at, expires_at
      FROM api_keys
      WHERE user_id = ${session.user.id}
      ORDER BY created_at DESC
    `

    const keys = (rows as any[]).map((row) => ({
      id: row.id,
      key_preview: `${row.key_prefix}...`,
      name: row.name,
      tier: row.tier,
      rate_limit: row.rate_limit,
      is_active: row.is_active,
      last_used_at: row.last_used_at,
      created_at: row.created_at,
      expires_at: row.expires_at,
    }))

    return Response.json({ success: true, data: keys })
  } catch {
    return Response.json({ success: false, error: "Failed to fetch API keys" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const name = String(body.name || "").trim()

    if (!name || name.length > 100) {
      return Response.json(
        { success: false, error: "Name is required (max 100 characters)" },
        { status: 400 },
      )
    }

    const sql = getDb()

    const existingRows = await sql`
      SELECT COUNT(*)::int AS count FROM api_keys
      WHERE user_id = ${session.user.id} AND is_active = true
    `
    const existingCount = (existingRows[0] as { count: number }).count
    if (existingCount >= 5) {
      return Response.json(
        { success: false, error: "Maximum 5 active API keys allowed" },
        { status: 400 },
      )
    }

    const rawKey = generateApiKey()
    const keyHash = hashKey(rawKey)
    const keyPrefix = rawKey.slice(0, 8)

    await sql`
      INSERT INTO api_keys (user_id, key_hash, key_prefix, name, tier, rate_limit)
      VALUES (
        ${session.user.id},
        ${keyHash},
        ${keyPrefix},
        ${name},
        ${session.user.tier || "free"},
        ${session.user.tier === "pro" ? 1000 : 100}
      )
    `

    return Response.json({
      success: true,
      data: {
        key: rawKey,
        name,
        key_prefix: keyPrefix,
        tier: session.user.tier || "free",
        rate_limit: session.user.tier === "pro" ? 1000 : 100,
      },
    })
  } catch {
    return Response.json({ success: false, error: "Failed to create API key" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get("id")

    if (!keyId) {
      return Response.json({ success: false, error: "Key ID is required" }, { status: 400 })
    }

    const sql = getDb()
    const result = await sql`
      UPDATE api_keys SET is_active = false
      WHERE id = ${keyId} AND user_id = ${session.user.id}
      RETURNING id
    `

    if ((result as any[]).length === 0) {
      return Response.json({ success: false, error: "Key not found" }, { status: 404 })
    }

    return Response.json({ success: true, data: { id: keyId, is_active: false } })
  } catch {
    return Response.json({ success: false, error: "Failed to deactivate API key" }, { status: 500 })
  }
}
