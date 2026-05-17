import { NextRequest, NextResponse } from "next/server"

import { createSignedAssetUrl } from "@/lib/cloner/storage-server"

export const runtime = "nodejs"
export const maxDuration = 60

const ALLOWED_FILENAMES = new Set([
  "photo.png",
  "tts.mp3",
  "clone.mp4",
  "voice.webm",
  "reaction.webm",
  "final.webm",
])

function isSafePath(path: string) {
  const match = path.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([^/]+)$/i
  )
  return Boolean(match && ALLOWED_FILENAMES.has(match[2]) && !path.includes(".."))
}

function forwardedHeaders(upstream: Response) {
  const headers = new Headers()
  for (const name of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "last-modified",
    "etag",
  ]) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set("cache-control", "no-store")
  return headers
}

async function proxyAsset(req: NextRequest, method: "GET" | "HEAD") {
  const path = req.nextUrl.searchParams.get("path")?.trim() ?? ""
  if (!path || !isSafePath(path)) {
    return NextResponse.json({ error: "Invalid asset path." }, { status: 400 })
  }

  try {
    const signedUrl = await createSignedAssetUrl(path, 60 * 5)
    const range = req.headers.get("range")
    const upstream = await fetch(signedUrl, {
      method,
      headers: range ? { range } : undefined,
      cache: "no-store",
    })

    if (!upstream.ok) {
      throw new Error(`Could not download generated asset (${upstream.status})`)
    }

    return new Response(method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: forwardedHeaders(upstream),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Asset download failed."
    const status = message.toLowerCase().includes("not found") ? 404 : 502
    return NextResponse.json({ error: message }, { status })
  }
}

export async function GET(req: NextRequest) {
  return proxyAsset(req, "GET")
}

export async function HEAD(req: NextRequest) {
  return proxyAsset(req, "HEAD")
}
