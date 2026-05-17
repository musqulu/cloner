import fs from "node:fs"

function loadEnv(path = ".env.local") {
  if (!fs.existsSync(path)) return
  const text = fs.readFileSync(path, "utf8")
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const i = trimmed.indexOf("=")
    if (i === -1) continue
    const key = trimmed.slice(0, i)
    const value = trimmed.slice(i + 1)
    if (!(key in process.env)) process.env[key] = value
  }
}

async function upstreamMessage(res) {
  const text = await res.text()
  try {
    const data = JSON.parse(text)
    return (
      data?.detail?.message ||
      data?.detail ||
      data?.message ||
      data?.error?.message ||
      text
    )
  } catch {
    return text || `HTTP ${res.status}`
  }
}

async function main() {
  loadEnv()
  const voiceId = process.argv[2] || process.env.ELEVENLABS_TEST_VOICE_ID
  const results = []

  const elevenLabsKey = process.env.ELEVENLABS_API_KEY
  if (!elevenLabsKey) {
    results.push(["elevenlabs-env", false, "ELEVENLABS_API_KEY missing"])
  } else {
    const user = await fetch("https://api.elevenlabs.io/v1/user", {
      headers: { "xi-api-key": elevenLabsKey },
    })
    results.push([
      "elevenlabs-user",
      user.ok,
      user.ok ? "ok" : await upstreamMessage(user),
    ])

    if (voiceId) {
      const tts = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
          voiceId
        )}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenLabsKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "Hi.",
            model_id: process.env.ELEVENLABS_TTS_MODEL_ID || "eleven_multilingual_v2",
          }),
        }
      )
      results.push([
        "elevenlabs-tiny-tts",
        tts.ok,
        tts.ok ? `${(await tts.arrayBuffer()).byteLength} bytes` : await upstreamMessage(tts),
      ])
    } else {
      results.push([
        "elevenlabs-tiny-tts",
        false,
        "Skipped. Pass a voice ID as first arg or set ELEVENLABS_TEST_VOICE_ID.",
      ])
    }
  }

  const replicateToken = process.env.REPLICATE_API_TOKEN
  const model = process.env.REPLICATE_VIDEO_MODEL
  if (!replicateToken || !model) {
    results.push(["replicate-video-model", false, "Replicate token/model missing"])
  } else {
    const [owner, name] = model.split("/")
    const res = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}`, {
      headers: { Authorization: `Bearer ${replicateToken}` },
    })
    const data = await res.json().catch(() => ({}))
    results.push([
      "replicate-video-model",
      res.ok,
      res.ok
        ? `${model} ${data?.latest_version?.id || ""}`.trim()
        : data?.detail || `HTTP ${res.status}`,
    ])
  }

  for (const [name, ok, message] of results) {
    console.log(`${ok ? "OK" : "FAIL"} ${name}: ${message}`)
  }

  if (results.some(([, ok]) => !ok)) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
