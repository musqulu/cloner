import { NextRequest, NextResponse } from "next/server"

import { upstreamErrorMessage } from "@/lib/elevenlabs-image"

export const runtime = "nodejs"
export const maxDuration = 60

type Check = {
  ok: boolean
  status?: number
  message?: string
  details?: Record<string, unknown>
}

function has(value: string | undefined) {
  return Boolean(value?.trim())
}

async function checkElevenLabsUser(apiKey: string): Promise<Check> {
  const res = await fetch("https://api.elevenlabs.io/v1/user", {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  })
  if (res.ok) return { ok: true, status: res.status }
  return {
    ok: false,
    status: res.status,
    message: await upstreamErrorMessage(res),
  }
}

async function checkElevenLabsTts(apiKey: string, voiceId: string): Promise<Check> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
      voiceId
    )}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "Hi.",
        model_id: process.env.ELEVENLABS_TTS_MODEL_ID || "eleven_multilingual_v2",
      }),
    }
  )
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: await upstreamErrorMessage(res),
    }
  }
  const bytes = (await res.arrayBuffer()).byteLength
  return { ok: true, status: res.status, details: { bytes } }
}

async function checkReplicateModel(token: string): Promise<Check> {
  const model = process.env.REPLICATE_VIDEO_MODEL?.trim()
  if (!model) return { ok: false, message: "REPLICATE_VIDEO_MODEL is missing." }

  const [owner, name] = model.split("/")
  if (!owner || !name) {
    return { ok: false, message: "REPLICATE_VIDEO_MODEL must be owner/model." }
  }

  const res = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  const data = (await res.json().catch(() => ({}))) as {
    detail?: string
    latest_version?: { id?: string }
  }
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: data.detail || `Replicate returned ${res.status}.`,
    }
  }
  return {
    ok: true,
    status: res.status,
    details: {
      model,
      latestVersion: data.latest_version?.id ?? null,
      imageField: process.env.REPLICATE_VIDEO_IMAGE_FIELD || "image",
      audioField: process.env.REPLICATE_VIDEO_AUDIO_FIELD || "audio",
      resolution: process.env.REPLICATE_VIDEO_RESOLUTION || "720p",
    },
  }
}

export async function GET(req: NextRequest) {
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY
  const replicateToken = process.env.REPLICATE_API_TOKEN
  const voiceId =
    req.nextUrl.searchParams.get("voiceId")?.trim() ||
    process.env.ELEVENLABS_TEST_VOICE_ID?.trim()

  const checks: Record<string, Check> = {
    env: {
      ok: has(elevenLabsKey) && has(replicateToken) && has(process.env.REPLICATE_VIDEO_MODEL),
      details: {
        elevenLabsKey: has(elevenLabsKey),
        replicateToken: has(replicateToken),
        replicateVideoModel: has(process.env.REPLICATE_VIDEO_MODEL),
        elevenLabsTestVoiceId: has(voiceId),
      },
    },
  }

  if (elevenLabsKey?.trim()) {
    checks.elevenLabsUser = await checkElevenLabsUser(elevenLabsKey)
    checks.elevenLabsTinyTts = voiceId
      ? await checkElevenLabsTts(elevenLabsKey, voiceId)
      : {
          ok: false,
          message:
            "Skipped. Pass ?voiceId=... or set ELEVENLABS_TEST_VOICE_ID to test TTS quota.",
        }
  }

  if (replicateToken?.trim()) {
    checks.replicateVideoModel = await checkReplicateModel(replicateToken)
  }

  return NextResponse.json({
    ok: Object.values(checks).every((check) => check.ok),
    checks,
  })
}
