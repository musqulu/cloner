import * as React from "react"

import { cn } from "@/lib/utils"

const maxWidth = {
  default: "max-w-5xl",
  narrow: "max-w-prose",
  wide: "max-w-7xl",
} as const

export type ContainerProps = React.ComponentProps<"div"> & {
  size?: keyof typeof maxWidth
}

export function Container({ className, size = "default", ...props }: ContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full px-page-x py-page-y", maxWidth[size], className)}
      {...props}
    />
  )
}
