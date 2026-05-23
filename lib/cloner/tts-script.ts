import Replicate from "replicate"

const MODEL = "anthropic/claude-4.5-sonnet" as const
type TtsScriptResult = {
  script: string
  source: "replicate" | "fallback"
  warning?: string
}

const scriptFlights = new Map<string, Promise<TtsScriptResult>>()

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  pl: "Polish",
  ru: "Russian",
}

export const MIN_TRUTH_LENGTH = 50

export function buildTtsScriptPrompt(
  personalTruth: string,
  languageCode: string
): string {
  const langName = LANGUAGE_LABELS[languageCode] ?? languageCode
  const langInstruction =
    languageCode === "pl"
      ? "\nFor Polish: use natural contemporary Polish, Polish punctuation, and Polish phrasing. Do not translate literally from English."
      : languageCode === "ru"
        ? "\nFor Russian: use natural contemporary Russian, Cyrillic script, and Russian phrasing. Do not translate literally from English."
        : ""

  return `You are generating a short synthetic statement for an experimental art project about identity, AI, and digital selfhood.

The participant wrote something real and personal about their life. This input is the MOST IMPORTANT part of the task.

You MUST stay very close to the participant's actual world:
- their specific activity,
- memory,
- habit,
- place,
- object,
- routine,
- or experience.

Do not drift into generic emotions or abstract observations.

The generated statement should feel like it emerges directly from the participant's real input — as if an unsaid thought was hidden inside the original sentence.

Your task:
Generate a short private thought that feels emotionally plausible, subtle, and slightly uncomfortable.

The statement should feel like:
- something accidentally said during a late-night video call,
- a thought that normally stays internal,
- a moment of slight emotional exposure,
- something believable enough that the participant could briefly wonder if they actually said it.

IMPORTANT:
- The speaker should sound unaware that they are revealing something personal.
- The participant input should strongly shape the atmosphere, wording, and emotional direction of the response.
- The generated text should feel connected to the exact life situation described by the participant.
- Avoid turning the input into a metaphor or abstract philosophical reflection.

Participant input:
"""
${personalTruth.trim()}
"""

Rules:
- First person
- Present tense
- Spoken language, not literary writing
- Quiet, restrained, contemporary tone
- 35–45 words maximum
- Should sound natural when spoken aloud for about 8–10 seconds
- Ends unresolved or slightly interrupted
- No drama
- No poetry
- No philosophy
- No inspirational tone
- No explicit AI commentary
- No political content
- No extreme confessions
- Avoid sounding cinematic, scripted, therapeutic, or overly intelligent

The statement should contain:
- at least one concrete detail directly connected to the participant input,
- one emotionally revealing moment,
- one unfinished or ambiguous thought.

The emotional effect should be:
"This sounds disturbingly plausible."

The text should sound like a real person casually speaking to a webcam alone at night.

Write in ${langName}.${langInstruction}
Plain text only. Output only the statement, nothing else.
`
}

export function fallbackTtsScript(
  _personalTruth: string,
  languageCode: string
): string {
  if (languageCode === "pl") {
    return "Widzę siebie w oknie i nagle brzmię spokojniej, niż się czuję. To chyba nie powinno być takie łatwe."
  }

  return "I see myself in the window and sound calmer than I feel. I do not think it should be this easy."
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
    try {
      console.log("[generate-tts-script] attempt", 1)
      const prompt = buildTtsScriptPrompt(normalizedTruth, language)
      const script = await streamScript(replicate, prompt)
      console.log("[generate-tts-script] Replicate script:\n", script)
      return { script, source: "replicate" }
    } catch (err) {
      const warning =
        err instanceof Error ? err.message : "Failed to generate script."
      const script = fallbackTtsScript(normalizedTruth, language)
      console.warn("[generate-tts-script] using fallback", { warning })
      return { script, source: "fallback", warning }
    }
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
