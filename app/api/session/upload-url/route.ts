import { NextRequest, NextResponse } from "next/server"

import { validateUploadRequest } from "@/lib/cloner/upload-validation"
import {
  getStorageBucket,
  getSupabaseAdmin,
  isSupabaseConfigured,
} from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 }
    )
  }

  let body: { sessionId?: string; kind?: string; mime?: string; size?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const validation = validateUploadRequest({
    sessionId: String(body.sessionId ?? ""),
    kind: String(body.kind ?? ""),
    mime: String(body.mime ?? "application/octet-stream"),
    size: Number(body.size),
  })

  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status }
    )
  }

  const { objectPath } = validation
  const bucket = getStorageBucket()

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(objectPath, { upsert: true })

    if (error || !data?.signedUrl || !data.token) {
      console.error("Signed upload URL error:", error?.message)
      return NextResponse.json(
        { error: error?.message || "Failed to create upload URL" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: objectPath,
      bucket,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: "Failed to create upload URL" },
      { status: 500 }
    )
  }
}
