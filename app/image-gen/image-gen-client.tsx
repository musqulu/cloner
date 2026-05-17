"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

import { Container } from "@/components/layout/container"
import { Stack } from "@/components/layout/stack"
import { Heading } from "@/components/typography/heading"
import { Text } from "@/components/typography/text"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button-variants"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export function ImageGenClient() {
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const revoke = useCallback(() => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl)
    }
  }, [imageUrl])

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
  }, [imageUrl])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    revoke()
    setImageUrl(null)

    const trimmed = prompt.trim()
    if (!trimmed) {
      setError("Enter a prompt.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      })

      const ct = res.headers.get("content-type") ?? ""

      if (!res.ok) {
        if (ct.includes("application/json")) {
          const data = (await res.json()) as { error?: string; code?: string }
          setError(data.error ?? `Request failed (${res.status})`)
        } else {
          setError(await res.text().then((t) => t.slice(0, 500) || `Request failed (${res.status})`))
        }
        return
      }

      if (ct.startsWith("image/")) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        setImageUrl(url)
        return
      }

      setError("Unexpected response from the server.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <Container className="flex flex-1 flex-col py-section">
        <Stack gap="section" className="max-w-3xl">
          <Stack gap="stack">
            <Heading variant="display" className="text-balance">
              Text to image
            </Heading>
            <Text variant="muted">
              Describe an image and generate it. The server calls ElevenLabs using your API key and{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">ELEVENLABS_IMAGE_API_URL</code>.
            </Text>
            <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
              Back home
            </Link>
          </Stack>

          <Card>
            <CardHeader>
              <CardTitle>Prompt</CardTitle>
              <CardDescription>
                The API route sends JSON{" "}
                <code className="font-mono text-xs">{`{ "prompt": "…" }`}</code> by default. Override the key with{" "}
                <code className="font-mono text-xs">ELEVENLABS_IMAGE_PROMPT_FIELD</code> if your endpoint expects a
                different field name.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="flex flex-col gap-stack">
                <Stack gap="tight">
                  <Label htmlFor="prompt">Image description</Label>
                  <Textarea
                    id="prompt"
                    name="prompt"
                    rows={5}
                    placeholder="e.g. A watercolor fox reading a book in a sunlit forest"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={loading}
                    required
                  />
                </Stack>
                <Button type="submit" disabled={loading}>
                  {loading ? "Generating…" : "Generate image"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Could not generate</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {imageUrl ? (
            <Card>
              <CardHeader>
                <CardTitle>Result</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob URL from API */}
                <img src={imageUrl} alt="Generated from your prompt" className="w-full object-contain" />
              </CardContent>
            </Card>
          ) : null}
        </Stack>
      </Container>
    </div>
  )
}
