"use client"

import { useEffect, useRef, useCallback, useMemo, useState } from "react"

import { useWebcam } from "@/hooks/use-webcam"
import { useIsTouchDevice } from "@/hooks/use-is-touch-device"
import { GlitchText } from "@/components/cloner/glitch-text"
import { uploadSessionAsset } from "@/lib/cloner/upload-session-asset"
import type { UiCopy } from "@/lib/cloner/ui-copy"

const FALLBACK_RECORDING_MS = 18_000
const TARGET_RECORDING_MS = 20_000
const BLACK_AFTER_CLONE_MS = 1_250
const ARCHIVE_MESSAGE_MS = 1_500
const ARCHIVE_GLITCH_MS = 300
const MIN_FINAL_NUMBER_MS = 1_000
const COMPOSITE_WIDTH = 1920
const COMPOSITE_HEIGHT = 1080
const ARCHIVE_MESSAGES = ["Zapis zakończony.", "Tożsamość zarchiwizowana."] as const

type ArchiveDisplayState = {
  text: string | null
  glitch: boolean
}

function drawVideoContain(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { mirror?: boolean } = {}
) {
  const sourceWidth = video.videoWidth || width
  const sourceHeight = video.videoHeight || height
  const scale = Math.min(width / sourceWidth, height / sourceHeight)
  const renderWidth = sourceWidth * scale
  const renderHeight = sourceHeight * scale
  const renderX = x + (width - renderWidth) / 2
  const renderY = y + (height - renderHeight) / 2

  ctx.save()
  if (options.mirror) {
    ctx.translate(renderX + renderWidth, renderY)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, renderWidth, renderHeight)
  } else {
    ctx.drawImage(video, renderX, renderY, renderWidth, renderHeight)
  }
  ctx.restore()
}

function getArchiveDisplayState(
  startedAt: number | null,
  now: number,
  archiveLabel: string
): ArchiveDisplayState {
  if (startedAt === null) return { text: null, glitch: false }

  const elapsed = now - startedAt
  if (elapsed < BLACK_AFTER_CLONE_MS) return { text: null, glitch: false }

  const firstStart = BLACK_AFTER_CLONE_MS
  const secondStart = firstStart + ARCHIVE_MESSAGE_MS
  const numberStart = secondStart + ARCHIVE_MESSAGE_MS

  if (elapsed < secondStart) {
    return {
      text: ARCHIVE_MESSAGES[0],
      glitch: elapsed - firstStart < ARCHIVE_GLITCH_MS,
    }
  }

  if (elapsed < numberStart) {
    return {
      text: ARCHIVE_MESSAGES[1],
      glitch: elapsed - secondStart < ARCHIVE_GLITCH_MS,
    }
  }

  return {
    text: archiveLabel || null,
    glitch: elapsed - numberStart < ARCHIVE_GLITCH_MS,
  }
}

const RECORDER_MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4;codecs=h264,aac",
  "video/mp4",
] as const

function pickRecorderMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null
  for (const candidate of RECORDER_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate
  }
  return null
}

function blobTypeFor(mime: string | null): string {
  if (!mime) return "video/webm"
  return mime.split(";")[0]?.trim() || "video/webm"
}

function drawArchivePane(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  state: ArchiveDisplayState,
  now: number
) {
  ctx.save()
  ctx.fillStyle = "#020202"
  ctx.fillRect(x, y, width, height)

  ctx.strokeStyle = "rgba(255,255,255,0.07)"
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1)

  if (!state.text) {
    ctx.restore()
    return
  }

  const centerX = x + width / 2
  const centerY = y + height / 2
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.font = state.text.startsWith("#")
    ? "500 48px ui-monospace, SFMono-Regular, Menlo, monospace"
    : "400 34px ui-monospace, SFMono-Regular, Menlo, monospace"

  if (state.glitch) {
    const jitter = Math.sin(now * 0.11) * 6
    ctx.fillStyle = "rgba(255,255,255,0.32)"
    ctx.fillText(state.text, centerX - jitter, centerY - 1)
    ctx.fillText(state.text, centerX + jitter * 0.55, centerY + 1)

    ctx.fillStyle = "rgba(255,255,255,0.12)"
    for (let i = 0; i < 8; i += 1) {
      const bandY = y + ((now * (0.03 + i * 0.004) + i * 87) % height)
      const bandX = x + ((i * 113 + now * 0.04) % width)
      ctx.fillRect(bandX, bandY, 24 + i * 9, 1 + (i % 2))
    }
  }

  ctx.fillStyle = "rgba(255,255,255,0.92)"
  ctx.fillText(state.text, centerX, centerY)
  ctx.restore()
}

export function ReactionStep({
  cloneVideoUrl,
  archiveLabel,
  photo,
  sessionId,
  copy,
  onReactionUploaded,
}: {
  cloneVideoUrl: string | null
  archiveLabel: string | null
  photo: Blob | null
  sessionId: string
  copy: UiCopy
  onReactionUploaded?: (path: string | null) => void
}) {
  const { videoRef, isActive, error, stop } = useWebcam({
    autoStart: true,
    permissionDeniedMessage: copy.photo.cameraDenied,
    unavailableMessage: copy.photo.cameraUnavailable,
  })
  const isTouch = useIsTouchDevice()
  const [isRecording, setIsRecording] = useState(false)
  const [, setRecordingUrl] = useState<string | null>(null)
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null)
  const [rawReactionBlob, setRawReactionBlob] = useState<Blob | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const rawReactionRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const rawReactionChunksRef = useRef<Blob[]>([])
  const drawFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recordingStartedRef = useRef(false)
  const recordingBeganAtRef = useRef<number | null>(null)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const postAvatarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const archiveStartedAtRef = useRef<number | null>(null)
  const cloneVideoRef = useRef<HTMLVideoElement>(null)
  const [archiveStartedAt, setArchiveStartedAt] = useState<number | null>(null)
  const [archiveClock, setArchiveClock] = useState(0)
  const uploadGenRef = useRef(0)
  const rawUploadGenRef = useRef(0)
  const archiveDisplayLabel = archiveLabel || "#-----"
  const archiveDisplay = getArchiveDisplayState(
    archiveStartedAt,
    archiveClock,
    archiveDisplayLabel
  )

  useEffect(() => {
    if (archiveStartedAt !== null && !archiveLabel) {
      console.warn("[reaction-step] archive label missing; final number hidden")
    }
  }, [archiveStartedAt, archiveLabel])

  const photoPreviewUrl = useMemo(() => {
    if (!photo) return null
    return URL.createObjectURL(photo)
  }, [photo])

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    }
  }, [photoPreviewUrl])

  useEffect(() => {
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (archiveStartedAt === null) return
    let frame: number | null = null

    const tick = (now: number) => {
      setArchiveClock(now)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [archiveStartedAt])

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
  }, [])

  const clearPostAvatarTimer = useCallback(() => {
    if (postAvatarTimerRef.current) {
      clearTimeout(postAvatarTimerRef.current)
      postAvatarTimerRef.current = null
    }
  }, [])

  const finishRecording = useCallback(() => {
    clearFallbackTimer()
    clearPostAvatarTimer()
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    if (rawReactionRecorderRef.current?.state === "recording") {
      rawReactionRecorderRef.current.stop()
    }
    setIsRecording(false)
  }, [clearFallbackTimer, clearPostAvatarTimer])

  useEffect(() => {
    if (cloneVideoUrl || !isRecording) return
    fallbackTimerRef.current = setTimeout(() => {
      finishRecording()
    }, FALLBACK_RECORDING_MS)
    return () => {
      clearFallbackTimer()
    }
  }, [cloneVideoUrl, isRecording, finishRecording, clearFallbackTimer])

  useEffect(() => {
    return () => {
      clearFallbackTimer()
      clearPostAvatarTimer()
      if (drawFrameRef.current) {
        cancelAnimationFrame(drawFrameRef.current)
      }
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop()
      }
      if (rawReactionRecorderRef.current?.state === "recording") {
        rawReactionRecorderRef.current.stop()
      }
      micStreamRef.current?.getTracks().forEach((track) => track.stop())
      audioContextRef.current?.close().catch(() => {})
    }
  }, [clearFallbackTimer, clearPostAvatarTimer])

  const handleCloneVideoEnded = useCallback(() => {
    if (postAvatarTimerRef.current) return
    const now = performance.now()
    archiveStartedAtRef.current = now
    setArchiveStartedAt(now)
    setArchiveClock(now)

    const elapsedRecording = recordingBeganAtRef.current
      ? now - recordingBeganAtRef.current
      : 0
    const minimumArchiveSequenceMs =
      BLACK_AFTER_CLONE_MS +
      ARCHIVE_MESSAGE_MS * ARCHIVE_MESSAGES.length +
      MIN_FINAL_NUMBER_MS
    const remainingTargetMs = Math.max(0, TARGET_RECORDING_MS - elapsedRecording)
    const stopAfterMs = Math.max(remainingTargetMs, minimumArchiveSequenceMs)

    postAvatarTimerRef.current = setTimeout(() => {
      finishRecording()
    }, stopAfterMs)
  }, [finishRecording])

  const startCompositeRecording = useCallback(async () => {
    const canvas = canvasRef.current
    const reactionVideo = videoRef.current
    const cloneVideo = cloneVideoRef.current
    if (
      !canvas ||
      !reactionVideo ||
      !cloneVideo ||
      !cloneVideoUrl ||
      recordingStartedRef.current
    ) {
      return
    }

    recordingStartedRef.current = true
    recordingBeganAtRef.current = performance.now()
    archiveStartedAtRef.current = null
    setArchiveStartedAt(null)
    setArchiveClock(0)
    chunksRef.current = []
    rawReactionChunksRef.current = []

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const draw = () => {
      const now = performance.now()
      ctx.fillStyle = "black"
      ctx.fillRect(0, 0, COMPOSITE_WIDTH, COMPOSITE_HEIGHT)
      drawVideoContain(ctx, reactionVideo, 0, 0, COMPOSITE_WIDTH / 2, COMPOSITE_HEIGHT, {
        mirror: true,
      })
      if (archiveStartedAtRef.current !== null) {
        drawArchivePane(
          ctx,
          COMPOSITE_WIDTH / 2,
          0,
          COMPOSITE_WIDTH / 2,
          COMPOSITE_HEIGHT,
          getArchiveDisplayState(
            archiveStartedAtRef.current,
            now,
            archiveDisplayLabel
          ),
          now
        )
      } else {
        drawVideoContain(
          ctx,
          cloneVideo,
          COMPOSITE_WIDTH / 2,
          0,
          COMPOSITE_WIDTH / 2,
          COMPOSITE_HEIGHT
        )
      }
      drawFrameRef.current = requestAnimationFrame(draw)
    }
    draw()

    const canvasStream = canvas.captureStream(30)

    let micStream: MediaStream | null = null

    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor()
        audioContextRef.current = audioContext
        const destination = audioContext.createMediaStreamDestination()

        try {
          const cloneSource = audioContext.createMediaElementSource(cloneVideo)
          cloneSource.connect(destination)
          cloneSource.connect(audioContext.destination)
        } catch {
          /* The element can only be attached once; keep recording video if audio fails. */
        }

        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          micStreamRef.current = micStream
          const micSource = audioContext.createMediaStreamSource(micStream)
          micSource.connect(destination)
        } catch {
          /* Mic audio is best-effort; webcam permissions may already be video-only. */
        }

        destination.stream
          .getAudioTracks()
          .forEach((track) => canvasStream.addTrack(track))
      }
    } catch {
      /* Keep a silent composite rather than failing the final recording. */
    }

    const mimeType = pickRecorderMimeType()
    const blobType = blobTypeFor(mimeType)

    const recorderOptions: MediaRecorderOptions = {
      videoBitsPerSecond: 3_000_000,
      audioBitsPerSecond: 128_000,
    }
    if (mimeType) recorderOptions.mimeType = mimeType

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(canvasStream, recorderOptions)
    } catch (err) {
      console.warn("[reaction-step] composite recorder unsupported", err)
      setUploadError(copy.common.uploadReactionError)
      recordingStartedRef.current = false
      if (drawFrameRef.current) {
        cancelAnimationFrame(drawFrameRef.current)
        drawFrameRef.current = null
      }
      micStreamRef.current?.getTracks().forEach((track) => track.stop())
      micStreamRef.current = null
      audioContextRef.current?.close().catch(() => {})
      audioContextRef.current = null
      return
    }
    mediaRecorderRef.current = recorder

    const captureStream = (
      reactionVideo as HTMLVideoElement & {
        captureStream?: (frameRate?: number) => MediaStream
        mozCaptureStream?: (frameRate?: number) => MediaStream
      }
    ).captureStream ?? (
      reactionVideo as HTMLVideoElement & {
        mozCaptureStream?: (frameRate?: number) => MediaStream
      }
    ).mozCaptureStream
    const rawStream = captureStream?.call(reactionVideo, 30)
    if (rawStream) {
      micStream
        ?.getAudioTracks()
        .forEach((track) => rawStream.addTrack(track))
      const rawOptions: MediaRecorderOptions = {
        videoBitsPerSecond: 1_500_000,
        audioBitsPerSecond: 96_000,
      }
      if (mimeType) rawOptions.mimeType = mimeType
      try {
        const rawRecorder = new MediaRecorder(rawStream, rawOptions)
        rawReactionRecorderRef.current = rawRecorder
        rawRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) rawReactionChunksRef.current.push(e.data)
        }
        rawRecorder.onstop = () => {
          const blob = new Blob(rawReactionChunksRef.current, { type: blobType })
          setRawReactionBlob(blob)
        }
        rawRecorder.start(250)
      } catch (err) {
        console.warn("[reaction-step] raw recorder unsupported", err)
      }
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      if (drawFrameRef.current) {
        cancelAnimationFrame(drawFrameRef.current)
        drawFrameRef.current = null
      }
      micStreamRef.current?.getTracks().forEach((track) => track.stop())
      micStreamRef.current = null
      audioContextRef.current?.close().catch(() => {})
      audioContextRef.current = null
      const blob = new Blob(chunksRef.current, { type: blobType })
      setRecordingBlob(blob)
      setRecordingUrl(URL.createObjectURL(blob))
    }

    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume().catch(() => {})
    }
    recorder.start(250)
    setIsRecording(true)
    try {
      cloneVideo.currentTime = 0
    } catch {
      /* Some streamed videos do not allow seeking before playback starts. */
    }
    await cloneVideo.play().catch(async () => {
      cloneVideo.muted = true
      await cloneVideo.play()
    })
  }, [archiveDisplayLabel, cloneVideoUrl, videoRef, copy.common.uploadReactionError])

  useEffect(() => {
    if (!isActive || !cloneVideoUrl) return
    const cloneVideo = cloneVideoRef.current
    if (!cloneVideo) return

    const start = () => {
      void startCompositeRecording()
    }

    if (cloneVideo.readyState >= 2) {
      start()
    } else {
      cloneVideo.addEventListener("canplay", start, { once: true })
      return () => cloneVideo.removeEventListener("canplay", start)
    }
  }, [cloneVideoUrl, isActive, startCompositeRecording])

  useEffect(() => {
    if (!recordingBlob) return

    const gen = ++uploadGenRef.current

    ;(async () => {
      try {
        setUploadError(null)
        const filename =
          recordingBlob.type.includes("mp4") ? "final.mp4" : "final.webm"
        const { path, skipped } = await uploadSessionAsset(
          sessionId,
          "final",
          recordingBlob,
          filename
        )
        if (gen !== uploadGenRef.current) return
        onReactionUploaded?.(skipped ? null : path)
      } catch (err) {
        if (gen !== uploadGenRef.current) return
        const message =
          err instanceof Error ? err.message : copy.common.uploadReactionError
        console.warn("[reaction-step] final upload failed", message)
        setUploadError(message)
        onReactionUploaded?.(null)
      }
    })()
  }, [recordingBlob, sessionId, onReactionUploaded, copy.common.uploadReactionError])

  useEffect(() => {
    if (!rawReactionBlob) return

    const gen = ++rawUploadGenRef.current

    ;(async () => {
      try {
        const filename =
          rawReactionBlob.type.includes("mp4") ? "reaction.mp4" : "reaction.webm"
        await uploadSessionAsset(
          sessionId,
          "reaction",
          rawReactionBlob,
          filename
        )
        if (gen !== rawUploadGenRef.current) return
      } catch (err) {
        if (gen !== rawUploadGenRef.current) return
        console.warn(
          "[reaction-step] raw reaction upload failed",
          err instanceof Error ? err.message : copy.common.uploadRawReactionError
        )
      }
    })()
  }, [rawReactionBlob, sessionId, copy.common.uploadRawReactionError])

  return (
    <div className="relative flex h-[100svh] min-h-0 w-full flex-1 flex-col bg-black">
      <div
        className={`flex min-h-0 w-full flex-1 ${
          isTouch ? "flex-col" : "flex-row"
        }`}
      >
        <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
          <div className="absolute inset-0">
            {error ? (
              <div className="h-full w-full bg-black" />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
            )}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
          <div className="absolute inset-0">
            {cloneVideoUrl ? (
              <>
                <video
                  ref={cloneVideoRef}
                  src={cloneVideoUrl}
                  crossOrigin="anonymous"
                  className={`h-full w-full object-cover transition-opacity duration-200 ${
                    archiveStartedAt === null ? "opacity-100" : "opacity-0"
                  }`}
                  playsInline
                  preload="auto"
                  onEnded={handleCloneVideoEnded}
                />
                {archiveStartedAt !== null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#020202]">
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
                    {archiveDisplay.text && (
                      <GlitchText
                        text={archiveDisplay.text}
                        glitch={archiveDisplay.glitch}
                        clock={archiveClock}
                      />
                    )}
                  </div>
                )}
              </>
            ) : photoPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreviewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-black" />
            )}
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={COMPOSITE_WIDTH}
        height={COMPOSITE_HEIGHT}
        className="hidden"
      />

      {uploadError && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-red-950/90 px-4 py-3 text-center text-sm text-red-200">
          {uploadError}
        </div>
      )}
    </div>
  )
}
