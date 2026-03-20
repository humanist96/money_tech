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
      SELECT followed_channels
      FROM user_preferences
      WHERE client_id = ${clientId}
    `

    const followedChannels = rows.length > 0 ? (rows[0].followed_channels ?? []) : []

    return NextResponse.json({ followed_channels: followedChannels })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch follows", detail: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const clientId = await getOrCreateClientId()
    const body = await request.json()

    const { channel_id } = body
    if (!channel_id) {
      return NextResponse.json({ error: "channel_id is required" }, { status: 400 })
    }

    const sql = getDb()

    await sql`
      INSERT INTO user_preferences (client_id, followed_channels)
      VALUES (${clientId}, ARRAY[${channel_id}]::uuid[])
      ON CONFLICT (client_id)
      DO UPDATE SET
        followed_channels = (
          CASE
            WHEN NOT (${channel_id}::uuid = ANY(user_preferences.followed_channels))
            THEN array_append(user_preferences.followed_channels, ${channel_id}::uuid)
            ELSE user_preferences.followed_channels
          END
        ),
        updated_at = NOW()
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to follow channel", detail: String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const clientId = await getOrCreateClientId()
    const body = await request.json()

    const { channel_id } = body
    if (!channel_id) {
      return NextResponse.json({ error: "channel_id is required" }, { status: 400 })
    }

    const sql = getDb()

    await sql`
      UPDATE user_preferences
      SET
        followed_channels = array_remove(followed_channels, ${channel_id}::uuid),
        updated_at = NOW()
      WHERE client_id = ${clientId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to unfollow channel", detail: String(error) },
      { status: 500 }
    )
  }
}
