import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin"

export type CloneSessionPatch = {
  status?: string
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

export async function upsertCloneSession(
  sessionId: string,
  patch: CloneSessionPatch
) {
  assertSessionId(sessionId)
  if (!isSupabaseConfigured()) return

  const supabase = getSupabaseAdmin()
  try {
    const { error } = await supabase.from("clone_sessions").upsert(
      {
        id: sessionId,
        ...patch,
      },
      { onConflict: "id" }
    )

    if (error) {
      throw new Error(error.message)
    }
  } catch (err) {
    if (err instanceof Error && isMissingSessionTable(err)) {
      console.warn("clone_sessions table is missing; continuing without metadata.")
      return
    }
    throw err
  }
}

export async function updateCloneSession(
  sessionId: string,
  patch: CloneSessionPatch
) {
  assertSessionId(sessionId)
  if (!isSupabaseConfigured()) return

  const supabase = getSupabaseAdmin()
  try {
    const { error } = await supabase
      .from("clone_sessions")
      .update(patch)
      .eq("id", sessionId)

    if (error) {
      throw new Error(error.message)
    }
  } catch (err) {
    if (err instanceof Error && isMissingSessionTable(err)) {
      console.warn("clone_sessions table is missing; continuing without metadata.")
      return
    }
    throw err
  }
}
