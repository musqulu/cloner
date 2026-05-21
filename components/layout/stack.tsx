import * as React from "react"

import { cn } from "@/lib/utils"

const gapMap = {
  tight: "gap-tight",
  stack: "gap-stack",
  section: "gap-section",
} as const

export type StackProps = React.ComponentProps<"div"> & {
  gap?: keyof typeof gapMap
}

export function Stack({ className, gap = "stack", ...props }: StackProps) {
  return <div className={cn("flex flex-col", gapMap[gap], className)} {...props} />
}
