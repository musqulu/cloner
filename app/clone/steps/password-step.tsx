"use client"

import { useEffect, useState } from "react"
import { LockKeyhole } from "lucide-react"

import { Stack } from "@/components/layout/stack"
import { Heading } from "@/components/typography/heading"
import { Text } from "@/components/typography/text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { UiCopy } from "@/lib/cloner/ui-copy"

export function PasswordStep({
  copy,
  onAuthenticated,
}: {
  copy: UiCopy
  onAuthenticated: (options?: { withTransition?: boolean }) => void
}) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" })
        const data = (await res.json()) as {
          required?: boolean
          authenticated?: boolean
        }
        if (cancelled) return
        if (!data.required || data.authenticated) {
          onAuthenticated({ withTransition: false })
        }
      } catch {
        // Keep password step visible if status check fails.
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [onAuthenticated])

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
        setError(copy.login.incorrect)
        return
      }

      onAuthenticated({ withTransition: true })
    } catch {
      setError(copy.login.failed)
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <Stack gap="stack" className="items-center text-center">
        <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
          <LockKeyhole className="size-5 text-muted-foreground" />
        </div>
        <Stack gap="tight">
          <Heading variant="subtitle">{copy.login.title}</Heading>
          <Text variant="muted">{copy.login.description}</Text>
        </Stack>
        <Stack gap="tight" className="w-full text-left">
          <Label htmlFor="wizard-password">{copy.login.password}</Label>
          <Input
            id="wizard-password"
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
          {loading ? copy.login.loading : copy.login.submit}
        </Button>
      </Stack>
    </form>
  )
}
