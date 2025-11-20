"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { Lang, translate } from "@/lib/i18n"

type LanguageContextType = {
  language: Lang
  setLanguage: (lang: Lang) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const STORAGE_KEY = "app_language"

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Lang>("en")

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null
      if (saved === "zh" || saved === "en") {
        setLanguageState(saved)
      }
    } catch {}
  }, [])

  const setLanguage = (lang: Lang) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {}
  }

  const value = useMemo(
    () => ({ language, setLanguage, t: (key: string, params?: Record<string, string | number>) => translate(language, key, params) }),
    [language]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider")
  return ctx
}