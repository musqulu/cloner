"use client"

import { useEffect, useRef, useState } from "react"

import { GlitchText } from "@/components/cloner/glitch-text"
import {
  getGlitchSequenceDuration,
  getGlitchSequenceState,
} from "@/lib/cloner/glitch-display"

export function GlitchInterstitial({
  messages,
  finalLabel,
  onComplete,
  className = "fixed inset-0 z-50",
}: {
  messages: readonly string[]
  finalLabel?: string | null
  onComplete: () => void
  className?: string
}) {
  const [startedAt] = useState(() => performance.now())
  const [clock, setClock] = useState(startedAt)
  const completedRef = useRef(false)

  useEffect(() => {
    let frame: number | null = null

    const tick = (now: number) => {
      setClock(now)
      const state = getGlitchSequenceState(
        startedAt,
        now,
        messages,
        finalLabel
      )
      if (state.complete && !completedRef.current) {
        completedRef.current = true
        onComplete()
        return
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    const timeout = window.setTimeout(
      () => {
        if (!completedRef.current) {
          completedRef.current = true
          onComplete()
        }
      },
      getGlitchSequenceDuration(messages.length, Boolean(finalLabel)) + 250
    )

    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [finalLabel, messages, onComplete, startedAt])

  const display = getGlitchSequenceState(startedAt, clock, messages, finalLabel)

  return (
    <div className={`${className} flex items-center justify-center bg-[#020202]`}>
      <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
      {display.text && (
        <GlitchText text={display.text} glitch={display.glitch} clock={clock} />
      )}
    </div>
  )
}
