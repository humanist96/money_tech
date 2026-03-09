import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const dir = join(homedir(), '.notebooklm')
    const path = join(dir, 'storage_state.json')

    await mkdir(dir, { recursive: true })
    await writeFile(path, JSON.stringify(data, null, 2))

    const cookieCount = data?.cookies?.length || 0
    return NextResponse.json({ ok: true, path, cookieCount })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
