import { NextRequest, NextResponse } from "next/server"

import { generateSpeechFromVoice } from "@/lib/cloner/elevenlabs-tts"
import { generateTalkingHeadVideo } from "@/lib/cloner/replicate-video"
import { assertSessionId, upsertCloneSession } from "@/lib/cloner/session-server"
import {
  createSignedAssetUrl,
  storedAssetExists,
  uploadStoredAsset,
} from "@/lib/cloner/storage-server"
import { generateTtsScript } from "@/lib/cloner/tts-script"

export const runtime = "nodejs"
export const maxDuration = 300

type AnalyzeClonePayload = {
  script?: string
  cloneVideoUrl?: string | null
  cloneVideoPath?: string | null
  warning?: string
  error?: string
  deferred?: boolean
  phase?: string
  debugSteps?: string[]
}

type AnalyzeCloneResult = {
  status: number
  payload: AnalyzeClonePayload
}

const generationFlights = new Map<string, Promise<AnalyzeCloneResult>>()

function hasElevenLabsConfig() {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim())
}

function hasVideoConfig() {
  return Boolean(process.env.REPLICATE_VIDEO_MODEL?.trim())
}

function logStep(sessionId: string, step: string, detail?: Record<string, unknown>) {
  console.log(
    `[analyze-clone:${sessionId || "unknown"}] ${step}`,
    detail ? JSON.stringify(detail) : ""
  )
}

function userFacingGenerationWarning(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes("quota") || lower.includes("credits remaining")) {
    return `ElevenLabs API key quota blocked TTS, so Replicate video was skipped. ${message}`
  }
  if (lower.includes("text-to-speech") || lower.includes("tts")) {
    return `ElevenLabs TTS failed, so Replicate video was skipped. ${message}`
  }
  if (lower.includes("replicate")) {
    return `Replicate video generation failed. ${message}`
  }
  return message
}

/**
 * POST /api/analyze-clone
 *
 * Accepts the session assets and creates the real MVP clone video:
 * script → ElevenLabs TTS → Replicate talking-head video → Supabase storage.
 */
export async function POST(req: NextRequest) {
  let sessionId = ""
  const debugSteps: string[] = []
  const step = (name: string, detail?: Record<string, unknown>) => {
    debugSteps.push(name)
    logStep(sessionId, name, detail)
  }

  try {
    const body = await req.json()
    const {
      sessionId: bodySessionId,
      personalTruth,
      language,
      existingScript,
      existingScriptLanguage,
      photoStoragePath,
      elevenLabsVoiceId,
    } = body as {
      sessionId?: string
      personalTruth: string
      language: string
      existingScript?: string
      existingScriptLanguage?: string | null
      photoStoragePath?: string | null
      elevenLabsVoiceId?: string | null
    }
    sessionId = String(bodySessionId ?? "")
    assertSessionId(sessionId)
    step("request_received", {
      hasPhotoStoragePath: Boolean(photoStoragePath),
      hasElevenLabsVoiceId: Boolean(elevenLabsVoiceId),
      hasExistingScript: Boolean(existingScript?.trim()),
      existingScriptLanguage: existingScriptLanguage ?? null,
      language,
    })

    if (!personalTruth || personalTruth.trim().length < 50) {
      return NextResponse.json(
        { error: "Personal truth must be at least 50 characters." },
        { status: 400 }
      )
    }

    const waitingWarning = !photoStoragePath
      ? "Photo upload is still finishing."
      : !elevenLabsVoiceId
        ? "Voice clone is not ready yet."
        : null

    if (waitingWarning || !photoStoragePath || !elevenLabsVoiceId) {
      await upsertCloneSession(sessionId, {
        status: "waiting",
        personal_truth: personalTruth.trim(),
        language,
        photo_path: photoStoragePath ?? null,
        elevenlabs_voice_id: elevenLabsVoiceId ?? null,
        error_message: null,
        consented_at: new Date().toISOString(),
      })
      step("waiting", { warning: waitingWarning })
      return NextResponse.json(
        {
          script: existingScript?.trim() ?? "",
          cloneVideoUrl: null as string | null,
          cloneVideoPath: null as string | null,
          deferred: true,
          phase: "waiting",
          warning: waitingWarning,
          debugSteps,
        },
        { status: 202 }
      )
    }

    const configError = !hasElevenLabsConfig()
      ? "ElevenLabs is not configured."
      : !hasVideoConfig()
        ? "Replicate video model is not configured."
        : null

    if (configError) {
      step("failed", { warning: configError })
      await upsertCloneSession(sessionId, {
        status: "failed",
        personal_truth: personalTruth.trim(),
        language,
        photo_path: photoStoragePath,
        elevenlabs_voice_id: elevenLabsVoiceId,
        error_message: configError,
        consented_at: new Date().toISOString(),
      }).catch(() => {})
      return NextResponse.json(
        {
          error: configError,
          cloneVideoUrl: null as string | null,
          cloneVideoPath: null as string | null,
          phase: "failed",
          debugSteps,
        },
        { status: 503 }
      )
    }

    const canReuseScript =
      typeof existingScript === "string" &&
      existingScript.trim().length > 0 &&
      existingScriptLanguage === language

    const cloneVideoPath = `${sessionId}/clone.mp4`
    if (await storedAssetExists(cloneVideoPath)) {
      step("clone_reused_existing_asset", { cloneVideoPath })
      return NextResponse.json({
        script: canReuseScript ? existingScript.trim() : "",
        cloneVideoUrl: `/api/session/asset?path=${encodeURIComponent(cloneVideoPath)}`,
        cloneVideoPath,
        phase: "clone_uploaded",
        debugSteps,
      })
    }

    const existingGeneration = generationFlights.get(sessionId)
    if (existingGeneration) {
      step("duplicate_joined_generation")
      const result = await existingGeneration
      return NextResponse.json(
        {
          ...result.payload,
          debugSteps: [
            ...debugSteps,
            ...(result.payload.debugSteps ?? []).filter(
              (existingStep) => !debugSteps.includes(existingStep)
            ),
          ],
        },
        { status: result.status }
      )
    }

    const generation = (async (): Promise<AnalyzeCloneResult> => {
      const script = canReuseScript
        ? existingScript.trim()
        : (await generateTtsScript({
            personalTruth: personalTruth.trim(),
            language,
          })).script
      step("script_ready", { scriptLength: script.length, reused: canReuseScript })

      await upsertCloneSession(sessionId, {
        status: "generating",
        personal_truth: personalTruth.trim(),
        language,
        generated_script: script,
        photo_path: photoStoragePath ?? null,
        elevenlabs_voice_id: elevenLabsVoiceId ?? null,
        error_message: null,
        consented_at: new Date().toISOString(),
      })

      try {
        step("tts_start", { voiceIdPrefix: elevenLabsVoiceId.slice(0, 8) })
        const speech = await generateSpeechFromVoice({
          voiceId: elevenLabsVoiceId,
          text: script,
          language,
        })
        step("tts_done", {
          contentType: speech.contentType,
          bytes: speech.body.byteLength,
        })
        const ttsPath = `${sessionId}/tts.mp3`
        await uploadStoredAsset({
          path: ttsPath,
          body: speech.body,
          contentType: speech.contentType,
        })
        await upsertCloneSession(sessionId, { tts_audio_path: ttsPath })
        step("tts_uploaded", { ttsPath })

        const imageUrl = await createSignedAssetUrl(photoStoragePath)
        const audioUrl = await createSignedAssetUrl(ttsPath)
        step("signed_urls_ready", {
          imagePath: photoStoragePath,
          audioPath: ttsPath,
        })
        step("replicate_start", {
          model: process.env.REPLICATE_VIDEO_MODEL,
          imageField: process.env.REPLICATE_VIDEO_IMAGE_FIELD || "image",
          audioField: process.env.REPLICATE_VIDEO_AUDIO_FIELD || "audio",
        })
        const video = await generateTalkingHeadVideo({
          imageUrl,
          audioUrl,
          prompt: script,
        })
        step("replicate_done", {
          contentType: video.contentType,
          bytes: video.body.byteLength,
        })
        await uploadStoredAsset({
          path: cloneVideoPath,
          body: video.body,
          contentType: video.contentType,
        })
        await upsertCloneSession(sessionId, {
          status: "clone_ready",
          clone_video_path: cloneVideoPath,
        })
        step("clone_uploaded", { cloneVideoPath })

        return {
          status: 200,
          payload: {
            script,
            cloneVideoUrl: `/api/session/asset?path=${encodeURIComponent(cloneVideoPath)}`,
            cloneVideoPath,
            phase: "clone_uploaded",
            debugSteps,
          },
        }
      } catch (generationError) {
        const message =
          generationError instanceof Error
            ? generationError.message
            : "Clone video generation failed."
        const warning = userFacingGenerationWarning(message)
        step("failed", { warning })
        await upsertCloneSession(sessionId, {
          status: "failed",
          error_message: warning,
        }).catch(() => {})
        return {
          status: 502,
          payload: {
            error: warning,
            script,
            cloneVideoUrl: null,
            cloneVideoPath: null,
            phase: "failed",
            debugSteps,
          },
        }
      }
    })()

    generationFlights.set(sessionId, generation)
    try {
      const result = await generation
      return NextResponse.json(result.payload, { status: result.status })
    } finally {
      if (generationFlights.get(sessionId) === generation) {
        generationFlights.delete(sessionId)
      }
    }
  } catch (err) {
    step("failed", {
      error: err instanceof Error ? err.message : "Failed to generate clone data.",
    })
    if (sessionId) {
      await upsertCloneSession(sessionId, {
        status: "failed",
        error_message:
          err instanceof Error ? err.message : "Failed to generate clone video.",
      }).catch(() => {})
    }
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate clone data.",
        phase: "failed",
        debugSteps,
      },
      { status: 500 }
    )
  }
}
