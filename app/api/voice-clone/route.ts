import { NextRequest, NextResponse } from "next/server"

import { upstreamErrorMessage } from "@/lib/elevenlabs-image"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_BYTES = 25 * 1024 * 1024

const ALLOWED_MIME = new Set([
  "audio/webm",
  "audio/wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
])

const EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
}

function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  )
}

function defaultBaseUrl(): string {
  const raw = process.env.ELEVENLABS_API_BASE_URL?.trim()
  if (raw) return raw.replace(/\/$/, "")
  return "https://api.elevenlabs.io"
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY on the server." },
      { status: 500 }
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file")
  const languageRaw = String(formData.get("language") ?? "en").trim()
  const language = languageRaw.slice(0, 16) || "en"
  const sessionIdRaw = String(formData.get("sessionId") ?? "").trim()

  if (sessionIdRaw && !isUuidLike(sessionIdRaw)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
  }

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Missing or empty file" }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 400 })
  }

  const rawMime = file.type || "application/octet-stream"
  const mime = rawMime.split(";")[0]?.trim() || rawMime
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { error: `Invalid audio type: ${mime}` },
      { status: 400 }
    )
  }

  const ext = EXT[mime] ?? "bin"
  const filename = `recording.${ext}`

  const voiceName = sessionIdRaw
    ? `Cloner ${sessionIdRaw.slice(0, 8)}`
    : `Cloner ${crypto.randomUUID().slice(0, 8)}`

  console.log("[voice-clone] start", {
    sessionIdPrefix: sessionIdRaw ? sessionIdRaw.slice(0, 8) : null,
    language,
    mime,
    bytes: file.size,
  })

  const upstream = new FormData()
  upstream.append("name", voiceName)
  upstream.append("files", file, filename)
  upstream.append("remove_background_noise", "false")
  upstream.append("labels", JSON.stringify({ language }))

  const url = `${defaultBaseUrl()}/v1/voices/add`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: upstream,
  })

  if (!res.ok) {
    const msg = await upstreamErrorMessage(res)
    console.error("[voice-clone] failed", { status: res.status, message: msg })
    return NextResponse.json({ error: msg }, { status: res.status >= 500 ? 502 : res.status })
  }

  const data = (await res.json()) as {
    voice_id?: string
    requires_verification?: boolean
  }

  if (!data.voice_id) {
    console.error("[voice-clone] missing voice_id")
    return NextResponse.json(
      { error: "Voice clone response missing voice_id." },
      { status: 502 }
    )
  }

  console.log("[voice-clone] done", {
    voiceIdPrefix: data.voice_id.slice(0, 8),
    requiresVerification: Boolean(data.requires_verification),
  })

  return NextResponse.json({
    voiceId: data.voice_id,
    requiresVerification: Boolean(data.requires_verification),
  })
}
