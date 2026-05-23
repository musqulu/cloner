import {
  getSupabaseBrowser,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase/browser"
import { normalizeMime } from "@/lib/cloner/upload-validation"

export type UploadKind = "photo" | "voice" | "reaction" | "final"

export type UploadSessionAssetResult = {
  path: string | null
  skipped: boolean
  archiveLabel: string | null
}

const VIDEO_KINDS: UploadKind[] = ["reaction", "final"]

function isVideoKind(kind: UploadKind): boolean {
  return VIDEO_KINDS.includes(kind)
}

async function uploadViaSignedUrl(
  sessionId: string,
  kind: UploadKind,
  blob: Blob
): Promise<UploadSessionAssetResult> {
  const mime = normalizeMime(blob.type || "application/octet-stream")

  const urlRes = await fetch("/api/session/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      kind,
      mime,
      size: blob.size,
    }),
  })

  const urlData = (await urlRes.json().catch(() => ({}))) as {
    signedUrl?: string
    token?: string
    path?: string
    bucket?: string
    error?: string
  }

  if (!urlRes.ok) {
    throw new Error(urlData.error ?? "Failed to prepare upload")
  }

  const { token, path, bucket } = urlData
  if (!token || !path || !bucket) {
    throw new Error("Invalid upload URL response")
  }

  const supabase = getSupabaseBrowser()
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(path, token, blob, { contentType: mime })

  if (uploadError) {
    throw new Error(uploadError.message || "Direct storage upload failed")
  }

  const completeRes = await fetch("/api/session/upload-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      kind,
      path,
      mime,
      size: blob.size,
    }),
  })

  const completeData = (await completeRes.json().catch(() => ({}))) as {
    archiveLabel?: string | null
    error?: string
    path?: string
  }

  if (!completeRes.ok) {
    throw new Error(completeData.error ?? "Upload finalize failed")
  }

  return {
    path: completeData.path ?? path,
    skipped: false,
    archiveLabel: completeData.archiveLabel ?? null,
  }
}

async function uploadViaProxy(
  sessionId: string,
  kind: UploadKind,
  blob: Blob,
  filename: string
): Promise<UploadSessionAssetResult> {
  const formData = new FormData()
  formData.append("sessionId", sessionId)
  formData.append("kind", kind)
  formData.append("file", blob, filename)

  const res = await fetch("/api/session/upload", {
    method: "POST",
    body: formData,
  })

  const data = (await res.json().catch(() => ({}))) as {
    archiveLabel?: string | null
    error?: string
    path?: string
  }

  if (!res.ok) {
    throw new Error(data.error ?? "Upload failed")
  }

  return {
    path: data.path ?? null,
    skipped: false,
    archiveLabel: data.archiveLabel ?? null,
  }
}

/**
 * Uploads a blob to Supabase Storage.
 * Video kinds use direct signed uploads (bypasses Vercel body limits).
 * Photo/voice use the app API proxy.
 * If NEXT_PUBLIC_SUPABASE_URL is unset, returns { path: null, skipped: true }.
 */
export async function uploadSessionAsset(
  sessionId: string,
  kind: UploadKind,
  blob: Blob,
  filename: string
): Promise<UploadSessionAssetResult> {
  const hasPublicUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!hasPublicUrl) {
    return { path: null, skipped: true, archiveLabel: null }
  }

  if (isVideoKind(kind)) {
    if (!isSupabaseBrowserConfigured()) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY for direct video upload"
      )
    }
    return uploadViaSignedUrl(sessionId, kind, blob)
  }

  return uploadViaProxy(sessionId, kind, blob, filename)
}
