import { NextResponse } from "next/server"

const AUTH_COOKIE = "cloner_access"

export async function POST(req: Request) {
  const expected = process.env.CLONER_ACCESS_PASSWORD
  if (!expected) {
    return NextResponse.json({ ok: true })
  }

  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  if (body.password !== expected) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  })
  return res
}
