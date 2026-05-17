import * as React from "react"

import { cn } from "@/lib/utils"

const gapMap = {
  tight: "gap-tight",
  inline: "gap-inline",
  stack: "gap-stack",
} as const

export type InlineProps = React.ComponentProps<"div"> & {
  gap?: keyof typeof gapMap
}

export function Inline({ className, gap = "inline", ...props }: InlineProps) {
  return (
    <div className={cn("flex flex-row flex-wrap items-center", gapMap[gap], className)} {...props} />
  )
}
