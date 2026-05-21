"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type FaceApiModule = typeof import("modern-face-api")

type DetectResult = {
  detected: boolean
  count: number
}

export function useFaceDetection() {
  const faceapiRef = useRef<FaceApiModule | null>(null)
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const faceapi = await import("modern-face-api")
        if (cancelled) return
        faceapiRef.current = faceapi

        await faceapi.nets.tinyFaceDetector.loadFromUri("/models")
        if (cancelled) return

        setIsModelLoaded(true)
      } catch (err) {
        if (cancelled) return
        console.warn("Face detection model failed to load:", err)
        setError("Face detection unavailable")
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const detectFace = useCallback(
    async (
      input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
    ): Promise<DetectResult> => {
      const faceapi = faceapiRef.current

      if (!faceapi || !isModelLoaded) {
        return { detected: true, count: 0 }
      }

      try {
        setIsDetecting(true)
        const detections = await faceapi.detectAllFaces(
          input,
          new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 })
        )
        return { detected: detections.length > 0, count: detections.length }
      } catch (err) {
        console.warn("Face detection failed:", err)
        return { detected: true, count: 0 }
      } finally {
        setIsDetecting(false)
      }
    },
    [isModelLoaded]
  )

  return { isModelLoaded, isDetecting, detectFace, error }
}
