import { NextRequest, NextResponse } from "next/server"

import { generateTtsScript, MIN_TRUTH_LENGTH } from "@/lib/cloner/tts-script"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * POST /api/generate-tts-script
 *
 * Streams Claude on Replicate, returns the full TTS-ready script as JSON.
 * Input schema: `prompt` (see https://replicate.com/anthropic/claude-4.5-sonnet API tab).
 */
export async function POST(req: NextRequest) {
  let body: { personalTruth?: string; language?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const personalTruth = body.personalTruth?.trim() ?? ""
  const language = (body.language ?? "en").trim() || "en"

  if (personalTruth.length < MIN_TRUTH_LENGTH) {
    return NextResponse.json(
      { error: `Personal truth must be at least ${MIN_TRUTH_LENGTH} characters.` },
      { status: 400 }
    )
  }

  try {
    const result = await generateTtsScript({ personalTruth, language })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate script.",
      },
      { status: 500 }
    )
  }
}
