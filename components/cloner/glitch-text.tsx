"use client"

export function GlitchText({
  text,
  glitch,
  clock,
}: {
  text: string
  glitch: boolean
  clock: number
}) {
  const isArchiveNumber = text.startsWith("#")

  return (
    <div
      className={`relative px-5 text-center font-mono tracking-normal text-white/90 ${
        isArchiveNumber
          ? "text-3xl font-medium sm:text-4xl"
          : "text-lg font-normal sm:text-xl"
      }`}
      style={{
        filter: glitch ? "blur(0.35px)" : "none",
        opacity: glitch ? 0.82 : 1,
        transform: glitch ? `translateX(${Math.sin(clock * 0.08) * 3}px)` : "translateX(0)",
      }}
    >
      {glitch && (
        <>
          <span className="absolute inset-0 translate-x-1 text-white/30">{text}</span>
          <span className="absolute inset-0 -translate-x-1 text-white/20">{text}</span>
        </>
      )}
      <span className="relative">{text}</span>
    </div>
  )
}
