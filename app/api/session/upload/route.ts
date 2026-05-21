import { NextRequest, NextResponse } from "next/server"

import {
  getStorageBucket,
  getSupabaseAdmin,
  isSupabaseConfigured,
} from "@/lib/supabase/admin"
import { upsertCloneSession } from "@/lib/cloner/session-server"

export const runtime = "nodejs"
export const maxDuration = 60

const ALLOWED: Record<string, string[]> = {
  photo: ["image/png", "image/jpeg", "image/webp"],
  voice: ["audio/webm", "audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg"],
  reaction: ["video/webm", "video/mp4"],
  final: ["video/webm", "video/mp4"],
}

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "audio/webm": "webm",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "video/webm": "webm",
  "video/mp4": "mp4",
}

function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  )
}

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
  const kind = String(formData.get("kind") ?? "").trim() as
    | "photo"
    | "voice"
    | "reaction"
    | "final"
  const file = formData.get("file")

  if (!sessionId || !isUuidLike(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
  }

  if (
    kind !== "photo" &&
    kind !== "voice" &&
    kind !== "reaction" &&
    kind !== "final"
  ) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 })
  }

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Missing or empty file" }, { status: 400 })
  }

  const rawMime = file.type || "application/octet-stream"
  const mime = rawMime.split(";")[0]?.trim() || rawMime
  const allowed = ALLOWED[kind]
  if (!allowed.includes(mime)) {
    return NextResponse.json(
      { error: `Invalid file type for ${kind}: ${mime}` },
      { status: 400 }
    )
  }

  const maxBytes =
    kind === "photo"
      ? 15 * 1024 * 1024
      : kind === "voice"
        ? 25 * 1024 * 1024
        : 49 * 1024 * 1024
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "File too large" }, { status: 400 })
  }

  const ext = EXT[mime] ?? "bin"
  const objectPath =
    kind === "reaction"
      ? `${sessionId}/reaction.${ext}`
      : kind === "final"
        ? `${sessionId}/final.${ext}`
        : `${sessionId}/${kind}.${ext}`

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

    try {
      const pathField = `${kind}_path` as
        | "photo_path"
        | "voice_path"
        | "reaction_path"
        | "final_path"
      const archive = await upsertCloneSession(sessionId, {
        status: kind === "final" ? "ready" : "draft",
        [pathField === "final_path" ? "final_video_path" : pathField]: objectPath,
        ...(kind === "final" ? { error_message: null } : null),
      })
      return NextResponse.json({
        path: objectPath,
        bucket,
        archiveLabel: archive?.archiveLabel ?? null,
      })
    } catch (metadataError) {
      console.warn("Session metadata update skipped:", metadataError)
    }

    return NextResponse.json({ path: objectPath, bucket, archiveLabel: null })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
