export const DEFAULT_LANGUAGE = "pl"

export const LANGUAGE_OPTIONS = [
  { code: "pl", label: "Polski" },
  { code: "en", label: "English" },
] as const

export type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["code"]
