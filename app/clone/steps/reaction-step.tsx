"use client"

import { useEffect, useRef, useCallback, useMemo, useState } from "react"
import { Download, RotateCcw, Loader2 } from "lucide-react"

import { Stack } from "@/components/layout/stack"
import { Inline } from "@/components/layout/inline"
import { Heading } from "@/components/typography/heading"
import { Text } from "@/components/typography/text"
import { Button } from "@/components/ui/button"
import { useWebcam } from "@/hooks/use-webcam"
import { uploadSessionAsset } from "@/lib/cloner/upload-session-asset"
import type { UiCopy } from "@/lib/cloner/ui-copy"

const FALLBACK_RECORDING_MS = 18_000
const POST_AVATAR_REACTION_MS = 5_000
const COMPOSITE_WIDTH = 1920
const COMPOSITE_HEIGHT = 1080

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

export function ReactionStep({
  onReset,
  generatedScript,
  cloneVideoUrl,
  generationWarning,
  photo,
  sessionId,
  copy,
  onReactionUploaded,
}: {
  onReset: () => void
  generatedScript: string
  cloneVideoUrl: string | null
  generationWarning?: string | null
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
  const [isRecording, setIsRecording] = useState(false)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null)
  const [rawReactionBlob, setRawReactionBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const rawReactionRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const rawReactionChunksRef = useRef<Blob[]>([])
  const drawFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recordingStartedRef = useRef(false)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const postAvatarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cloneVideoRef = useRef<HTMLVideoElement>(null)
  const [isSavingReaction, setIsSavingReaction] = useState(false)
  const [isSavingRawReaction, setIsSavingRawReaction] = useState(false)
  const [savedFinalPath, setSavedFinalPath] = useState<string | null>(null)
  const [savedRawReactionPath, setSavedRawReactionPath] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const uploadGenRef = useRef(0)
  const rawUploadGenRef = useRef(0)

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
    postAvatarTimerRef.current = setTimeout(() => {
      finishRecording()
    }, POST_AVATAR_REACTION_MS)
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
    chunksRef.current = []
    rawReactionChunksRef.current = []

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const draw = () => {
      ctx.fillStyle = "black"
      ctx.fillRect(0, 0, COMPOSITE_WIDTH, COMPOSITE_HEIGHT)
      drawVideoContain(ctx, reactionVideo, 0, 0, COMPOSITE_WIDTH / 2, COMPOSITE_HEIGHT, {
        mirror: true,
      })
      drawVideoContain(
        ctx,
        cloneVideo,
        COMPOSITE_WIDTH / 2,
        0,
        COMPOSITE_WIDTH / 2,
        COMPOSITE_HEIGHT
      )
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

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm"
    const recorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: 3_000_000,
      audioBitsPerSecond: 128_000,
    })
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
      const rawRecorder = new MediaRecorder(rawStream, {
        mimeType,
        videoBitsPerSecond: 1_500_000,
        audioBitsPerSecond: 96_000,
      })
      rawReactionRecorderRef.current = rawRecorder
      rawRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) rawReactionChunksRef.current.push(e.data)
      }
      rawRecorder.onstop = () => {
        const blob = new Blob(rawReactionChunksRef.current, { type: mimeType })
        setRawReactionBlob(blob)
      }
      rawRecorder.start(250)
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
      const blob = new Blob(chunksRef.current, { type: mimeType })
      setRecordingBlob(blob)
      setRecordingUrl(URL.createObjectURL(blob))
    }

    recorder.start(250)
    setIsRecording(true)
    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume().catch(() => {})
    }
    try {
      cloneVideo.currentTime = 0
    } catch {
      /* Some streamed videos do not allow seeking before playback starts. */
    }
    await cloneVideo.play().catch(async () => {
      cloneVideo.muted = true
      await cloneVideo.play()
    })
  }, [cloneVideoUrl, videoRef])

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
    setUploadError(null)
    setIsSavingReaction(true)

    ;(async () => {
      try {
        const filename =
          recordingBlob.type.includes("mp4") ? "final.mp4" : "final.webm"
        const { path, skipped } = await uploadSessionAsset(
          sessionId,
          "final",
          recordingBlob,
          filename
        )
        if (gen !== uploadGenRef.current) return
        setSavedFinalPath(skipped ? null : path)
        onReactionUploaded?.(skipped ? null : path)
      } catch (err) {
        if (gen !== uploadGenRef.current) return
        setUploadError(
          err instanceof Error ? err.message : copy.common.uploadReactionError
        )
        onReactionUploaded?.(null)
      } finally {
        if (gen === uploadGenRef.current) {
          setIsSavingReaction(false)
        }
      }
    })()
  }, [recordingBlob, sessionId, onReactionUploaded, copy.common.uploadReactionError])

  useEffect(() => {
    if (!rawReactionBlob) return

    const gen = ++rawUploadGenRef.current
    setIsSavingRawReaction(true)

    ;(async () => {
      try {
        const filename =
          rawReactionBlob.type.includes("mp4") ? "reaction.mp4" : "reaction.webm"
        const { path, skipped } = await uploadSessionAsset(
          sessionId,
          "reaction",
          rawReactionBlob,
          filename
        )
        if (gen !== rawUploadGenRef.current) return
        setSavedRawReactionPath(skipped ? null : path)
      } catch (err) {
        if (gen !== rawUploadGenRef.current) return
        setUploadError(
          err instanceof Error ? err.message : copy.common.uploadRawReactionError
        )
      } finally {
        if (gen === rawUploadGenRef.current) {
          setIsSavingRawReaction(false)
        }
      }
    })()
  }, [rawReactionBlob, sessionId, copy.common.uploadRawReactionError])

  const handleStartOver = () => {
    finishRecording()
    onReset()
  }

  const download = useCallback(() => {
    if (!recordingUrl) return
    const a = document.createElement("a")
    a.href = recordingUrl
    a.download = `cloner-final-${Date.now()}.webm`
    a.click()
  }, [recordingUrl])

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <div className="shrink-0 space-y-1 px-2 text-center">
        <Heading variant="subtitle">{copy.reaction.title}</Heading>
        <Text variant="muted">
          {cloneVideoUrl
            ? copy.reaction.description
            : copy.reaction.fallbackDescription}
        </Text>
        {!cloneVideoUrl && generationWarning && (
          <Text variant="small" className="mx-auto max-w-2xl text-destructive">
            {generationWarning}
          </Text>
        )}
      </div>

      <div className="grid min-h-0 w-full flex-1 grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-4 min-h-[min(85dvh,56rem)]">
        {/* Live participant tile */}
        <div className="relative min-h-[40dvh] overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 lg:min-h-0">
          <div className="absolute top-4 left-4 z-10 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {copy.reaction.you}
          </div>
          {isRecording && (
            <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-md bg-destructive/90 px-2.5 py-1 text-xs font-medium text-white">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-white" />
              </span>
              {copy.reaction.rec}
            </div>
          )}
          <div className="absolute inset-0">
            {error ? (
              <div className="flex h-full items-center justify-center p-6">
                <Text variant="muted" className="text-center text-destructive">
                  {error}
                </Text>
              </div>
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

        {/* AI clone tile: video when available, otherwise photo and script fallback. */}
        <div className="relative min-h-[40dvh] overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 lg:min-h-0">
          <div className="absolute top-4 left-4 z-10 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {copy.reaction.clone}
          </div>
          <div className="absolute inset-0">
            {cloneVideoUrl ? (
              <video
                ref={cloneVideoRef}
                src={cloneVideoUrl}
                crossOrigin="anonymous"
                className="h-full w-full object-cover"
                playsInline
                preload="auto"
                onEnded={handleCloneVideoEnded}
              />
            ) : photoPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreviewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-muted">
                <Text variant="muted">{copy.reaction.noPreview}</Text>
              </div>
            )}
            {!cloneVideoUrl && generatedScript && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-16">
                <Text variant="small" className="text-left text-white/90 line-clamp-6">
                  {generatedScript}
                </Text>
              </div>
            )}
          </div>
        </div>
      </div>

      <Stack gap="stack" className="shrink-0 items-center">
        <canvas
          ref={canvasRef}
          width={COMPOSITE_WIDTH}
          height={COMPOSITE_HEIGHT}
          className="hidden"
        />
        {(isSavingReaction || isSavingRawReaction) && (
          <Text variant="muted" className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            {copy.reaction.saving}
          </Text>
        )}
        {!isSavingReaction && savedFinalPath && (
          <Text variant="small" className="max-w-md text-center text-muted-foreground">
            {copy.reaction.finalSaved} {savedFinalPath}.
          </Text>
        )}
        {!isSavingRawReaction && savedRawReactionPath && (
          <Text variant="small" className="max-w-md text-center text-muted-foreground">
            {copy.reaction.rawSaved} {savedRawReactionPath}.
          </Text>
        )}
        {uploadError && (
          <Text variant="small" className="max-w-md text-center text-destructive">
            {uploadError} {copy.reaction.downloadFallback}
          </Text>
        )}
        <Inline gap="inline" className="flex-wrap justify-center">
          {recordingUrl && (
            <Button variant="default" onClick={download}>
              <Download data-icon="inline-start" />
              {copy.reaction.download}
            </Button>
          )}
          <Button variant="outline" onClick={handleStartOver}>
            <RotateCcw data-icon="inline-start" />
            {copy.reaction.startOver}
          </Button>
        </Inline>
      </Stack>
    </div>
  )
}
