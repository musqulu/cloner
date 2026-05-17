import Replicate from "replicate"

const MODEL = "anthropic/claude-4.5-sonnet" as const
const MAX_ATTEMPTS = 3
type TtsScriptResult = {
  script: string
  source: "replicate" | "fallback"
  warning?: string
}

const scriptFlights = new Map<string, Promise<TtsScriptResult>>()

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  pl: "Polish",
}

export const MIN_TRUTH_LENGTH = 50

export function buildTtsScriptPrompt(
  personalTruth: string,
  languageCode: string
): string {
  const langName = LANGUAGE_LABELS[languageCode] ?? languageCode
  return `You are writing a short spoken monologue for text-to-speech (TTS).

The speaker shared this about themselves — use it as inspiration and tone; do not quote it verbatim the whole time:
"""
${personalTruth.trim()}
"""

Requirements:
- Write the monologue in ${langName}.
- Length: about 10 seconds when read aloud at a natural pace (roughly 28–36 words total).
- Plain text only: no markdown, no headings, no bullet points, no stage directions.
- First person, like the speaker's own thought coming back to them: intimate, direct, and a little unsettling.
- Make it more emotionally provocative by naming a hidden contradiction, temptation, fear, or unfinished truth implied by what they shared.
- Keep it restrained: no slurs, sexual content, threats, criminal accusations, self-harm bait, or humiliating insults.
- Do not quote the speaker verbatim except for one short phrase if it truly helps.
- Output only the monologue text, nothing else.`
}

export function fallbackTtsScript(
  personalTruth: string,
  languageCode: string
): string {
  const cleaned = personalTruth
    .replace(/\s+/g, " ")
    .replace(/^["']|["']$/g, "")
    .trim()
  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned
  const base = firstSentence.slice(0, 150).replace(/[.!?]+$/, "")

  const prefixes: Record<string, string> = {
    en: "I keep pretending this is small, but it keeps following me",
    pl: "Udawałem, że to drobiazg, ale to ciągle za mną idzie",
  }

  const suffixes: Record<string, string> = {
    en: "Maybe that says more about me than I wanted to admit.",
    pl: "Może to mówi o mnie więcej, niż chciałem przyznać.",
  }

  return `${prefixes[languageCode] ?? prefixes.en}: ${base}. ${
    suffixes[languageCode] ?? suffixes.en
  }`
}

async function streamScript(replicate: Replicate, prompt: string) {
  let script = ""
  const input = { prompt }

  for await (const event of replicate.stream(MODEL, { input })) {
    script += String(event)
  }

  const trimmed = script.trim()
  if (!trimmed) {
    throw new Error("Replicate returned an empty script.")
  }
  return trimmed
}

export async function generateTtsScript({
  personalTruth,
  language,
}: {
  personalTruth: string
  language: string
}): Promise<TtsScriptResult> {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token?.trim()) {
    throw new Error("REPLICATE_API_TOKEN is not configured.")
  }

  const normalizedTruth = personalTruth.trim()
  const flightKey = `${language}:${normalizedTruth}`
  const existing = scriptFlights.get(flightKey)
  if (existing) return existing

  const flight = (async (): Promise<TtsScriptResult> => {
    const replicate = new Replicate({ auth: token })
    const prompt = buildTtsScriptPrompt(normalizedTruth, language)

    let lastError: unknown
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        console.log("[generate-tts-script] attempt", attempt)
        const script = await streamScript(replicate, prompt)
        console.log("[generate-tts-script] Replicate script:\n", script)
        return { script, source: "replicate" }
      } catch (err) {
        lastError = err
        const message =
          err instanceof Error ? err.message : "Failed to generate script."
        console.warn("[generate-tts-script] attempt failed", {
          attempt,
          message,
        })
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, 750 * attempt))
        }
      }
    }

    const warning =
      lastError instanceof Error ? lastError.message : "Failed to generate script."
    const script = fallbackTtsScript(normalizedTruth, language)
    console.warn("[generate-tts-script] using fallback", { warning })
    return { script, source: "fallback", warning }
  })()

  const cleanup = () => {
    if (scriptFlights.get(flightKey) === flight) {
      scriptFlights.delete(flightKey)
    }
  }
  scriptFlights.set(flightKey, flight)
  flight.then(cleanup, cleanup)
  return flight
}
