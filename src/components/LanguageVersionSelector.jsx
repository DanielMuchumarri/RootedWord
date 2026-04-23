import { useEffect, useRef, useState } from 'react'
import { Globe, ChevronDown, Check, Eye, EyeOff } from 'lucide-react'
import { useUserPreferences } from '../contexts/UserPreferencesContext'

export default function LanguageVersionSelector() {
  const {
    languages,
    allTranslations,
    prefs,
    setPrefs,
    selectedLanguage,
    selectedTranslation,
  } = useUserPreferences()

  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!selectedLanguage || !selectedTranslation) return null

  const isNonEnglish = prefs.languageCode !== 'en'

  function selectTranslation(langCode, translationCode) {
    if (langCode === 'en') {
      setPrefs({ languageCode: langCode, translationCode, showOriginal: false })
    } else {
      setPrefs({ languageCode: langCode, translationCode })
    }
    setOpen(false)
  }

  function toggleShowOriginal() {
    setPrefs({ showOriginal: !prefs.showOriginal })
  }

  const displayLabel = isNonEnglish
    ? `${selectedLanguage.native_name || selectedLanguage.name} · ${selectedTranslation.code}`
    : selectedTranslation.code

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 border"
        style={{
          backgroundColor: open ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)',
          borderColor: 'rgba(255,255,255,0.25)',
          color: '#ffffff',
        }}
        title="Language & Bible Translation"
      >
        <Globe size={14} />
        <span className="hidden sm:inline">{displayLabel}</span>
        <span className="sm:hidden">{selectedTranslation.code}</span>
        <ChevronDown
          size={13}
          className="transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 rounded-2xl shadow-2xl border z-50 min-w-[270px] overflow-hidden"
          style={{ backgroundColor: 'var(--parchment)', borderColor: 'rgba(27,67,50,0.15)' }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: 'rgba(27,67,50,0.10)', backgroundColor: 'rgba(27,67,50,0.04)' }}
          >
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--green-deep)' }}>
              Language &amp; Bible Translation
            </p>
          </div>

          <div className="p-3 space-y-4">
            {languages.map((lang) => {
              const translations = allTranslations.filter(
                (t) => t.languages?.code === lang.code
              )
              return (
                <div key={lang.code}>
                  {/* Language label */}
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-xs font-bold" style={{ color: 'var(--green-mid)' }}>
                      {lang.name}
                    </span>
                    {lang.native_name && lang.native_name !== lang.name && (
                      <span className="text-xs text-gray-400">({lang.native_name})</span>
                    )}
                  </div>

                  {/* Translation chips */}
                  <div className="flex flex-wrap gap-2 px-1">
                    {translations.map((t) => {
                      const isSelected =
                        prefs.languageCode === lang.code &&
                        prefs.translationCode === t.code
                      return (
                        <button
                          key={t.id}
                          onClick={() => selectTranslation(lang.code, t.code)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200"
                          style={{
                            backgroundColor: isSelected ? 'var(--green-deep)' : 'rgba(27,67,50,0.06)',
                            borderColor: isSelected ? 'var(--green-deep)' : 'rgba(27,67,50,0.15)',
                            color: isSelected ? '#fff' : 'var(--text-dark)',
                          }}
                          title={t.name}
                        >
                          {isSelected && <Check size={11} />}
                          {t.code}
                        </button>
                      )
                    })}
                  </div>

                  {/* Full names */}
                  <div className="px-1 mt-1.5 space-y-0.5">
                    {translations.map((t) => (
                      <p key={t.id} className="text-xs text-gray-400 leading-tight">
                        <span className="font-medium text-gray-500">{t.code}</span> — {t.name}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Show-alongside toggle (only when non-English selected) */}
            {isNonEnglish && (
              <div className="border-t pt-3 mt-1" style={{ borderColor: 'rgba(27,67,50,0.10)' }}>
                <button
                  onClick={toggleShowOriginal}
                  className="flex items-center justify-between w-full px-2 py-2 rounded-xl transition-colors duration-200 hover:bg-black/5"
                >
                  <div className="flex items-center gap-2">
                    {prefs.showOriginal ? (
                      <Eye size={14} style={{ color: 'var(--green-deep)' }} />
                    ) : (
                      <EyeOff size={14} className="text-gray-400" />
                    )}
                    <span className="text-xs font-medium text-gray-700">
                      Show English alongside
                    </span>
                  </div>
                  <div
                    className="w-9 h-5 rounded-full flex items-center transition-colors duration-200 px-0.5"
                    style={{ backgroundColor: prefs.showOriginal ? 'var(--green-mid)' : '#D1D5DB' }}
                  >
                    <div
                      className="w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                      style={{ transform: prefs.showOriginal ? 'translateX(16px)' : 'translateX(0px)' }}
                    />
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
