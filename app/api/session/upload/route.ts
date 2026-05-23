import { NextRequest, NextResponse } from "next/server"

import {
  finalizeSessionUpload,
  getUploadObjectPath,
  isUploadKind,
  isUuidLike,
  normalizeMime,
  UPLOAD_ALLOWED,
  getMaxUploadBytes,
} from "@/lib/cloner/upload-validation"
import {
  getStorageBucket,
  getSupabaseAdmin,
  isSupabaseConfigured,
} from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const maxDuration = 60

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

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const sessionId = String(formData.get("sessionId") ?? "").trim()
  const kind = String(formData.get("kind") ?? "").trim()
  const file = formData.get("file")

  if (!sessionId || !isUuidLike(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
  }

  if (!isUploadKind(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 })
  }

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Missing or empty file" }, { status: 400 })
  }

  const mime = normalizeMime(file.type || "application/octet-stream")
  const allowed = UPLOAD_ALLOWED[kind]
  if (!allowed.includes(mime)) {
    return NextResponse.json(
      { error: `Invalid file type for ${kind}: ${mime}` },
      { status: 400 }
    )
  }

  const maxBytes = getMaxUploadBytes(kind)
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "File too large" }, { status: 400 })
  }

  const objectPath = getUploadObjectPath(sessionId, kind, mime)
  const buffer = Buffer.from(await file.arrayBuffer())
  const bucket = getStorageBucket()

  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
      contentType: mime,
      upsert: true,
    })

    if (error) {
      console.error("Supabase upload error:", error.message)
      return NextResponse.json(
        { error: error.message || "Storage upload failed" },
        { status: 500 }
      )
    }

    const result = await finalizeSessionUpload(sessionId, kind, objectPath)
    return NextResponse.json({
      path: result.path,
      bucket,
      archiveLabel: result.archiveLabel,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
