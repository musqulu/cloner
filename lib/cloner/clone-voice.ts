"use client"

import { decodeAudioBlobToWav } from "@/lib/audio/decode-to-wav"

export type CloneVoiceResult = {
  voiceId: string
  requiresVerification: boolean
}

function filenameForBlob(blob: Blob): string {
  const t = blob.type.split(";")[0]?.trim() || ""
  if (t === "audio/webm") return "recording.webm"
  if (t === "audio/wav") return "recording.wav"
  if (t === "audio/mpeg") return "recording.mp3"
  if (t === "audio/mp4") return "recording.m4a"
  if (t === "audio/ogg") return "recording.ogg"
  return "recording.webm"
}

function isWavBlob(blob: Blob): boolean {
  const t = blob.type.split(";")[0]?.trim() || ""
  return t === "audio/wav" || t === "audio/wave" || t === "audio/x-wav"
}

async function postVoiceClone(
  blob: Blob,
  sessionId: string,
  language: string
): Promise<Response> {
  const formData = new FormData()
  formData.append("file", blob, filenameForBlob(blob))
  formData.append("sessionId", sessionId)
  formData.append("language", language)
  return fetch("/api/voice-clone", {
    method: "POST",
    body: formData,
  })
}

function parseError(data: unknown): string {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error?: unknown }).error
    if (typeof e === "string" && e.trim()) return e
  }
  return "Voice clone failed"
}

/**
 * Creates an ElevenLabs instant voice clone from a recording.
 * Retries once with a WAV re-encode if the first attempt fails (e.g. WebM rejected).
 */
export async function cloneVoiceFromBlob(
  sessionId: string,
  blob: Blob,
  language: string
): Promise<CloneVoiceResult> {
  let res = await postVoiceClone(blob, sessionId, language)

  if (!res.ok && !isWavBlob(blob)) {
    try {
      const wav = await decodeAudioBlobToWav(blob)
      res = await postVoiceClone(wav, sessionId, language)
    } catch {
      /* use first error below */
    }
  }

  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    voiceId?: string
    requiresVerification?: boolean
  }

  if (!res.ok) {
    throw new Error(parseError(data))
  }

  if (!data.voiceId) {
    throw new Error("Voice clone response missing voice id.")
  }

  return {
    voiceId: data.voiceId,
    requiresVerification: Boolean(data.requiresVerification),
  }
}
