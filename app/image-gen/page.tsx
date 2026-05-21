import type { Metadata } from "next"

import { ImageGenClient } from "./image-gen-client"

export const metadata: Metadata = {
  title: "Text to image",
  description: "Generate images from a text prompt via ElevenLabs",
}

export default function ImageGenPage() {
  return <ImageGenClient />
}
