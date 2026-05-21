export const BLACK_MS = 1_250
export const MESSAGE_MS = 1_500
export const GLITCH_MS = 300
export const MIN_FINAL_MS = 1_000

export type GlitchDisplayState = {
  text: string | null
  glitch: boolean
  complete: boolean
}

export function getGlitchSequenceDuration(
  messageCount: number,
  hasFinalLabel: boolean
) {
  return (
    BLACK_MS +
    messageCount * MESSAGE_MS +
    (hasFinalLabel ? MESSAGE_MS : 0) +
    MIN_FINAL_MS
  )
}

export function getGlitchSequenceState(
  startedAt: number | null,
  now: number,
  messages: readonly string[],
  finalLabel?: string | null
): GlitchDisplayState {
  if (startedAt === null) {
    return { text: null, glitch: false, complete: false }
  }

  const elapsed = now - startedAt
  const totalDuration = getGlitchSequenceDuration(
    messages.length,
    Boolean(finalLabel)
  )

  if (elapsed >= totalDuration) {
    return { text: null, glitch: false, complete: true }
  }

  if (elapsed < BLACK_MS) {
    return { text: null, glitch: false, complete: false }
  }

  let cursor = BLACK_MS
  for (const message of messages) {
    const end = cursor + MESSAGE_MS
    if (elapsed < end) {
      return {
        text: message,
        glitch: elapsed - cursor < GLITCH_MS,
        complete: false,
      }
    }
    cursor = end
  }

  if (finalLabel) {
    const end = cursor + MESSAGE_MS
    if (elapsed < end) {
      return {
        text: finalLabel,
        glitch: elapsed - cursor < GLITCH_MS,
        complete: false,
      }
    }
    cursor = end
  }

  const holdText =
    finalLabel ?? (messages.length > 0 ? messages[messages.length - 1] : null)
  return { text: holdText, glitch: false, complete: false }
}
