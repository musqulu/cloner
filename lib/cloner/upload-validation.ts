import type { UploadKind } from "@/lib/cloner/upload-session-asset"
import { upsertCloneSession } from "@/lib/cloner/session-server"

export const UPLOAD_ALLOWED: Record<UploadKind, string[]> = {
  photo: ["image/png", "image/jpeg", "image/webp"],
  voice: ["audio/webm", "audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg"],
  reaction: ["video/webm", "video/mp4"],
  final: ["video/webm", "video/mp4"],
}

export const UPLOAD_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "audio/webm": "webm",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "video/webm": "webm",
  "video/mp4": "mp4",
}

const UPLOAD_KINDS: UploadKind[] = ["photo", "voice", "reaction", "final"]

export function isUploadKind(value: string): value is UploadKind {
  return UPLOAD_KINDS.includes(value as UploadKind)
}

export function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  )
}

export function normalizeMime(rawMime: string): string {
  const mime = rawMime.split(";")[0]?.trim() || rawMime
  return mime || "application/octet-stream"
}

export function getMaxUploadBytes(kind: UploadKind): number {
  if (kind === "photo") return 15 * 1024 * 1024
  if (kind === "voice") return 25 * 1024 * 1024
  return 49 * 1024 * 1024
}

export function getUploadObjectPath(
  sessionId: string,
  kind: UploadKind,
  mime: string
): string {
  const ext = UPLOAD_EXT[mime] ?? "bin"
  if (kind === "reaction") return `${sessionId}/reaction.${ext}`
  if (kind === "final") return `${sessionId}/final.${ext}`
  return `${sessionId}/${kind}.${ext}`
}

export type UploadValidationResult =
  | { ok: true; kind: UploadKind; mime: string; objectPath: string }
  | { ok: false; error: string; status: number }

export function validateUploadRequest(input: {
  sessionId: string
  kind: string
  mime: string
  size: number
}): UploadValidationResult {
  const sessionId = input.sessionId.trim()
  const kind = input.kind.trim()

  if (!sessionId || !isUuidLike(sessionId)) {
    return { ok: false, error: "Invalid sessionId", status: 400 }
  }

  if (!isUploadKind(kind)) {
    return { ok: false, error: "Invalid kind", status: 400 }
  }

  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, error: "Missing or empty file", status: 400 }
  }

  const mime = normalizeMime(input.mime)
  const allowed = UPLOAD_ALLOWED[kind]
  if (!allowed.includes(mime)) {
    return {
      ok: false,
      error: `Invalid file type for ${kind}: ${mime}`,
      status: 400,
    }
  }

  const maxBytes = getMaxUploadBytes(kind)
  if (input.size > maxBytes) {
    return { ok: false, error: "File too large", status: 400 }
  }

  return {
    ok: true,
    kind,
    mime,
    objectPath: getUploadObjectPath(sessionId, kind, mime),
  }
}

export async function finalizeSessionUpload(
  sessionId: string,
  kind: UploadKind,
  objectPath: string
): Promise<{ path: string; archiveLabel: string | null }> {
  const pathField =
    kind === "final"
      ? "final_video_path"
      : (`${kind}_path` as "photo_path" | "voice_path" | "reaction_path")

  try {
    const archive = await upsertCloneSession(sessionId, {
      status: kind === "final" ? "ready" : "draft",
      [pathField]: objectPath,
      ...(kind === "final" ? { error_message: null } : null),
    })
    return {
      path: objectPath,
      archiveLabel: archive?.archiveLabel ?? null,
    }
  } catch (metadataError) {
    console.warn("Session metadata update skipped:", metadataError)
    return { path: objectPath, archiveLabel: null }
  }
}
