import {
  getStorageBucket,
  getSupabaseAdmin,
  isSupabaseConfigured,
} from "@/lib/supabase/admin"

type UploadStoredAssetInput = {
  path: string
  body: Buffer
  contentType: string
}

export async function uploadStoredAsset({
  path,
  body,
  contentType,
}: UploadStoredAssetInput) {
  const bucket = getStorageBucket()
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: true,
  })

  if (error) {
    throw new Error(error.message)
  }

  return { bucket, path }
}

export async function createSignedAssetUrl(path: string, expiresIn = 60 * 30) {
  const bucket = getStorageBucket()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not create signed URL")
  }

  return data.signedUrl
}

export async function storedAssetExists(path: string) {
  if (!isSupabaseConfigured()) return false

  try {
    const signedUrl = await createSignedAssetUrl(path, 60)
    const res = await fetch(signedUrl, {
      method: "HEAD",
      cache: "no-store",
    })
    return res.ok
  } catch {
    return false
  }
}

export async function downloadUrlToBuffer(url: string) {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`Could not download generated asset (${res.status})`)
  }
  const contentType = res.headers.get("content-type") ?? "application/octet-stream"
  const body = Buffer.from(await res.arrayBuffer())
  return { body, contentType }
}
