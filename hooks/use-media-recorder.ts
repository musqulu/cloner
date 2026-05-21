"use client"

import { useCallback, useRef, useState } from "react"

export function useMediaRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [isRecording, setIsRecording] = useState(false)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null)

  const startRecording = useCallback((stream: MediaStream) => {
    chunksRef.current = []
    setRecordingUrl(null)
    setRecordingBlob(null)

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm"

    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      setRecordingBlob(blob)
      setRecordingUrl(URL.createObjectURL(blob))
    }

    recorder.start(100)
    setIsRecording(true)
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }, [])

  const download = useCallback(() => {
    if (!recordingUrl) return
    const a = document.createElement("a")
    a.href = recordingUrl
    a.download = `cloner-reaction-${Date.now()}.webm`
    a.click()
  }, [recordingUrl])

  return { isRecording, recordingUrl, recordingBlob, startRecording, stopRecording, download }
}
