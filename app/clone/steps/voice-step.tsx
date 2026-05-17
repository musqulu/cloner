"use client"

import { useEffect, useState } from "react"
import {
  Mic,
  Square,
  RotateCcw,
  ArrowRight,
  EarOff,
  Headphones,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react"

import { Stack } from "@/components/layout/stack"
import { Inline } from "@/components/layout/inline"
import { Heading } from "@/components/typography/heading"
import { Text } from "@/components/typography/text"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAudioRecorder } from "@/hooks/use-audio-recorder"
import { READINGS } from "@/lib/cloner/readings"
import type { UiCopy } from "@/lib/cloner/ui-copy"

const MIN_DURATION = 10

const TIP_ICONS = [EarOff, Mic, Headphones]

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function VoiceStep({
  onVoiceContinue,
  language,
  copy,
  onRecordingChange,
}: {
  onVoiceContinue: (
    blob: Blob,
    language: string,
    onPhase?: (phase: "upload" | "clone") => void
  ) => Promise<void>
  language: string
  copy: UiCopy
  onRecordingChange?: (isRecording: boolean) => void
}) {
  const {
    isRecording,
    audioBlob,
    audioUrl,
    duration,
    error,
    startRecording,
    stopRecording,
    reset,
  } = useAudioRecorder({
    permissionDeniedMessage: copy.voice.micDenied,
    unavailableMessage: copy.voice.micUnavailable,
  })

  const meetsMinDuration = duration >= MIN_DURATION
  const currentReading = READINGS[language] ?? READINGS.pl
  const [isUploading, setIsUploading] = useState(false)
  const [uploadPhase, setUploadPhase] = useState<"upload" | "clone" | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    onRecordingChange?.(isRecording)
    return () => onRecordingChange?.(false)
  }, [isRecording, onRecordingChange])

  const handleNext = async () => {
    if (!audioBlob || !meetsMinDuration) return
    setUploadError(null)
    setIsUploading(true)
    setUploadPhase(null)
    try {
      await onVoiceContinue(audioBlob, language, (phase) => setUploadPhase(phase))
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : copy.common.uploadRecordingError)
    } finally {
      setIsUploading(false)
      setUploadPhase(null)
    }
  }

  return (
    <Stack gap="stack" className="items-center text-center">
      <Heading variant="subtitle">{copy.voice.title}</Heading>
      <Text variant="muted" className="max-w-md">
        {copy.voice.description}
      </Text>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
        {copy.voice.tips.map((tip, index) => {
          const TipIcon = TIP_ICONS[index] ?? Mic
          return (
            <div key={tip.title} className="flex flex-col items-center gap-2 p-4">
              <TipIcon className="size-5 text-muted-foreground" />
              <Text variant="small" as="span" className="font-medium text-foreground">
                {tip.title}
              </Text>
              <Text variant="muted" className="text-xs leading-relaxed">
                {tip.description}
              </Text>
            </div>
          )
        })}
      </div>

      <Card className="w-full max-w-lg text-left">
        <CardContent>
          <Text variant="body" className="leading-relaxed italic">
            &ldquo;{currentReading.passage}&rdquo;
          </Text>
          {currentReading.attribution && (
            <Text variant="small" className="mt-3 text-muted-foreground">
              {currentReading.attribution}
            </Text>
          )}
        </CardContent>
      </Card>

      {error && (
        <Text variant="small" className="text-destructive">
          {error}
        </Text>
      )}

      {uploadError && (
        <Text variant="small" className="text-destructive max-w-sm text-center">
          {uploadError}
        </Text>
      )}

      {isRecording && (
        <Stack gap="tight" className="items-center">
          <Inline gap="tight" className="items-center">
            <span className="relative flex size-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full size-3 bg-destructive" />
            </span>
            <Text variant="body" as="span" className="tabular-nums font-mono">
              {formatTime(duration)}
            </Text>
          </Inline>
          {!meetsMinDuration && (
            <Text variant="muted" className="text-xs">
              {copy.voice.keepReading} {MIN_DURATION - duration}
              {copy.voice.secondsLeft}
            </Text>
          )}
        </Stack>
      )}

      <Inline gap="tight" className="items-center">
        {meetsMinDuration ? (
          <CheckCircle2 className="size-4 text-primary" />
        ) : (
          <Circle className="size-4 text-muted-foreground" />
        )}
        <Text
          variant="small"
          as="span"
          className={meetsMinDuration ? "text-primary font-medium" : "text-muted-foreground"}
        >
          {MIN_DURATION} {copy.voice.secondsRequired}
        </Text>
      </Inline>

      {audioUrl && !isRecording ? (
        <Stack gap="stack" className="items-center w-full max-w-sm">
          <audio src={audioUrl} controls className="w-full" />
          <Text variant="muted">
            {copy.voice.recording} {formatTime(duration)}
          </Text>
          {!meetsMinDuration && (
            <Text variant="small" className="text-destructive">
              {copy.voice.tooShort} {MIN_DURATION} {copy.voice.seconds}
            </Text>
          )}
          <Inline gap="inline">
            <Button variant="outline" onClick={reset} disabled={isUploading}>
              <RotateCcw data-icon="inline-start" />
              {copy.voice.reRecord}
            </Button>
            <Button onClick={handleNext} disabled={!meetsMinDuration || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  {uploadPhase === "clone" ? copy.voice.creatingVoice : copy.common.saving}
                </>
              ) : (
                <>
                  {copy.common.next}
                  <ArrowRight data-icon="inline-end" />
                </>
              )}
            </Button>
          </Inline>
        </Stack>
      ) : isRecording ? (
        <Button
          variant="destructive"
          onClick={stopRecording}
          disabled={!meetsMinDuration}
        >
          <Square data-icon="inline-start" className="size-3 fill-current" />
          {meetsMinDuration
            ? copy.voice.stopRecording
            : `${copy.voice.recordingLeft} ${MIN_DURATION - duration}${copy.voice.secondsLeft}`}
        </Button>
      ) : (
        <Button onClick={startRecording}>
          <Mic data-icon="inline-start" />
          {copy.voice.startRecording}
        </Button>
      )}
    </Stack>
  )
}
