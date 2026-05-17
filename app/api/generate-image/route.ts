import { normalizeUpstreamToImageResponse } from "@/lib/elevenlabs-image"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey?.trim()) {
    return Response.json({ error: "Missing ELEVENLABS_API_KEY on the server." }, { status: 500 })
  }

  const imageApiUrl = process.env.ELEVENLABS_IMAGE_API_URL?.trim()
  if (!imageApiUrl) {
    return Response.json(
      {
        error:
          "ELEVENLABS_IMAGE_API_URL is not set. Add the full POST URL for ElevenLabs image generation from your account or API documentation.",
        code: "MISSING_IMAGE_ENDPOINT",
      },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const prompt =
    typeof body === "object" &&
    body !== null &&
    "prompt" in body &&
    typeof (body as { prompt: unknown }).prompt === "string"
      ? (body as { prompt: string }).prompt.trim()
      : ""

  if (!prompt) {
    return Response.json({ error: "prompt must be a non-empty string." }, { status: 400 })
  }

  if (prompt.length > 8000) {
    return Response.json({ error: "prompt is too long." }, { status: 400 })
  }

  const promptField = process.env.ELEVENLABS_IMAGE_PROMPT_FIELD?.trim() || "prompt"

  const upstream = await fetch(imageApiUrl, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ [promptField]: prompt }),
  })

  return normalizeUpstreamToImageResponse(upstream)
}
