import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { AGE_GROUPS } from '../../lib/constants'
import toast from 'react-hot-toast'
import { ArrowLeft, Save } from 'lucide-react'

const EMPTY_FORM = {
  verse_date:      '',
  age_group_id:    1,
  verse_reference: '',
  is_active:       true,
}

export default function VerseForm() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { profile }  = useAuth()
  const isEdit       = Boolean(id)

  const [form, setForm]           = useState(EMPTY_FORM)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [dupWarning, setDupWarning] = useState(false)

  // Languages and bible_translations from DB
  const [languages, setLanguages]           = useState([])
  const [allTranslations, setAllTranslations] = useState([])

  // Verse text keyed by bible_translation_id: { verse_text: '' }
  const [contents, setContents]   = useState({})

  // Per-language content keyed by language_id: { reflection: '', live_it_out: '' }
  // One entry per language (English, Telugu, …) — NOT per translation (ESV, NIV, …)
  const [reflections, setReflections] = useState({})

  // Active language tab
  const [activeLangCode, setActiveLangCode] = useState('en')

  // Load languages + bible_translations
  useEffect(() => {
    Promise.all([
      supabase.from('languages').select('*').eq('is_active', true).order('sort_order'),
      supabase
        .from('bible_translations')
        .select('*, languages(id, code, name, native_name)')
        .eq('is_active', true)
        .order('sort_order'),
    ]).then(([{ data: langs }, { data: trans }]) => {
      setLanguages(langs || [])
      setAllTranslations(trans || [])
    })
  }, [])

  // Load existing verse when editing
  useEffect(() => {
    if (!isEdit) { setLoading(false); return }
    Promise.all([
      supabase.from('memory_verses').select('*').eq('id', id).single(),
      supabase.from('verse_translations').select('*').eq('verse_id', id),
      supabase.from('verse_language_reflections').select('*').eq('verse_id', id),
    ]).then(([{ data: verse }, { data: vtRows }, { data: reflRows }]) => {
      if (verse) {
        setForm({
          verse_date:      verse.verse_date,
          age_group_id:    verse.age_group_id,
          verse_reference: verse.verse_reference,
          is_active:       verse.is_active,
        })
      }

      // Verse texts per translation
      if (vtRows && vtRows.length > 0) {
        const c = {}
        vtRows.forEach((r) => { c[r.bible_translation_id] = { verse_text: r.verse_text || '' } })
        setContents(c)
      } else if (verse?.verse_text) {
        // Pre-fill legacy ESV data — migrated into ESV slot once allTranslations loads
        setContents({ __legacy__: { verse_text: verse.verse_text } })
      }

      // Reflections + live_it_out per language
      if (reflRows && reflRows.length > 0) {
        const r = {}
        reflRows.forEach((row) => {
          r[row.language_id] = {
            reflection:  row.reflection   || '',
            live_it_out: row.live_it_out  || '',
          }
        })
        setReflections(r)
      } else if (verse?.reflection) {
        // Legacy: store ESV reflection under English language (id=1)
        setReflections({ 1: { reflection: verse.reflection, live_it_out: '' } })
      }

      setLoading(false)
    })
  }, [id, isEdit])

  // Migrate __legacy__ verse text into ESV slot once allTranslations loads
  useEffect(() => {
    if (!contents.__legacy__ || allTranslations.length === 0) return
    const esv = allTranslations.find((t) => t.code === 'ESV' && t.languages?.code === 'en')
    if (!esv) return
    const { __legacy__, ...rest } = contents
    setContents({ ...rest, [esv.id]: __legacy__ })
  }, [allTranslations])

  // Duplicate check
  useEffect(() => {
    if (!form.verse_date || !form.age_group_id) return
    supabase
      .from('memory_verses')
      .select('id')
      .eq('verse_date', form.verse_date)
      .eq('age_group_id', form.age_group_id)
      .neq('id', id ?? '00000000-0000-0000-0000-000000000000')
      .then(({ data }) => setDupWarning((data?.length ?? 0) > 0))
  }, [form.verse_date, form.age_group_id])

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function setContent(translationId, value) {
    setContents((prev) => ({
      ...prev,
      [translationId]: { verse_text: value },
    }))
  }

  function setLangField(languageId, field, value) {
    setReflections((prev) => ({
      ...prev,
      [languageId]: {
        reflection:  '',
        live_it_out: '',
        ...(prev[languageId] || {}),
        [field]: value,
      },
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)

    // ESV English text is required
    const esv = allTranslations.find((t) => t.code === 'ESV' && t.languages?.code === 'en')
    const esvContent = esv ? contents[esv.id] : null
    if (!esvContent?.verse_text?.trim()) {
      toast.error('English (ESV) verse text is required.')
      setSaving(false)
      return
    }

    // 1. Upsert memory_verses (metadata only — text lives in verse_translations)
    const payload = {
      verse_date:      form.verse_date,
      age_group_id:    Number(form.age_group_id),
      verse_reference: form.verse_reference.trim(),
      is_active:       form.is_active,
      ...(isEdit ? { updated_by: profile?.id } : { created_by: profile?.id }),
    }

    let verseId = id
    if (isEdit) {
      const { error } = await supabase.from('memory_verses').update(payload).eq('id', id)
      if (error) {
        toast.error(error.code === '23505'
          ? 'A verse already exists for this date and group.'
          : error.message)
        setSaving(false)
        return
      }
    } else {
      const { data, error } = await supabase
        .from('memory_verses').insert(payload).select('id').single()
      if (error) {
        toast.error(error.code === '23505'
          ? 'A verse already exists for this date and group.'
          : error.message)
        setSaving(false)
        return
      }
      verseId = data.id
    }

    // 2. Upsert verse_translations (verse text only — reflection lives elsewhere)
    const vtUpserts = Object.entries(contents)
      .filter(([, c]) => c.verse_text?.trim())
      .map(([tid, c]) =>
        supabase.from('verse_translations').upsert(
          {
            verse_id:             verseId,
            bible_translation_id: Number(tid),
            verse_text:           c.verse_text.trim(),
            updated_at:           new Date().toISOString(),
          },
          { onConflict: 'verse_id,bible_translation_id' }
        )
      )

    await Promise.all(vtUpserts)

    // 3. Upsert verse_language_reflections (one per language)
    const vlrUpserts = Object.entries(reflections)
      .filter(([, r]) => r.reflection?.trim() || r.live_it_out?.trim())
      .map(([langId, r]) =>
        supabase.from('verse_language_reflections').upsert(
          {
            verse_id:    verseId,
            language_id: Number(langId),
            reflection:  r.reflection?.trim()  || null,
            live_it_out: r.live_it_out?.trim() || null,
            updated_at:  new Date().toISOString(),
          },
          { onConflict: 'verse_id,language_id' }
        )
      )

    await Promise.all(vlrUpserts)

    setSaving(false)
    toast.success(isEdit ? 'Verse updated!' : 'Verse created!')
    navigate('/admin/verses')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-4xl animate-bounce">🌿</div>
      </div>
    )
  }

  const transForLang   = allTranslations.filter((t) => t.languages?.code === activeLangCode)
  const activeLang     = languages.find((l) => l.code === activeLangCode)
  const activeLangId   = activeLang?.id
  const activeLangData = activeLangId ? (reflections[activeLangId] || {}) : {}
  const reflText       = activeLangData.reflection  ?? ''
  const liveItOutText  = activeLangData.live_it_out ?? ''
  const reflFilled     = Boolean(reflText.trim())
  const liveItOutFilled = Boolean(liveItOutText.trim())

  // Count filled translations for active language tab badge
  function countFilledForLang(langCode) {
    return allTranslations
      .filter((t) => t.languages?.code === langCode)
      .filter((t) => contents[t.id]?.verse_text?.trim()).length
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/admin/verses')}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-dark)' }}>
            {isEdit ? 'Edit Verse' : 'Add New Verse'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Verse metadata · translation texts · one reflection per language
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Base Metadata ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ backgroundColor: 'var(--green-deep)' }} />
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Verse Metadata</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verse Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date" required
                value={form.verse_date}
                onChange={(e) => setField('verse_date', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Age Group <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.age_group_id}
                onChange={(e) => setField('age_group_id', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              >
                {AGE_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>{g.label} ({g.ageRange})</option>
                ))}
              </select>
            </div>
          </div>

          {dupWarning && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              ⚠️ A verse already exists for this date and age group.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verse Reference <span className="text-red-500">*</span>
            </label>
            <input
              type="text" required
              placeholder="e.g. John 3:16"
              value={form.verse_reference}
              onChange={(e) => setField('verse_reference', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
            <div className="relative">
              <input
                type="checkbox" className="sr-only"
                checked={form.is_active}
                onChange={(e) => setField('is_active', e.target.checked)}
              />
              <div
                className="w-11 h-6 rounded-full transition-colors"
                style={{ backgroundColor: form.is_active ? 'var(--green-mid)' : '#D1D5DB' }}
              />
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  form.is_active ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </div>
            <span className="text-sm font-medium text-gray-700">Active (visible publicly)</span>
          </label>
        </div>

        {/* ── Translation Contents ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full" style={{ backgroundColor: 'var(--gold-accent)' }} />
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                Verse Content by Language
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-1 ml-4">
              English · ESV is required. Reflection is shared across all translations of the same language.
            </p>
          </div>

          {/* Language tabs */}
          <div
            className="flex border-b border-gray-100 overflow-x-auto"
            style={{ backgroundColor: 'rgba(27,67,50,0.03)' }}
          >
            {languages.map((lang) => {
              const isActive    = activeLangCode === lang.code
              const filledCount = countFilledForLang(lang.code)
              const hasRefl     = Boolean(
                reflections[lang.id]?.reflection?.trim() ||
                reflections[lang.id]?.live_it_out?.trim()
              )
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setActiveLangCode(lang.code)}
                  className="px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 flex items-center gap-2 flex-shrink-0"
                  style={{
                    borderBottomColor: isActive ? 'var(--green-deep)' : 'transparent',
                    color:             isActive ? 'var(--green-deep)' : '#6B7280',
                    backgroundColor:   isActive ? 'rgba(27,67,50,0.06)' : 'transparent',
                  }}
                >
                  {lang.name}
                  {lang.native_name && lang.native_name !== lang.name && (
                    <span className="text-xs text-gray-400">({lang.native_name})</span>
                  )}
                  {filledCount > 0 && (
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white font-bold"
                      style={{ backgroundColor: 'var(--green-mid)', fontSize: '0.6rem' }}
                    >
                      {filledCount}
                    </span>
                  )}
                  {hasRefl && (
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white font-bold"
                      style={{ backgroundColor: 'var(--gold-accent)', fontSize: '0.55rem' }}
                      title="Reflection filled"
                    >
                      R
                    </span>
                  )}
                  {lang.code === 'en' && (
                    <span className="text-red-400 font-bold text-xs">*</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="p-6 space-y-5">
            {transForLang.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">
                No translations configured for this language.
              </p>
            )}

            {/* Translation text areas — one per bible translation in the active language */}
            {transForLang.map((trans) => {
              const c          = contents[trans.id] || { verse_text: '' }
              const isFilled   = Boolean(c.verse_text?.trim())
              const isRequired = trans.code === 'ESV' && trans.languages?.code === 'en'

              return (
                <div
                  key={trans.id}
                  className="rounded-xl border overflow-hidden transition-all"
                  style={{
                    borderColor: isFilled ? 'var(--green-mid)' : '#E5E7EB',
                    boxShadow:   isFilled ? '0 0 0 1px rgba(45,106,79,0.15)' : 'none',
                  }}
                >
                  {/* Translation header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 border-b"
                    style={{
                      borderColor:     isFilled ? 'rgba(45,106,79,0.15)' : '#F3F4F6',
                      backgroundColor: isFilled ? 'rgba(27,67,50,0.04)' : '#FAFAFA',
                    }}
                  >
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-lg"
                      style={{
                        backgroundColor: isFilled ? 'var(--green-deep)' : '#E5E7EB',
                        color:           isFilled ? '#fff' : '#6B7280',
                      }}
                    >
                      {trans.code}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-gray-700">{trans.name}</span>
                      {trans.languages && (
                        <span className="text-xs text-gray-400 ml-2">
                          · {trans.languages.native_name || trans.languages.name}
                        </span>
                      )}
                    </div>
                    {isRequired
                      ? <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Required</span>
                      : <span className="text-xs text-gray-400">Optional</span>
                    }
                    {isFilled && (
                      <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">✓ Filled</span>
                    )}
                  </div>

                  {/* Verse text only */}
                  <div className="p-4">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      Verse Text {isRequired && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                      rows={4}
                      placeholder={`Enter the ${trans.code} scripture text…`}
                      value={c.verse_text}
                      onChange={(e) => setContent(trans.id, e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-y"
                    />
                  </div>
                </div>
              )
            })}

            {/* ── Reflection + Live It Out — one per language ────────────── */}
            {transForLang.length > 0 && activeLangId && (
              <div
                className="rounded-xl border overflow-hidden"
                style={{
                  borderColor: (reflFilled || liveItOutFilled) ? 'rgba(212,160,23,0.5)' : '#E5E7EB',
                  boxShadow:   (reflFilled || liveItOutFilled) ? '0 0 0 1px rgba(212,160,23,0.2)' : 'none',
                }}
              >
                {/* Card header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 border-b"
                  style={{
                    borderColor:     (reflFilled || liveItOutFilled) ? 'rgba(212,160,23,0.2)' : '#F3F4F6',
                    backgroundColor: (reflFilled || liveItOutFilled) ? 'rgba(212,160,23,0.05)' : '#FAFAFA',
                  }}
                >
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-lg"
                    style={{
                      backgroundColor: (reflFilled || liveItOutFilled) ? 'var(--gold-accent)' : '#E5E7EB',
                      color:           (reflFilled || liveItOutFilled) ? '#fff' : '#6B7280',
                    }}
                  >
                    {activeLang?.name} Content
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-gray-700">
                      Reflection &amp; Live It Out
                    </span>
                    {activeLangCode === 'en' && (
                      <span className="text-xs text-gray-400 ml-2">
                        · Shared for all English translations (ESV, NIV, …)
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">Optional</span>
                  {(reflFilled || liveItOutFilled) && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(212,160,23,0.15)', color: '#92600A' }}
                    >
                      ✓ Filled
                    </span>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {/* Reflection */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      🌿 Reflection / Devotional Insight
                    </label>
                    <textarea
                      rows={4}
                      placeholder={`Write a devotional reflection in ${activeLang?.name || activeLangCode}…`}
                      value={reflText}
                      onChange={(e) => setLangField(activeLangId, 'reflection', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-y"
                    />
                  </div>

                  {/* Live It Out */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      ✋ Live It Out
                    </label>
                    <p className="text-xs text-gray-400 mb-2">
                      Practical steps readers can take to apply this verse in daily life.
                    </p>
                    <textarea
                      rows={5}
                      placeholder={`e.g.\n1. Memorize this verse today.\n2. Share it with someone who needs encouragement.\n3. Journal how this truth applies to your situation.`}
                      value={liveItOutText}
                      onChange={(e) => setLangField(activeLangId, 'live_it_out', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-y font-mono"
                      style={{ fontSize: '0.82rem' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pb-6">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: 'var(--green-mid)' }}
          >
            <Save size={16} />
            {saving ? 'Saving…' : isEdit ? 'Update Verse' : 'Create Verse'}
          </button>
        </div>
      </form>
    </div>
  )
}
