import { upstreamErrorMessage } from "@/lib/elevenlabs-image"

function defaultBaseUrl(): string {
  const raw = process.env.ELEVENLABS_API_BASE_URL?.trim()
  if (raw) return raw.replace(/\/$/, "")
  return "https://api.elevenlabs.io"
}

function outputFormat() {
  return process.env.ELEVENLABS_TTS_OUTPUT_FORMAT?.trim() || "mp3_44100_128"
}

export async function generateSpeechFromVoice({
  voiceId,
  text,
  language,
}: {
  voiceId: string
  text: string
  language: string
}) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey?.trim()) {
    throw new Error("Missing ELEVENLABS_API_KEY on the server.")
  }

  const modelId = process.env.ELEVENLABS_TTS_MODEL_ID || "eleven_multilingual_v2"
  const format = outputFormat()
  const url = `${defaultBaseUrl()}/v1/text-to-speech/${encodeURIComponent(
    voiceId
  )}?output_format=${encodeURIComponent(format)}`

  console.log("[elevenlabs-tts] start", {
    voiceIdPrefix: voiceId.slice(0, 8),
    modelId,
    outputFormat: format,
    language,
    textLength: text.length,
  })

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      language_code: language,
    }),
  })

  if (!res.ok) {
    const message = await upstreamErrorMessage(res)
    console.error("[elevenlabs-tts] failed", { status: res.status, message })
    throw new Error(message)
  }

  const contentType = res.headers.get("content-type") ?? "audio/mpeg"
  const body = Buffer.from(await res.arrayBuffer())
  console.log("[elevenlabs-tts] done", {
    contentType,
    bytes: body.byteLength,
  })
  return { body, contentType }
}
