"use client"

import * as React from "react"
import { Info, Terminal } from "lucide-react"

import { Container } from "@/components/layout/container"
import { Inline } from "@/components/layout/inline"
import { Stack } from "@/components/layout/stack"
import { Heading } from "@/components/typography/heading"
import { Text } from "@/components/typography/text"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button-variants"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Stack gap="stack" className="border-b border-border py-section last:border-b-0">
      <Heading variant="title" as="h2">
        {title}
      </Heading>
      {children}
    </Stack>
  )
}

const colorSwatches = [
  { label: "background", box: "bg-background border border-border", text: "text-foreground" },
  { label: "foreground", box: "bg-foreground", text: "text-background" },
  { label: "primary", box: "bg-primary", text: "text-primary-foreground" },
  { label: "secondary", box: "bg-secondary", text: "text-secondary-foreground" },
  { label: "muted", box: "bg-muted", text: "text-muted-foreground" },
  { label: "accent", box: "bg-accent", text: "text-accent-foreground" },
  { label: "destructive", box: "bg-destructive", text: "text-white" },
  { label: "card", box: "bg-card border border-border", text: "text-card-foreground" },
  { label: "border", box: "bg-border", text: "text-foreground" },
] as const

export function DesignSystemPage() {
  return (
    <div className="bg-background text-foreground">
      <Container size="wide" className="pb-section">
        <Stack gap="section" className="pt-section">
          <div>
            <Heading variant="display" as="h1">
              Design system
            </Heading>
            <Text variant="muted" className="mt-stack">
              Tokens, layout primitives, and shadcn (base-nova) components for this app.
            </Text>
          </div>

          <Section title="Color">
            <div className="grid gap-inline sm:grid-cols-2 lg:grid-cols-3">
              {colorSwatches.map(({ label, box, text }) => (
                <div
                  key={label}
                  className={`flex h-20 items-end rounded-lg p-3 ${box} ${text} text-small font-medium`}
                >
                  {label}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Typography">
            <Stack gap="section">
              <div>
                <Text variant="small" className="mb-tight font-medium text-muted-foreground">
                  Heading
                </Text>
                <Stack gap="stack">
                  <Heading variant="display">Display</Heading>
                  <Heading variant="title">Title</Heading>
                  <Heading variant="subtitle">Subtitle</Heading>
                  <Heading variant="body" as="h4">
                    Body heading
                  </Heading>
                </Stack>
              </div>
              <div>
                <Text variant="small" className="mb-tight font-medium text-muted-foreground">
                  Text
                </Text>
                <Stack gap="stack">
                  <Text variant="lead">Lead — introductory paragraph style.</Text>
                  <Text variant="body">Body — default paragraph.</Text>
                  <Text variant="small">Small — captions and hints.</Text>
                  <Text variant="muted">Muted — secondary supporting text.</Text>
                  <Text variant="code">inline code</Text>
                </Stack>
              </div>
              <div>
                <Text variant="small" className="mb-tight font-medium text-muted-foreground">
                  HTML defaults (global base styles)
                </Text>
                <article className="max-w-prose space-y-stack border border-border rounded-lg p-4">
                  <h1>Heading 1</h1>
                  <h2>Heading 2</h2>
                  <h3>Heading 3</h3>
                  <p>
                    Paragraph with <code>code</code> inside.
                  </p>
                </article>
              </div>
            </Stack>
          </Section>

          <Section title="Spacing">
            <Text variant="muted" className="mb-stack">
              Semantic tokens: <code className="text-foreground">page-x</code>,{" "}
              <code className="text-foreground">stack</code>,{" "}
              <code className="text-foreground">section</code>, etc.
            </Text>
            <Inline gap="stack" className="items-stretch">
              <div className="flex flex-1 flex-col gap-tight rounded-lg border border-dashed border-border p-3">
                <span className="text-small text-muted-foreground">gap-tight / p-tight</span>
                <div className="flex gap-tight">
                  <div className="h-10 flex-1 rounded bg-muted" />
                  <div className="h-10 flex-1 rounded bg-muted" />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-tight rounded-lg border border-dashed border-border p-3">
                <span className="text-small text-muted-foreground">gap-inline</span>
                <div className="flex gap-inline">
                  <div className="h-10 flex-1 rounded bg-muted" />
                  <div className="h-10 flex-1 rounded bg-muted" />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-tight rounded-lg border border-dashed border-border p-3">
                <span className="text-small text-muted-foreground">gap-stack</span>
                <div className="flex flex-col gap-stack">
                  <div className="h-8 rounded bg-muted" />
                  <div className="h-8 rounded bg-muted" />
                </div>
              </div>
            </Inline>
          </Section>

          <Section title="Layout primitives">
            <Stack gap="stack">
              <Text variant="muted">Container + Stack + Inline</Text>
              <Card>
                <CardHeader>
                  <CardTitle>Card inside Container</CardTitle>
                  <CardDescription>Primitives compose with shadcn Card.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Stack gap="stack">
                    <Inline gap="inline">
                      <div className="h-8 w-20 rounded bg-muted" />
                      <div className="h-8 w-20 rounded bg-muted" />
                      <div className="h-8 w-20 rounded bg-muted" />
                    </Inline>
                    <Separator />
                    <Stack gap="tight">
                      <div className="h-6 rounded bg-muted" />
                      <div className="h-6 rounded bg-muted" />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Section>

          <Section title="Buttons">
            <Inline gap="inline">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link" nativeButton={false} render={<a href="#" />}>
                Link
              </Button>
            </Inline>
            <Inline gap="inline" className="mt-stack">
              <Button size="xs">XS</Button>
              <Button size="sm">SM</Button>
              <Button size="default">Default</Button>
              <Button size="lg">LG</Button>
            </Inline>
          </Section>

          <Section title="Form">
            <Stack gap="stack" className="max-w-md">
              <div className="space-y-tight">
                <Label htmlFor="ds-email">Email</Label>
                <Input id="ds-email" type="email" placeholder="you@example.com" />
              </div>
              <div className="space-y-tight">
                <Label htmlFor="ds-bio">Bio</Label>
                <Textarea id="ds-bio" placeholder="Short description" rows={3} />
              </div>
              <div className="space-y-tight">
                <Label>Role</Label>
                <Select defaultValue="designer">
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="designer">Designer</SelectItem>
                    <SelectItem value="developer">Developer</SelectItem>
                    <SelectItem value="pm">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Stack>
          </Section>

          <Section title="Feedback">
            <Stack gap="stack" className="max-w-xl">
              <Inline gap="inline">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </Inline>
              <div className="space-y-stack">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-3/4" />
              </div>
              <Alert>
                <Terminal />
                <AlertTitle>Heads up</AlertTitle>
                <AlertDescription>Inline alert with icon and description.</AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <Info />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>Destructive variant for failures.</AlertDescription>
              </Alert>
            </Stack>
          </Section>

          <Section title="Dialog">
            <Dialog>
              <DialogTrigger className={cn(buttonVariants({ variant: "outline" }))}>
                Open dialog
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm action</DialogTitle>
                  <DialogDescription>This uses the shared Dialog primitive.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose className={cn(buttonVariants({ variant: "outline" }))}>
                    Cancel
                  </DialogClose>
                  <Button>Continue</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Section>

          <Section title="Dropdown menu">
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline" }))}>
                Menu
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </Section>

          <Section title="Tabs">
            <Tabs defaultValue="one">
              <TabsList>
                <TabsTrigger value="one">First</TabsTrigger>
                <TabsTrigger value="two">Second</TabsTrigger>
              </TabsList>
              <TabsContent value="one">
                <Text>Content for the first tab.</Text>
              </TabsContent>
              <TabsContent value="two">
                <Text>Content for the second tab.</Text>
              </TabsContent>
            </Tabs>
          </Section>
        </Stack>
      </Container>
    </div>
  )
}
