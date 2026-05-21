"use client"

import { useState } from "react"
import { ArrowRight } from "lucide-react"

import { Stack } from "@/components/layout/stack"
import { Heading } from "@/components/typography/heading"
import { Text } from "@/components/typography/text"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { UiCopy } from "@/lib/cloner/ui-copy"

const MIN_LENGTH = 50

export function TruthStep({
  onContinue,
  onTruthChange,
  initialValue,
  copy,
}: {
  onContinue: (personalTruth: string) => void
  onTruthChange: (text: string) => void
  initialValue: string
  copy: UiCopy
}) {
  const [text, setText] = useState(initialValue)
  const isValid = text.trim().length >= MIN_LENGTH

  const handleContinue = () => {
    if (!isValid) return
    onContinue(text.trim())
  }

  const handleChange = (value: string) => {
    setText(value)
    onTruthChange(value)
  }

  return (
    <Stack gap="stack" className="items-center text-center">
      <Heading variant="subtitle">{copy.truth.title}</Heading>
      <Text variant="muted" className="max-w-md">
        {copy.truth.description}
      </Text>

      <div className="w-full max-w-lg">
        <Textarea
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={copy.truth.placeholder}
          className="min-h-32 text-base"
        />
        <Text
          variant="muted"
          className={`mt-2 text-right tabular-nums ${
            text.trim().length > 0 && !isValid ? "text-destructive" : ""
          }`}
        >
          {text.trim().length} / {MIN_LENGTH} {copy.truth.minCharacters}
        </Text>
      </div>

      <div className="flex flex-wrap gap-2 w-full max-w-lg justify-start">
        {copy.truth.examples.map((example) => (
          <button
            key={example}
            onClick={() => handleChange(example)}
            className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>

      <Button
        size="lg"
        disabled={!isValid}
        onClick={handleContinue}
        className="w-full max-w-lg h-12 text-base font-semibold"
      >
        {copy.common.next}
        <ArrowRight data-icon="inline-end" />
      </Button>
    </Stack>
  )
}
