import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin"

export type CloneSessionPatch = {
  status?: string
  archive_number?: number | null
  participant_label?: string | null
  personal_truth?: string | null
  language?: string | null
  generated_script?: string | null
  photo_path?: string | null
  voice_path?: string | null
  elevenlabs_voice_id?: string | null
  tts_audio_path?: string | null
  clone_video_path?: string | null
  reaction_path?: string | null
  final_video_path?: string | null
  error_message?: string | null
  consented_at?: string | null
}

export type CloneSessionArchive = {
  archiveNumber: number | null
  archiveLabel: string | null
}

function isMissingSessionTable(error: Error) {
  return error.message.includes("clone_sessions")
}

function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  )
}

export function assertSessionId(sessionId: string) {
  if (!sessionId || !isUuidLike(sessionId)) {
    throw new Error("Invalid sessionId")
  }
}

export function formatArchiveLabel(archiveNumber: number | null | undefined) {
  if (typeof archiveNumber !== "number" || !Number.isFinite(archiveNumber)) {
    return null
  }
  return `#${String(archiveNumber).padStart(5, "0")}`
}

function normalizeArchiveRow(row: unknown): CloneSessionArchive | null {
  if (!row || typeof row !== "object") return null
  const value = row as { archive_number?: unknown; participant_label?: unknown }
  const archiveNumber =
    typeof value.archive_number === "number" ? value.archive_number : null
  const archiveLabel =
    typeof value.participant_label === "string" && value.participant_label.trim()
      ? value.participant_label
      : formatArchiveLabel(archiveNumber)

  return {
    archiveNumber,
    archiveLabel,
  }
}

export async function upsertCloneSession(
  sessionId: string,
  patch: CloneSessionPatch
): Promise<CloneSessionArchive | null> {
  assertSessionId(sessionId)
  if (!isSupabaseConfigured()) {
    console.warn("[session] Supabase not configured, generating fallback archive number")
    return fallbackArchiveNumber()
  }

  const supabase = getSupabaseAdmin()
  try {
    const { data, error } = await supabase
      .from("clone_sessions")
      .upsert(
        {
          id: sessionId,
          ...patch,
        },
        { onConflict: "id" }
      )
      .select("id, archive_number, participant_label")
      .single()

    if (error) {
      console.warn("[session] upsert error:", error.message)
      throw new Error(error.message)
    }

    // If archive_number is missing (migration not applied), assign one based on row count
    const row = data as Record<string, unknown>
    if (row && (row.archive_number == null || row.participant_label == null)) {
      console.warn("[session] archive_number or participant_label is null, generating from row count")
      try {
        const { count } = await supabase
          .from("clone_sessions")
          .select("id", { count: "exact", head: true })
        const num = (count ?? 0) + 123 // start from #00124
        const label = `#${String(num).padStart(5, "0")}`
        // Try to store it back; ignore errors if columns don't exist
        await Promise.resolve(
          supabase
            .from("clone_sessions")
            .update({ archive_number: num, participant_label: label })
            .eq("id", sessionId)
        ).catch(() => {})
        return { archiveNumber: num, archiveLabel: label }
      } catch {
        return fallbackArchiveNumber()
      }
    }

    const result = normalizeArchiveRow(data)
    console.log("[session] archive result:", JSON.stringify(result))
    return result
  } catch (err) {
    if (err instanceof Error && isMissingSessionTable(err)) {
      console.warn("[session] clone_sessions table missing, generating fallback")
      return fallbackArchiveNumber()
    }
    console.warn("[session] unexpected error:", err instanceof Error ? err.message : err)
    return fallbackArchiveNumber()
  }
}

function fallbackArchiveNumber(): CloneSessionArchive {
  const num = Math.floor(Date.now() / 1000) % 100000
  return { archiveNumber: num, archiveLabel: `#${String(num).padStart(5, "0")}` }
}

export async function updateCloneSession(
  sessionId: string,
  patch: CloneSessionPatch
): Promise<CloneSessionArchive | null> {
  assertSessionId(sessionId)
  if (!isSupabaseConfigured()) return null

  const supabase = getSupabaseAdmin()
  try {
    const { data, error } = await supabase
      .from("clone_sessions")
      .update(patch)
      .eq("id", sessionId)
      .select("archive_number, participant_label")
      .single()

    if (error) {
      throw new Error(error.message)
    }
    return normalizeArchiveRow(data)
  } catch (err) {
    if (err instanceof Error && isMissingSessionTable(err)) {
      console.warn("clone_sessions table is missing; continuing without metadata.")
      return null
    }
    throw err
  }
}
