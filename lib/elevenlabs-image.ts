/**
 * Helpers for ElevenLabs image upstream responses.
 * The public OpenAPI spec does not yet expose a stable text-to-image path; callers
 * configure the full URL via ELEVENLABS_IMAGE_API_URL.
 */

function pickString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key]
  return typeof v === "string" ? v : undefined
}

function isLikelyPng(buf: Uint8Array): boolean {
  return buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
}

function isLikelyJpeg(buf: Uint8Array): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
}

function isLikelyWebp(buf: Uint8Array): boolean {
  return (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
}

function mimeFromMagic(buf: Uint8Array): string | null {
  if (isLikelyPng(buf)) return "image/png"
  if (isLikelyJpeg(buf)) return "image/jpeg"
  if (isLikelyWebp(buf)) return "image/webp"
  return null
}

function looksLikeBase64(s: string): boolean {
  const t = s.replace(/\s/g, "")
  return t.length > 40 && /^[A-Za-z0-9+/]+=*$/.test(t)
}

function extractBase64FromJson(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined
  const o = data as Record<string, unknown>

  const imageField = pickString(o, "image")
  if (imageField?.startsWith("data:image")) {
    const parts = imageField.split(",")
    const b = parts[1]
    if (b) return b.replace(/\s/g, "")
  }

  const direct =
    pickString(o, "image_base64") ??
    pickString(o, "b64_json") ??
    pickString(o, "base64") ??
    (imageField && looksLikeBase64(imageField) ? imageField : undefined)
  if (direct && looksLikeBase64(direct)) {
    return direct.replace(/\s/g, "")
  }

  const dataArr = o.data
  if (Array.isArray(dataArr) && dataArr[0] && typeof dataArr[0] === "object") {
    const first = dataArr[0] as Record<string, unknown>
    const b = pickString(first, "b64_json") ?? pickString(first, "base64")
    if (b) return b.replace(/\s/g, "")
  }

  const images = o.images
  if (Array.isArray(images) && images[0] && typeof images[0] === "object") {
    const first = images[0] as Record<string, unknown>
    const b = pickString(first, "b64_json") ?? pickString(first, "base64")
    if (b) return b.replace(/\s/g, "")
  }

  return undefined
}

function extractHttpsUrl(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined
  const o = data as Record<string, unknown>
  const u =
    pickString(o, "url") ??
    (typeof o.data === "object" && o.data !== null
      ? pickString(o.data as Record<string, unknown>, "url")
      : undefined)
  if (u?.startsWith("https://")) return u
  const images = o.images
  if (Array.isArray(images) && images[0] && typeof images[0] === "object") {
    const url = pickString(images[0] as Record<string, unknown>, "url")
    if (url?.startsWith("https://")) return url
  }
  return undefined
}

export async function upstreamErrorMessage(upstream: Response): Promise<string> {
  const text = await upstream.text()
  try {
    const j = JSON.parse(text) as Record<string, unknown>
    const detail = j.detail
    if (typeof detail === "string") return detail
    if (detail && typeof detail === "object" && "message" in detail) {
      const m = (detail as { message?: unknown }).message
      if (typeof m === "string") return m
    }
    if (typeof j.message === "string") return j.message
    if (j.error && typeof j.error === "object" && "message" in (j.error as object)) {
      const m = (j.error as { message?: unknown }).message
      if (typeof m === "string") return m
    }
  } catch {
    /* use raw text */
  }
  return text.slice(0, 2000) || `Upstream returned ${upstream.status}`
}

/**
 * Converts an ElevenLabs (or compatible) upstream response into a binary image Response.
 */
export async function normalizeUpstreamToImageResponse(upstream: Response): Promise<Response> {
  if (!upstream.ok) {
    const msg = await upstreamErrorMessage(upstream)
    return Response.json({ error: msg }, { status: 502 })
  }

  const ct = upstream.headers.get("content-type") ?? ""

  if (ct.startsWith("image/")) {
    const buf = Buffer.from(await upstream.arrayBuffer())
    return new Response(buf, {
      headers: {
        "content-type": ct,
        "cache-control": "no-store",
      },
    })
  }

  if (ct.includes("application/json")) {
    const json: unknown = await upstream.json()
    const b64 = extractBase64FromJson(json)
    if (b64) {
      const buf = Buffer.from(b64, "base64")
      return new Response(buf, {
        headers: {
          "content-type": "image/png",
          "cache-control": "no-store",
        },
      })
    }

    const url = extractHttpsUrl(json)
    if (url) {
      const imgRes = await fetch(url, { cache: "no-store" })
      if (!imgRes.ok) {
        return Response.json({ error: "Image URL from API could not be fetched." }, { status: 502 })
      }
      const imgCt = imgRes.headers.get("content-type") ?? "application/octet-stream"
      const buf = Buffer.from(await imgRes.arrayBuffer())
      return new Response(buf, {
        headers: {
          "content-type": imgCt.startsWith("image/") ? imgCt : "image/png",
          "cache-control": "no-store",
        },
      })
    }

    return Response.json({ error: "Image API returned JSON without a recognizable image field." }, { status: 502 })
  }

  const raw = new Uint8Array(await upstream.arrayBuffer())
  const magic = mimeFromMagic(raw)
  if (magic) {
    return new Response(Buffer.from(raw), {
      headers: {
        "content-type": magic,
        "cache-control": "no-store",
      },
    })
  }

  return Response.json({ error: "Unexpected response type from image API." }, { status: 502 })
}
