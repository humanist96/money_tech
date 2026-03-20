import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { cookies } from "next/headers"

const CLIENT_ID_COOKIE = "mt_client_id"

async function getOrCreateClientId(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(CLIENT_ID_COOKIE)
  if (existing) {
    return existing.value
  }
  const id = crypto.randomUUID()
  cookieStore.set(CLIENT_ID_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 365 * 24 * 60 * 60,
    path: "/",
  })
  return id
}

export async function GET() {
  try {
    const clientId = await getOrCreateClientId()
    const sql = getDb()

    const rows = await sql`
      SELECT watchlist
      FROM user_preferences
      WHERE client_id = ${clientId}
    `

    const watchlist = rows.length > 0 ? rows[0].watchlist : []

    return NextResponse.json({ watchlist })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch watchlist", detail: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const clientId = await getOrCreateClientId()
    const body = await request.json()

    const { asset_code, asset_name, asset_type } = body
    if (!asset_code || !asset_name) {
      return NextResponse.json({ error: "asset_code and asset_name are required" }, { status: 400 })
    }

    const newItem = {
      asset_code,
      asset_name,
      asset_type: asset_type || "stock",
      added_at: new Date().toISOString(),
    }

    const sql = getDb()

    await sql`
      INSERT INTO user_preferences (client_id, watchlist)
      VALUES (${clientId}, ${JSON.stringify([newItem])}::jsonb)
      ON CONFLICT (client_id)
      DO UPDATE SET
        watchlist = (
          CASE
            WHEN NOT (user_preferences.watchlist @> ${JSON.stringify([{ asset_code }])}::jsonb)
            THEN user_preferences.watchlist || ${JSON.stringify(newItem)}::jsonb
            ELSE user_preferences.watchlist
          END
        ),
        updated_at = NOW()
    `

    return NextResponse.json({ success: true, item: newItem })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to add to watchlist", detail: String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const clientId = await getOrCreateClientId()
    const body = await request.json()

    const { asset_code } = body
    if (!asset_code) {
      return NextResponse.json({ error: "asset_code is required" }, { status: 400 })
    }

    const sql = getDb()

    await sql`
      UPDATE user_preferences
      SET
        watchlist = (
          SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
          FROM jsonb_array_elements(watchlist) AS elem
          WHERE elem->>'asset_code' != ${asset_code}
        ),
        updated_at = NOW()
      WHERE client_id = ${clientId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to remove from watchlist", detail: String(error) },
      { status: 500 }
    )
  }
}
