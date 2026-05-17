"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type UseWebcamOptions = {
  autoStart?: boolean
  width?: number
  height?: number
  permissionDeniedMessage?: string
  unavailableMessage?: string
}

export function useWebcam({
  autoStart = false,
  width = 640,
  height = 480,
  permissionDeniedMessage = "Camera access denied. Please allow camera access and try again.",
  unavailableMessage = "Could not access camera. Please check your device.",
}: UseWebcamOptions = {}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width, height },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setIsActive(true)
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? permissionDeniedMessage
          : unavailableMessage
      )
      setIsActive(false)
    }
  }, [width, height, permissionDeniedMessage, unavailableMessage])

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsActive(false)
  }, [])

  const capture = useCallback((): Blob | null => {
    const video = videoRef.current
    if (!video || !isActive) return null

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || width
    canvas.height = video.videoHeight || height
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    let blob: Blob | null = null
    canvas.toBlob((b) => {
      blob = b
    }, "image/png")

    // toBlob is async but with a callback; use synchronous fallback
    const dataUrl = canvas.toDataURL("image/png")
    const byteString = atob(dataUrl.split(",")[1])
    const mimeString = dataUrl.split(",")[0].split(":")[1].split(";")[0]
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i)
    }
    return new Blob([ab], { type: mimeString })
  }, [isActive, width, height])

  useEffect(() => {
    if (autoStart) {
      start()
    }
    return () => {
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart])

  return { videoRef, isActive, error, start, stop, capture }
}
