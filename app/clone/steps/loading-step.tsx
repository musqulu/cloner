"use client"

import { useEffect, useRef, useState } from "react"

import { Stack } from "@/components/layout/stack"
import { Heading } from "@/components/typography/heading"
import { Text } from "@/components/typography/text"
import type { UiCopy } from "@/lib/cloner/ui-copy"

const READINESS_WAIT_MS = 10_000
const READINESS_POLL_MS = 250
const GENERATION_RETRY_MS = 2_500
const ASSET_READY_TIMEOUT_MS = 30_000
const ASSET_READY_POLL_MS = 750

type CloneInput = {
  photo: Blob | null
  personalTruth: string
  language: string
  /** Pre-generated TTS script from /api/generate-tts-script (Truth step). */
  existingScript?: string
  existingScriptLanguage?: string | null
  sessionId: string
  photoStoragePath: string | null
  elevenLabsVoiceId: string | null
}

type AnalyzeCloneRequest = {
  photo?: string
  personalTruth: string
  language: string
  existingScript?: string
  existingScriptLanguage: string | null
  sessionId: string
  photoStoragePath: string | null
  elevenLabsVoiceId: string | null
}

type AnalyzeCloneResponse = {
  script?: string
  cloneVideoUrl?: string | null
  cloneVideoPath?: string | null
  warning?: string
  error?: string
  deferred?: boolean
  phase?: string
  debugSteps?: string[]
  ok: boolean
  status: number
}

const analyzeFlights = new Map<string, Promise<AnalyzeCloneResponse>>()

function postAnalyzeClone(input: AnalyzeCloneRequest) {
  const existing = analyzeFlights.get(input.sessionId)
  if (existing) return existing

  const request = (async (): Promise<AnalyzeCloneResponse> => {
    const res = await fetch("/api/analyze-clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    const data = await res.json() as Omit<AnalyzeCloneResponse, "ok" | "status">
    return {
      ...data,
      ok: res.ok,
      status: res.status,
    }
  })()

  const cleanup = () => {
    if (analyzeFlights.get(input.sessionId) === request) {
      analyzeFlights.delete(input.sessionId)
    }
  }
  analyzeFlights.set(input.sessionId, request)
  request.then(cleanup, cleanup)
  return request
}

export function LoadingStep({
  cloneData,
  copy,
  onComplete,
}: {
  cloneData: CloneInput
  copy: UiCopy
  onComplete: (
    generatedScript: string,
    cloneVideoUrl: string | null,
    cloneVideoPath: string | null,
    warning?: string | null
  ) => void
}) {
  const [messageIndex, setMessageIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<string | null>(null)
  const [debugSteps, setDebugSteps] = useState<string[]>([])
  const latestCloneDataRef = useRef(cloneData)

  useEffect(() => {
    latestCloneDataRef.current = cloneData
  }, [cloneData])

  useEffect(() => {
    let cancelled = false

    async function waitForAssetReady(url: string) {
      const startedAt = Date.now()
      let lastError: string = copy.loading.notReachable

      while (!cancelled && Date.now() - startedAt < ASSET_READY_TIMEOUT_MS) {
        try {
          const head = await fetch(url, {
            method: "HEAD",
            cache: "no-store",
          })
          if (head.ok) return
          lastError = `${copy.loading.notReachable} (${head.status}).`
        } catch (err) {
          lastError =
            err instanceof Error ? err.message : copy.loading.notReachable
        }

        try {
          const partial = await fetch(url, {
            headers: { Range: "bytes=0-1" },
            cache: "no-store",
          })
          if (partial.ok) {
            await partial.body?.cancel()
            return
          }
          lastError = `${copy.loading.notDownloadable} (${partial.status}).`
        } catch (err) {
          lastError =
            err instanceof Error
              ? err.message
              : copy.loading.notDownloadable
        }

        await new Promise((resolve) => setTimeout(resolve, ASSET_READY_POLL_MS))
      }

      throw new Error(lastError)
    }

    async function verifyCloneVideo(url: string) {
      await new Promise<void>((resolve, reject) => {
        const video = document.createElement("video")
        const timeout = window.setTimeout(() => {
          cleanup()
          reject(new Error(copy.loading.metadataNotReady))
        }, 15_000)

        const cleanup = () => {
          window.clearTimeout(timeout)
          video.removeAttribute("src")
          video.load()
        }
        const handleReady = () => {
          cleanup()
          resolve()
        }
        const handleError = () => {
          cleanup()
          reject(new Error(copy.loading.notPlayable))
        }

        video.preload = "metadata"
        video.playsInline = true
        video.muted = true
        video.addEventListener("loadedmetadata", handleReady, { once: true })
        video.addEventListener("canplay", handleReady, { once: true })
        video.addEventListener("error", handleError, { once: true })
        video.src = `${url}${url.includes("?") ? "&" : "?"}ready=${Date.now()}`
        video.load()
      })
    }

    async function analyze() {
      const startedAt = Date.now()
      while (
        !cancelled &&
        Date.now() - startedAt < READINESS_WAIT_MS &&
        (!latestCloneDataRef.current.photoStoragePath ||
          !latestCloneDataRef.current.elevenLabsVoiceId)
      ) {
        await new Promise((resolve) => setTimeout(resolve, READINESS_POLL_MS))
      }

      while (!cancelled) {
        const current = latestCloneDataRef.current
        let photoBase64: string | undefined
        if (current.photo) {
          const buffer = await current.photo.arrayBuffer()
          photoBase64 = btoa(
            new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), "")
          )
        }

        try {
          const data = await postAnalyzeClone({
            photo: photoBase64,
            personalTruth: current.personalTruth,
            language: current.language,
            existingScript: current.existingScript?.trim() || undefined,
            existingScriptLanguage: current.existingScriptLanguage ?? null,
            sessionId: current.sessionId,
            photoStoragePath: current.photoStoragePath,
            elevenLabsVoiceId: current.elevenLabsVoiceId,
          })
          setPhase(data.phase ?? null)
          setDebugSteps(Array.isArray(data.debugSteps) ? data.debugSteps : [])

          if (data.status === 202 || data.deferred) {
            setError(data.warning ?? copy.loading.stillPreparing)
            await new Promise((resolve) => setTimeout(resolve, GENERATION_RETRY_MS))
            continue
          }

          if (!data.ok) {
            setError(data.error ?? copy.loading.createFailed)
            return
          }

          if (!data.cloneVideoUrl) {
            setError(copy.loading.avatarWaiting)
            await new Promise((resolve) => setTimeout(resolve, GENERATION_RETRY_MS))
            continue
          }

          try {
            setError(copy.loading.uploadedWaiting)
            await waitForAssetReady(data.cloneVideoUrl)
          } catch (err) {
            if (cancelled) return
            setError(
              err instanceof Error ? err.message : copy.loading.notReady
            )
            await new Promise((resolve) => setTimeout(resolve, GENERATION_RETRY_MS))
            continue
          }
          if (cancelled) return

          let readinessWarning: string | null = null
          try {
            await verifyCloneVideo(data.cloneVideoUrl)
          } catch (err) {
            readinessWarning =
              err instanceof Error ? err.message : copy.loading.metadataTimedOut
          }

          setError(data.warning ?? null)
          setProgress(100)
          onComplete(
            data.script ?? "",
            data.cloneVideoUrl,
            data.cloneVideoPath ?? null,
            data.warning ?? readinessWarning
          )
          return
        } catch (err) {
          const message =
            err instanceof Error ? err.message : copy.loading.createFailed
          setError(message)
          await new Promise((resolve) => setTimeout(resolve, GENERATION_RETRY_MS))
        }
      }
    }

    analyze()
    return () => {
      cancelled = true
    }
  }, [copy, onComplete])

  useEffect(() => {
    const messageTimer = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, copy.loading.messages.length - 1))
    }, 1000)

    const progressTimer = setInterval(() => {
      setProgress((p) => Math.min(p + 1, 98))
    }, 100)

    return () => {
      clearInterval(messageTimer)
      clearInterval(progressTimer)
    }
  }, [copy.loading.messages.length])

  return (
    <Stack gap="stack" className="items-center text-center">
      <div className="relative size-24">
        <div className="absolute inset-0 rounded-full border-4 border-muted" />
        <svg className="absolute inset-0 size-24 -rotate-90" viewBox="0 0 96 96">
          <circle
            cx="48"
            cy="48"
            r="44"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 44}`}
            strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
            className="text-primary transition-all duration-200"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Text variant="small" className="tabular-nums font-mono font-semibold">
            {progress}%
          </Text>
        </div>
      </div>

      <Stack gap="tight" className="items-center">
        <Heading variant="subtitle">{copy.loading.title}</Heading>
        <Text
          variant="muted"
          className="transition-opacity duration-300"
          key={messageIndex}
        >
          {copy.loading.messages[messageIndex]}
        </Text>
        {error && (
          <Text variant="small" className="max-w-md text-destructive">
            {error}
          </Text>
        )}
        {phase && (
          <Text variant="small" className="max-w-md text-muted-foreground">
            {copy.loading.phase}: {phase}
          </Text>
        )}
        {debugSteps.length > 0 && (
          <Text variant="small" className="max-w-md text-muted-foreground">
            {copy.loading.steps}: {debugSteps.join(" -> ")}
          </Text>
        )}
      </Stack>

      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </Stack>
  )
}
