import type { Metadata } from "next"

import { DesignSystemPage } from "@/components/design-system/design-system-page"

export const metadata: Metadata = {
  title: "Design system",
  description: "App tokens, primitives, and UI components",
}

export default function Page() {
  return <DesignSystemPage />
}
