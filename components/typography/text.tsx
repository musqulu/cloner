import * as React from "react"

import { cn } from "@/lib/utils"

const variantClass = {
  body: "text-body text-foreground",
  lead: "text-lead text-foreground",
  small: "text-small text-foreground",
  muted: "text-small text-muted-foreground",
  code: "font-mono text-code rounded-md bg-muted px-1 py-0.5 text-foreground",
} as const

export type TextProps = {
  as?: "p" | "span" | "div"
  variant?: keyof typeof variantClass
} & React.HTMLAttributes<HTMLElement>

export function Text({ className, as: Comp = "p", variant = "body", ...props }: TextProps) {
  return <Comp className={cn(variantClass[variant], className)} {...props} />
}
