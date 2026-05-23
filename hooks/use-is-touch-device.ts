"use client"

import { useSyncExternalStore } from "react"

const TOUCH_QUERY = "(pointer: coarse) and (hover: none)"

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const mql = window.matchMedia(TOUCH_QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia(TOUCH_QUERY).matches
}

function getServerSnapshot(): boolean {
  return false
}

export function useIsTouchDevice(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
