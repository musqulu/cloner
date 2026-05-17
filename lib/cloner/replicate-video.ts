import Replicate from "replicate"

import { downloadUrlToBuffer } from "@/lib/cloner/storage-server"

function getEnv(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback
}

async function outputToUrl(output: unknown): Promise<string | null> {
  if (typeof output === "string" && output.startsWith("http")) return output

  if (Array.isArray(output)) {
    for (const item of output) {
      const url = await outputToUrl(item)
      if (url) return url
    }
  }

  if (output && typeof output === "object") {
    const obj = output as Record<string, unknown>
    const field = process.env.REPLICATE_VIDEO_OUTPUT_FIELD?.trim()
    if (field && field in obj) {
      return outputToUrl(obj[field])
    }
    if (typeof obj.url === "string" && obj.url.startsWith("http")) return obj.url
    if (typeof obj.url === "function") {
      const url = await (obj.url as () => Promise<unknown> | unknown)()
      if (typeof url === "string" && url.startsWith("http")) return url
    }
    for (const key of ["video", "output", "file"]) {
      if (key in obj) {
        const url = await outputToUrl(obj[key])
        if (url) return url
      }
    }
  }

  return null
}

async function outputToBuffer(output: unknown) {
  const url = await outputToUrl(output)
  if (url) {
    console.log("[replicate-video] downloadable output", { urlHost: new URL(url).host })
    return downloadUrlToBuffer(url)
  }

  if (output instanceof ReadableStream) {
    const res = new Response(output)
    return {
      body: Buffer.from(await res.arrayBuffer()),
      contentType: "video/mp4",
    }
  }

  console.error("[replicate-video] unrecognized output", {
    type: typeof output,
    isArray: Array.isArray(output),
    keys: output && typeof output === "object" ? Object.keys(output) : null,
  })
  throw new Error("Replicate did not return a downloadable video output.")
}

export async function generateTalkingHeadVideo({
  imageUrl,
  audioUrl,
  prompt,
}: {
  imageUrl: string
  audioUrl: string
  prompt: string
}) {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token?.trim()) {
    throw new Error("REPLICATE_API_TOKEN is not configured.")
  }

  const model = process.env.REPLICATE_VIDEO_MODEL?.trim()
  if (!model) {
    throw new Error("REPLICATE_VIDEO_MODEL is not configured.")
  }

  const imageField = getEnv("REPLICATE_VIDEO_IMAGE_FIELD", "image")
  const audioField = getEnv("REPLICATE_VIDEO_AUDIO_FIELD", "audio")
  const resolutionField = getEnv("REPLICATE_VIDEO_RESOLUTION_FIELD", "resolution")
  const resolution = getEnv("REPLICATE_VIDEO_RESOLUTION", "720p")
  const promptField = process.env.REPLICATE_VIDEO_PROMPT_FIELD?.trim()

  const input: Record<string, string> = {
    [imageField]: imageUrl,
    [audioField]: audioUrl,
    [resolutionField]: resolution,
  }
  if (promptField) {
    input[promptField] = prompt
  }

  console.log("[replicate-video] start", {
    model,
    imageField,
    audioField,
    resolutionField,
    resolution,
    promptField: promptField || null,
    inputKeys: Object.keys(input),
  })
  const replicate = new Replicate({ auth: token })
  const output = await replicate.run(model as `${string}/${string}`, { input })
  console.log("[replicate-video] raw output", {
    type: typeof output,
    isArray: Array.isArray(output),
    keys: output && typeof output === "object" ? Object.keys(output) : null,
  })
  return outputToBuffer(output)
}
