export type UploadKind = "photo" | "voice" | "reaction" | "final"

export type UploadSessionAssetResult = {
  path: string | null
  skipped: boolean
  archiveLabel: string | null
}

/**
 * Uploads a blob to Supabase Storage via the app API.
 * If NEXT_PUBLIC_SUPABASE_URL is unset, returns { path: null, skipped: true } (local dev without Supabase).
 * Throws if Supabase is configured but the upload fails.
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
