"use client"

function writeString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) {
    view.setUint8(offset + i, s.charCodeAt(i))
  }
}

function encodeWavMono(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, "WAVE")
  writeString(view, 12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(view, 36, "data")
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return buffer
}

/**
 * Decodes arbitrary browser-supported audio (e.g. WebM) to a mono 16-bit WAV
 * for APIs that reject the original container.
 */
export async function decodeAudioBlobToWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext()
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
    const len = audioBuffer.length
    const channels = audioBuffer.numberOfChannels
    const mono = new Float32Array(len)
    for (let c = 0; c < channels; c++) {
      const ch = audioBuffer.getChannelData(c)
      for (let i = 0; i < len; i++) {
        mono[i] += ch[i] / channels
      }
    }
    const wav = encodeWavMono(mono, audioBuffer.sampleRate)
    return new Blob([wav], { type: "audio/wav" })
  } finally {
    await ctx.close()
  }
}
