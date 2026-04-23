import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Resolve which translation text + language reflection to display for a verse.
 *
 * Text priority:
 *   1. The user's selected bible_translation
 *   2. The default translation (ESV)
 *
 * Reflection / Live It Out priority:
 *   1. Content for the LANGUAGE of the selected translation
 *   2. English language content as fallback
 */
function resolveContent(verse, translationId, defaultTranslationId) {
  const contents  = verse.verse_translations        || []
  const langRefls = verse.verse_language_reflections || []

  const match =
    (translationId        ? contents.find((c) => c.bible_translation_id === translationId)        : null) ||
    (defaultTranslationId ? contents.find((c) => c.bible_translation_id === defaultTranslationId) : null)

  const matchedLangId = match?.bible_translations?.language_id ?? null

  const reflForLang = matchedLangId
    ? langRefls.find((r) => r.language_id === matchedLangId)?.reflection ?? null
    : null
  const reflEnglish = langRefls.find((r) => r.languages?.code === 'en')?.reflection ?? null

  return {
    display_text:           match?.verse_text ?? '',
    display_reflection:     reflForLang ?? reflEnglish ?? '',
    translation_found:      Boolean(match),
    matched_translation_id: match?.bible_translation_id ?? null,
    matched_language_id:    matchedLangId,
  }
}

/**
 * Fetch all verses for a calendar month and attach resolved display content.
 */
export function useMonthVerses(year, month, ageGroupId, translationId, defaultTranslationId) {
  const [verses, setVerses]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!year || !month || !ageGroupId) return
    setLoading(true)

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate   = new Date(year, month, 0).toISOString().split('T')[0]

    supabase
      .from('memory_verses')
      .select(`
        id, verse_date, verse_reference, age_group_id,
        verse_translations(
          id, verse_text, bible_translation_id,
          bible_translations(id, code, language_id)
        ),
        verse_language_reflections(
          language_id, reflection, live_it_out,
          languages(id, code, name)
        )
      `)
      .eq('age_group_id', ageGroupId)
      .eq('is_active', true)
      .gte('verse_date', startDate)
      .lte('verse_date', endDate)
      .order('verse_date')
      .then(({ data, error }) => {
        if (error) {
          setError(error)
        } else {
          const resolved = (data || []).map((verse) => ({
            ...verse,
            ...resolveContent(verse, translationId, defaultTranslationId),
          }))
          setVerses(resolved)
        }
        setLoading(false)
      })
  }, [year, month, ageGroupId, translationId, defaultTranslationId])

  return { verses, loading, error }
}

/**
 * Fetch a single verse with all its translation texts and language reflections.
 */
export function useVerse(id) {
  const [verse, setVerse]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!id) return
    supabase
      .from('memory_verses')
      .select(`
        id, verse_date, verse_reference, age_group_id, is_active,
        created_by, updated_by, created_at, updated_at,
        age_groups(slug, label, color_hex),
        verse_translations(
          id, verse_text, bible_translation_id,
          bible_translations(
            id, code, name, language_id,
            languages(id, code, name, native_name)
          )
        ),
        verse_language_reflections(
          language_id, reflection, live_it_out,
          languages(id, code, name, native_name)
        )
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error)
        else setVerse(data)
        setLoading(false)
      })
  }, [id])

  return { verse, loading, error }
}
