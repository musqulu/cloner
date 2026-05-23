import { NextRequest, NextResponse } from "next/server"

import {
  finalizeSessionUpload,
  isUploadKind,
  isUuidLike,
  validateUploadRequest,
} from "@/lib/cloner/upload-validation"
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

  let body: { sessionId?: string; kind?: string; path?: string; mime?: string; size?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const sessionId = String(body.sessionId ?? "").trim()
  const kind = String(body.kind ?? "").trim()
  const path = String(body.path ?? "").trim()

  if (!sessionId || !isUuidLike(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
  }

  if (!isUploadKind(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 })
  }

  if (!path.startsWith(`${sessionId}/`)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 })
  }

  if (body.mime !== undefined && body.size !== undefined) {
    const validation = validateUploadRequest({
      sessionId,
      kind,
      mime: String(body.mime),
      size: Number(body.size),
    })
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      )
    }
    if (validation.objectPath !== path) {
      return NextResponse.json({ error: "Path mismatch" }, { status: 400 })
    }
  }

  const bucket = getStorageBucket()

  try {
    const supabase = getSupabaseAdmin()
    const folder = sessionId
    const filename = path.slice(sessionId.length + 1)
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      search: filename,
    })

    if (error) {
      console.error("Storage verify error:", error.message)
      return NextResponse.json(
        { error: "Failed to verify upload" },
        { status: 500 }
      )
    }

    const uploaded = data?.some((item) => item.name === filename)
    if (!uploaded) {
      return NextResponse.json(
        { error: "Upload not found in storage" },
        { status: 400 }
      )
    }

    const result = await finalizeSessionUpload(sessionId, kind, path)
    return NextResponse.json({
      path: result.path,
      bucket,
      archiveLabel: result.archiveLabel,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Upload finalize failed" }, { status: 500 })
  }
}
