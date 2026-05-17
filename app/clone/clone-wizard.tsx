"use client"

import { useCallback, useState } from "react"

import { Container } from "@/components/layout/container"
import { Text } from "@/components/typography/text"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cloneVoiceFromBlob } from "@/lib/cloner/clone-voice"
import { ENABLE_VOICE_CLONE } from "@/lib/cloner/flags"
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS } from "@/lib/cloner/languages"
import { getUiCopy } from "@/lib/cloner/ui-copy"
import { uploadSessionAsset } from "@/lib/cloner/upload-session-asset"
import { WelcomeStep } from "./steps/welcome-step"
import { PhotoStep } from "./steps/photo-step"
import { VoiceStep } from "./steps/voice-step"
import { TruthStep } from "./steps/truth-step"
import { LoadingStep } from "./steps/loading-step"
import { ReactionStep } from "./steps/reaction-step"

type CloneData = {
  photo: Blob | null
  audioRecording: Blob | null
  personalTruth: string
  language: string
  generatedScript: string
  generatedScriptLanguage: string | null
  cloneVideoUrl: string | null
  cloneVideoPath: string | null
  photoStoragePath: string | null
  audioStoragePath: string | null
  reactionStoragePath: string | null
  elevenLabsVoiceId: string | null
  elevenLabsVoiceRequiresVerification: boolean
  generationWarning: string | null
}

/** Numbered steps after welcome: details → voice → image. Loading/result are not steps. */
const MAIN_STEP_COUNT = 3

function StepIndicator({
  currentStep,
  totalSteps,
}: {
  /** 0-based index within the main steps (0 = first, totalSteps - 1 = last). */
  currentStep: number
  totalSteps: number
}) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`
              flex items-center justify-center size-8 rounded-full text-xs font-medium transition-colors
              ${
                i < currentStep
                  ? "bg-primary text-primary-foreground"
                  : i === currentStep
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                    : "bg-muted text-muted-foreground"
              }
            `}
          >
            {i < currentStep ? "✓" : i + 1}
          </div>
          {i < totalSteps - 1 && (
            <div
              className={`h-0.5 w-6 transition-colors ${
                i < currentStep ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function LanguagePicker({
  value,
  disabled,
  onChange,
  label,
  ariaLabel,
  placeholder,
}: {
  value: string
  disabled?: boolean
  onChange: (language: string) => void
  label: string
  ariaLabel: string
  placeholder: string
}) {
  return (
    <div className="fixed right-3 top-3 z-50 flex items-center gap-2 rounded-lg border border-border bg-background/90 p-1.5 shadow-sm backdrop-blur md:right-4 md:top-4">
      <Text
        variant="small"
        as="span"
        className="hidden whitespace-nowrap font-medium text-muted-foreground sm:inline"
      >
        {label}
      </Text>
      <Select
        value={value}
        onValueChange={(language) => {
          if (language) onChange(language)
        }}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={ariaLabel}
          size="sm"
          className="w-36 bg-background"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent align="end">
          {LANGUAGE_OPTIONS.map(({ code, label }) => (
            <SelectItem key={code} value={code}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function CloneWizard() {
  const [step, setStep] = useState(0)
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID())
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  const [data, setData] = useState<CloneData>({
    photo: null,
    audioRecording: null,
    personalTruth: "",
    language: DEFAULT_LANGUAGE,
    generatedScript: "",
    generatedScriptLanguage: null,
    cloneVideoUrl: null,
    cloneVideoPath: null,
    photoStoragePath: null,
    audioStoragePath: null,
    reactionStoragePath: null,
    elevenLabsVoiceId: null,
    elevenLabsVoiceRequiresVerification: false,
    generationWarning: null,
  })
  const copy = getUiCopy(data.language)

  const goNext = useCallback(() => setStep((s) => s + 1), [])

  const handleLanguageChange = useCallback((language: string) => {
    setData((d) => ({
      ...d,
      language,
      generatedScript:
        d.generatedScriptLanguage === language ? d.generatedScript : "",
      generatedScriptLanguage:
        d.generatedScriptLanguage === language ? d.generatedScriptLanguage : null,
    }))
  }, [])

  const handleTruthContinue = useCallback(
    (personalTruth: string) => {
      setData((d) => ({ ...d, personalTruth }))
      goNext()
      void (async () => {
        try {
          const res = await fetch("/api/generate-tts-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personalTruth,
              language: data.language,
            }),
          })
          const payload = (await res.json()) as {
            script?: string
            error?: string
            warning?: string
            source?: string
          }
          if (res.ok && typeof payload.script === "string") {
            setData((d) => ({
              ...d,
              generatedScript: payload.script ?? "",
              generatedScriptLanguage: data.language,
            }))
            if (process.env.NODE_ENV === "development") {
              console.log("[generate-tts-script client]", {
                source: payload.source ?? "unknown",
                script: payload.script,
                warning: payload.warning,
              })
            }
          } else {
            if (process.env.NODE_ENV === "development") {
              console.warn("[generate-tts-script]", payload.error ?? res.status)
            }
            setData((d) => ({
              ...d,
              generatedScript: "",
              generatedScriptLanguage: null,
            }))
          }
        } catch (e) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[generate-tts-script]", e)
          }
          setData((d) => ({
            ...d,
            generatedScript: "",
            generatedScriptLanguage: null,
          }))
        }
      })()
    },
    [data.language, goNext]
  )

  const handleReset = useCallback(() => {
    setStep(0)
    setIsVoiceRecording(false)
    setSessionId(crypto.randomUUID())
    setData({
      photo: null,
      audioRecording: null,
      personalTruth: "",
      language: DEFAULT_LANGUAGE,
      generatedScript: "",
      generatedScriptLanguage: null,
      cloneVideoUrl: null,
      cloneVideoPath: null,
      photoStoragePath: null,
      audioStoragePath: null,
      reactionStoragePath: null,
      elevenLabsVoiceId: null,
      elevenLabsVoiceRequiresVerification: false,
      generationWarning: null,
    })
  }, [])

  const handlePhotoContinue = useCallback(
    async (blob: Blob) => {
      setData((d) => ({ ...d, photo: blob }))
      const { path } = await uploadSessionAsset(sessionId, "photo", blob, "photo.png")
      setData((d) => ({ ...d, photo: blob, photoStoragePath: path }))
      setStep((s) => s + 1)
    },
    [sessionId]
  )

  const handleVoiceContinue = useCallback(
    async (
      blob: Blob,
      language: string,
      onPhase?: (phase: "upload" | "clone") => void
    ) => {
      onPhase?.("upload")
      setData((d) => ({ ...d, audioRecording: blob }))
      const { path } = await uploadSessionAsset(sessionId, "voice", blob, "voice.webm")
      setData((d) => ({ ...d, audioRecording: blob, audioStoragePath: path }))
      if (ENABLE_VOICE_CLONE) {
        onPhase?.("clone")
        const { voiceId, requiresVerification } = await cloneVoiceFromBlob(
          sessionId,
          blob,
          language
        )
        setData((d) => ({
          ...d,
          audioRecording: blob,
          audioStoragePath: path,
          elevenLabsVoiceId: voiceId,
          elevenLabsVoiceRequiresVerification: requiresVerification,
        }))
      } else {
        setData((d) => ({
          ...d,
          elevenLabsVoiceId: null,
          elevenLabsVoiceRequiresVerification: false,
        }))
      }
      setStep((s) => s + 1)
    },
    [sessionId]
  )

  const handleLoadingComplete = useCallback(
    (
      generatedScript: string,
      cloneVideoUrl: string | null,
      cloneVideoPath: string | null,
      generationWarning?: string | null
    ) => {
      setData((d) => ({
        ...d,
        generatedScript,
        generatedScriptLanguage: d.language,
        cloneVideoUrl,
        cloneVideoPath,
        generationWarning: generationWarning ?? null,
      }))
      setStep(5)
    },
    []
  )

  const handleReactionUploaded = useCallback((path: string | null) => {
    setData((d) => ({ ...d, reactionStoragePath: path }))
  }, [])

  return (
    <div className="flex flex-1 flex-col bg-background">
      <LanguagePicker
        value={data.language}
        onChange={handleLanguageChange}
        disabled={step > 2 || (step === 2 && isVoiceRecording)}
        label={copy.language.label}
        ariaLabel={copy.language.ariaLabel}
        placeholder={copy.language.placeholder}
      />
      <Container
        className={
          step === 5
            ? "flex max-w-none flex-1 flex-col px-3 py-4 md:px-4"
            : "flex flex-1 flex-col items-center justify-center py-section"
        }
      >
        {step >= 1 && step <= MAIN_STEP_COUNT && (
          <StepIndicator
            currentStep={step - 1}
            totalSteps={MAIN_STEP_COUNT}
          />
        )}

        <div
          className={
            step === 5
              ? "flex min-h-0 w-full flex-1 flex-col"
              : "w-full max-w-2xl"
          }
        >
          {step === 0 && <WelcomeStep onNext={goNext} copy={copy} />}

          {step === 1 && (
            <TruthStep
              initialValue={data.personalTruth}
              copy={copy}
              onTruthChange={(text) =>
                setData((d) => ({ ...d, personalTruth: text }))
              }
              onContinue={handleTruthContinue}
            />
          )}

          {step === 2 && (
            <VoiceStep
              onVoiceContinue={handleVoiceContinue}
              language={data.language}
              copy={copy}
              onRecordingChange={setIsVoiceRecording}
            />
          )}

          {step === 3 && (
            <PhotoStep
              onPhotoContinue={handlePhotoContinue}
              voiceVerificationNotice={data.elevenLabsVoiceRequiresVerification}
              copy={copy}
            />
          )}

          {step === 4 && (
            <LoadingStep
              cloneData={{
                photo: data.photo,
                personalTruth: data.personalTruth,
                language: data.language,
                existingScript:
                  data.generatedScriptLanguage === data.language
                    ? data.generatedScript
                    : "",
                existingScriptLanguage: data.generatedScriptLanguage,
                sessionId,
                photoStoragePath: data.photoStoragePath,
                elevenLabsVoiceId: data.elevenLabsVoiceId,
              }}
              copy={copy}
              onComplete={handleLoadingComplete}
            />
          )}

          {step === 5 && (
            <ReactionStep
              onReset={handleReset}
              generatedScript={data.generatedScript}
              cloneVideoUrl={data.cloneVideoUrl}
              generationWarning={data.generationWarning}
              photo={data.photo}
              sessionId={sessionId}
              copy={copy}
              onReactionUploaded={handleReactionUploaded}
            />
          )}
        </div>
      </Container>
    </div>
  )
}
