import * as React from "react"

import { cn } from "@/lib/utils"

const variantClass = {
  display: "text-display font-semibold tracking-[var(--text-display--letter-spacing)]",
  title: "text-title font-semibold tracking-[var(--text-title--letter-spacing)]",
  subtitle: "text-subtitle font-semibold",
  body: "text-body font-semibold",
} as const

const defaultAs: Record<keyof typeof variantClass, "h1" | "h2" | "h3" | "h4"> = {
  display: "h1",
  title: "h2",
  subtitle: "h3",
  body: "h4",
}

export type HeadingProps = {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
  variant?: keyof typeof variantClass
} & React.HTMLAttributes<HTMLHeadingElement>

export function Heading({ className, as, variant = "title", ...props }: HeadingProps) {
  const Comp = as ?? defaultAs[variant]
  return (
    <Comp
      className={cn("font-heading text-foreground", variantClass[variant], className)}
      {...props}
    />
  )
}
