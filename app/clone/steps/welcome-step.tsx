"use client"

import { useState } from "react"
import Link from "next/link"

import { Stack } from "@/components/layout/stack"
import { Heading } from "@/components/typography/heading"
import { Text } from "@/components/typography/text"
import { Button } from "@/components/ui/button"
import type { UiCopy } from "@/lib/cloner/ui-copy"

export function WelcomeStep({
  onNext,
  copy,
}: {
  onNext: () => void
  copy: UiCopy
}) {
  const [agreed, setAgreed] = useState(false)

  return (
    <Stack gap="section" className="items-center text-center">
      <Stack gap="stack" className="items-center">
        <Heading variant="display">{copy.welcome.title}</Heading>
        <Text variant="lead" className="max-w-md">
          {copy.welcome.lead}
        </Text>
        <Text variant="muted" className="max-w-sm">
          {copy.welcome.description}
        </Text>
      </Stack>

      <Stack gap="stack" className="items-center">
        <Button
          size="lg"
          disabled={!agreed}
          onClick={onNext}
          className="px-8 py-6 text-base"
        >
          {copy.welcome.cta}
        </Button>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="size-4 accent-primary rounded"
          />
          <Text variant="small" as="span">
            {copy.welcome.consentPrefix}
            <Link
              href="/terms"
              target="_blank"
              className="underline underline-offset-4 hover:text-primary"
            >
              {copy.welcome.terms}
            </Link>
          </Text>
        </label>
      </Stack>
    </Stack>
  )
}
