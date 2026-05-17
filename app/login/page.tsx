"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LockKeyhole } from "lucide-react"

import { Container } from "@/components/layout/container"
import { Stack } from "@/components/layout/stack"
import { Heading } from "@/components/typography/heading"
import { Text } from "@/components/typography/text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getUiCopy } from "@/lib/cloner/ui-copy"

function LoginForm() {
  const copy = getUiCopy("pl").login
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        setError(copy.incorrect)
        return
      }

      router.replace(searchParams.get("next") || "/")
      router.refresh()
    } catch {
      setError(copy.failed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <Container className="flex flex-1 items-center justify-center py-section">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <Stack gap="stack" className="items-center text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
              <LockKeyhole className="size-5 text-muted-foreground" />
            </div>
            <Stack gap="tight">
              <Heading variant="subtitle">{copy.title}</Heading>
              <Text variant="muted">
                {copy.description}
              </Text>
            </Stack>
            <Stack gap="tight" className="w-full text-left">
              <Label htmlFor="password">{copy.password}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Stack>
            {error && (
              <Text variant="small" className="text-destructive">
                {error}
              </Text>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? copy.loading : copy.submit}
            </Button>
          </Stack>
        </form>
      </Container>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
