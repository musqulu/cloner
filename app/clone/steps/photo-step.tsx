"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Camera,
  RotateCcw,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Info,
} from "lucide-react"

import { Stack } from "@/components/layout/stack"
import { Inline } from "@/components/layout/inline"
import { Heading } from "@/components/typography/heading"
import { Text } from "@/components/typography/text"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useWebcam } from "@/hooks/use-webcam"
import { useFaceDetection } from "@/hooks/use-face-detection"
import type { UiCopy } from "@/lib/cloner/ui-copy"

type ValidationState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "success" }
  | { status: "no-face" }

export function PhotoStep({
  onPhotoContinue,
  voiceVerificationNotice = false,
  copy,
}: {
  onPhotoContinue: (blob: Blob) => Promise<void>
  voiceVerificationNotice?: boolean
  copy: UiCopy
}) {
  const { videoRef, isActive, error, start, stop, capture } = useWebcam({
    permissionDeniedMessage: copy.photo.cameraDenied,
    unavailableMessage: copy.photo.cameraUnavailable,
  })
  const { isModelLoaded, detectFace } = useFaceDetection()
  const imgRef = useRef<HTMLImageElement>(null)

  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [validation, setValidation] = useState<ValidationState>({ status: "idle" })
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    start()
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runValidation = useCallback(
    async (url: string) => {
      setValidation({ status: "validating" })

      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = url

      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
      })

      const result = await detectFace(img)

      if (result.detected) {
        setValidation({ status: "success" })
      } else {
        setValidation({ status: "no-face" })
      }
    },
    [detectFace]
  )

  const handleCapture = async () => {
    const blob = capture()
    if (!blob) return

    const url = URL.createObjectURL(blob)
    setCapturedBlob(blob)
    setCapturedUrl(url)
    stop()

    await runValidation(url)
  }

  const handleRetake = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    setCapturedUrl(null)
    setCapturedBlob(null)
    setValidation({ status: "idle" })
    start()
  }

  const handleNext = async () => {
    if (!capturedBlob) return
    setUploadError(null)
    setIsUploading(true)
    try {
      await onPhotoContinue(capturedBlob)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : copy.common.uploadPhotoError)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Stack gap="stack" className="items-center text-center">
      <Heading variant="subtitle">{copy.photo.title}</Heading>
      <Text variant="muted">{copy.photo.description}</Text>

      {voiceVerificationNotice && (
        <Alert className="w-full max-w-lg text-left">
          <Info className="size-4" />
          <AlertTitle>{copy.photo.voiceVerificationTitle}</AlertTitle>
          <AlertDescription>
            {copy.photo.voiceVerification}{" "}
            <a
              href="https://elevenlabs.io/app/voice-lab"
              target="_blank"
              rel="noopener noreferrer"
            >
              ElevenLabs Voice Lab
            </a>
            .
          </AlertDescription>
        </Alert>
      )}

      <div className="relative w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden bg-muted ring-1 ring-foreground/10">
        {error ? (
          <div className="flex items-center justify-center h-full p-6">
            <Text variant="muted" className="text-destructive">
              {error}
            </Text>
          </div>
        ) : capturedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={capturedUrl}
            alt={copy.photo.capturedAlt}
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
            style={{ transform: "scaleX(-1)" }}
          />
        )}

        {!capturedUrl && isActive && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-8 rounded-full border-2 border-white/30" />
          </div>
        )}

        {validation.status === "validating" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <div className="flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 ring-1 ring-foreground/10">
              <Loader2 className="size-4 animate-spin" />
              <Text variant="small" as="span">{copy.photo.checkingFace}</Text>
            </div>
          </div>
        )}

        {validation.status === "no-face" && (
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-destructive/90 px-4 py-3 text-white">
            <AlertTriangle className="size-4 shrink-0" />
            <Text variant="small" as="span" className="text-white text-left">
              {copy.photo.noFace}
            </Text>
          </div>
        )}
      </div>

      {!isModelLoaded && !capturedUrl && (
        <Text variant="muted" className="text-xs flex items-center gap-1.5">
          <Loader2 className="size-3 animate-spin" />
          {copy.photo.loadingFaceDetection}
        </Text>
      )}

      {uploadError && (
        <Text variant="small" className="text-destructive max-w-sm">
          {uploadError}
        </Text>
      )}

      {capturedUrl ? (
        validation.status === "validating" ? (
          <Button disabled>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            {copy.common.validating}
          </Button>
        ) : validation.status === "no-face" ? (
          <Button variant="outline" onClick={handleRetake}>
            <RotateCcw data-icon="inline-start" />
            {copy.photo.retakePhoto}
          </Button>
        ) : (
          <Inline gap="inline">
            <Button variant="outline" onClick={handleRetake} disabled={isUploading}>
              <RotateCcw data-icon="inline-start" />
              {copy.photo.retake}
            </Button>
            <Button onClick={handleNext} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  {copy.common.saving}
                </>
              ) : (
                <>
                  {copy.common.next}
                  <ArrowRight data-icon="inline-end" />
                </>
              )}
            </Button>
          </Inline>
        )
      ) : (
        <Button onClick={handleCapture} disabled={!isActive}>
          <Camera data-icon="inline-start" />
          {copy.photo.takePhoto}
        </Button>
      )}
    </Stack>
  )
}
