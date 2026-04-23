import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ── Cookie helpers ─────────────────────────────────────────────────────────────
const COOKIE_NAME = 'rw_prefs'

function readCookie() {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
    return match ? JSON.parse(decodeURIComponent(match[1])) : null
  } catch {
    return null
  }
}

function writeCookie(value, days = 365) {
  const d = new Date()
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(value))}; expires=${d.toUTCString()}; path=/; SameSite=Strict`
}

// ── Context ────────────────────────────────────────────────────────────────────
const UserPreferencesContext = createContext(null)

export function UserPreferencesProvider({ children }) {
  const [languages, setLanguages] = useState([])
  const [allTranslations, setAllTranslations] = useState([])   // rows from bible_translations
  const [loading, setLoading] = useState(true)

  // { languageCode, translationCode, showOriginal }
  const [prefs, setPrefsState] = useState({
    languageCode: 'en',
    translationCode: 'ESV',
    showOriginal: false,
  })

  useEffect(() => {
    Promise.all([
      supabase
        .from('languages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('bible_translations')
        .select('*, languages(code, name, native_name)')
        .eq('is_active', true)
        .order('sort_order'),
    ]).then(([{ data: langs }, { data: translations }]) => {
      const langList = langs || []
      const translationList = translations || []
      setLanguages(langList)
      setAllTranslations(translationList)

      // Migrate old cookie shape (versionCode → translationCode)
      const saved = readCookie()
      const normalised = saved
        ? {
            languageCode:    saved.languageCode    || 'en',
            translationCode: saved.translationCode || saved.versionCode || 'ESV',
            showOriginal:    saved.showOriginal    || false,
          }
        : null

      if (
        normalised &&
        langList.some((l) => l.code === normalised.languageCode) &&
        translationList.some((t) => t.code === normalised.translationCode)
      ) {
        setPrefsState(normalised)
        writeCookie(normalised) // re-save with normalised shape
      } else {
        const defaultLang = langList.find((l) => l.is_default) || langList[0]
        const defaultTrans =
          translationList.find(
            (t) => t.is_default && t.languages?.code === defaultLang?.code
          ) || translationList[0]
        const initial = {
          languageCode:    defaultLang?.code  || 'en',
          translationCode: defaultTrans?.code || 'ESV',
          showOriginal:    false,
        }
        setPrefsState(initial)
        writeCookie(initial)
      }

      setLoading(false)
    })
  }, [])

  function setPrefs(updates) {
    setPrefsState((prev) => {
      const next = { ...prev, ...updates }
      writeCookie(next)
      return next
    })
  }

  // ── Derived selections ──────────────────────────────────────────────────────
  const selectedLanguage =
    languages.find((l) => l.code === prefs.languageCode) || null

  const translationsForLanguage = allTranslations.filter(
    (t) => t.languages?.code === prefs.languageCode
  )

  const selectedTranslation =
    translationsForLanguage.find((t) => t.code === prefs.translationCode) ||
    translationsForLanguage[0] ||
    null

  // The default English ESV (used as fallback content for non-English views)
  const defaultTranslation =
    allTranslations.find(
      (t) => t.is_default && t.languages?.code === 'en'
    ) || null

  const isEnglishDefault =
    prefs.languageCode === 'en' &&
    (selectedTranslation?.is_default || prefs.translationCode === 'ESV')

  return (
    <UserPreferencesContext.Provider
      value={{
        languages,
        allTranslations,
        translationsForLanguage,
        prefs,
        setPrefs,
        selectedLanguage,
        selectedTranslation,
        defaultTranslation,
        isEnglishDefault,
        loading,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  )
}

export function useUserPreferences() {
  const ctx = useContext(UserPreferencesContext)
  if (!ctx) throw new Error('useUserPreferences must be used inside UserPreferencesProvider')
  return ctx
}
