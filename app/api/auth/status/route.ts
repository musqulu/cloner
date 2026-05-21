import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const AUTH_COOKIE = "cloner_access"

export async function GET() {
  const expected = process.env.CLONER_ACCESS_PASSWORD
  if (!expected?.trim()) {
    return NextResponse.json({ required: false, authenticated: true })
  }

  const cookieStore = await cookies()
  const cookie = cookieStore.get(AUTH_COOKIE)?.value
  return NextResponse.json({
    required: true,
    authenticated: cookie === expected,
  })
}
