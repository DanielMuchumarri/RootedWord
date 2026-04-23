import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Save, Image } from 'lucide-react'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  verse_reference: '',
  background_image_url: '',
  overlay_color: 'rgba(27, 67, 50, 0.72)',
  sort_order: 0,
  is_active: true,
}

export default function HeroVerseForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Languages and bible_translations from DB
  const [languages, setLanguages] = useState([])
  const [allTranslations, setAllTranslations] = useState([])

  // Content keyed by bible_translation_id: { verse_text: '' }
  const [contents, setContents] = useState({})
  const [activeLangCode, setActiveLangCode] = useState('en')

  // Load languages + bible_translations
  useEffect(() => {
    Promise.all([
      supabase.from('languages').select('*').eq('is_active', true).order('sort_order'),
      supabase
        .from('bible_translations')
        .select('*, languages(code, name, native_name)')
        .eq('is_active', true)
        .order('sort_order'),
    ]).then(([{ data: langs }, { data: trans }]) => {
      setLanguages(langs || [])
      setAllTranslations(trans || [])
    })
  }, [])

  // Load existing slide when editing
  useEffect(() => {
    if (!isEdit) {
      setLoading(false)
      return
    }
    Promise.all([
      supabase.from('hero_verses').select('*').eq('id', id).single(),
      supabase.from('hero_verse_translations').select('*').eq('hero_verse_id', id),
    ]).then(([{ data: slide }, { data: trans }]) => {
      if (slide) {
        setForm({
          verse_reference: slide.verse_reference,
          background_image_url: slide.background_image_url || '',
          overlay_color: slide.overlay_color,
          sort_order: slide.sort_order,
          is_active: slide.is_active,
        })
      }
      if (trans && trans.length > 0) {
        const c = {}
        trans.forEach((tr) => {
          c[tr.bible_translation_id] = { verse_text: tr.verse_text || '' }
        })
        setContents(c)
      } else if (slide?.verse_text) {
        // Pre-fill from legacy column — resolved into ESV slot once allTranslations loads
        setContents({ __legacy__: { verse_text: slide.verse_text } })
      }
      setLoading(false)
    })
  }, [id, isEdit])

  // Once allTranslations loads, migrate __legacy__ into the ESV slot
  useEffect(() => {
    if (!contents.__legacy__ || allTranslations.length === 0) return
    const esv = allTranslations.find(
      (t) => t.code === 'ESV' && t.languages?.code === 'en'
    )
    if (!esv) return
    const { __legacy__, ...rest } = contents
    setContents({ ...rest, [esv.id]: __legacy__ })
  }, [allTranslations])

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function setContent(translationId, value) {
    setContents((prev) => ({
      ...prev,
      [translationId]: { verse_text: value },
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)

    // Validate: ESV must have content
    const esv = allTranslations.find(
      (t) => t.code === 'ESV' && t.languages?.code === 'en'
    )
    const esvContent = esv ? contents[esv.id] : null
    if (!esvContent?.verse_text?.trim()) {
      toast.error('English (ESV) verse text is required.')
      setSaving(false)
      return
    }

    // 1. Upsert hero_verses (keep verse_text for backward compatibility)
    const payload = {
      verse_reference: form.verse_reference.trim(),
      verse_text: esvContent.verse_text.trim(),       // backward compat
      bible_translation: 'ESV',                        // backward compat
      background_image_url: form.background_image_url?.trim() || null,
      overlay_color: form.overlay_color,
      sort_order: Number(form.sort_order),
      is_active: form.is_active,
    }

    let slideId = id
    if (isEdit) {
      const { error } = await supabase.from('hero_verses').update(payload).eq('id', id)
      if (error) { toast.error(error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase
        .from('hero_verses')
        .insert(payload)
        .select('id')
        .single()
      if (error) { toast.error(error.message); setSaving(false); return }
      slideId = data.id
    }

    // 2. Upsert translation contents that have text
    const upserts = Object.entries(contents)
      .filter(([, c]) => c.verse_text?.trim())
      .map(([tid, c]) =>
        supabase.from('hero_verse_translations').upsert(
          {
            hero_verse_id: Number(slideId),
            bible_translation_id: Number(tid),
            verse_text: c.verse_text.trim(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'hero_verse_id,bible_translation_id' }
        )
      )

    await Promise.all(upserts)

    setSaving(false)
    toast.success(isEdit ? 'Slide updated!' : 'Slide created!')
    navigate('/admin/hero-verses')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-4xl animate-bounce">🌿</div>
      </div>
    )
  }

  const transForLang = allTranslations.filter(
    (t) => t.languages?.code === activeLangCode
  )

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/admin/hero-verses')}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-dark)' }}>
          {isEdit ? 'Edit Hero Slide' : 'Add Hero Slide'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Slide Metadata ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Slide Settings</h2>

          {/* Verse Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verse Reference <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Psalm 119:11"
              value={form.verse_reference}
              onChange={(e) => setField('verse_reference', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          {/* Background Image URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Background Image URL
            </label>
            <input
              type="url"
              placeholder="https://…"
              value={form.background_image_url}
              onChange={(e) => setField('background_image_url', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
            />
            {/* Preview */}
            {form.background_image_url && (
              <div className="mt-2 relative rounded-xl overflow-hidden" style={{ height: 100 }}>
                <img
                  src={form.background_image_url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
                <div className="absolute inset-0" style={{ background: form.overlay_color }} />
              </div>
            )}
          </div>

          {/* Overlay Color + Sort Order + Active */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overlay Color
              </label>
              <input
                type="text"
                placeholder="rgba(27, 67, 50, 0.72)"
                value={form.overlay_color}
                onChange={(e) => setField('overlay_color', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort Order
              </label>
              <input
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) => setField('sort_order', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
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
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>
        </div>

        {/* ── Translations ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Verse Text by Language</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              English (ESV) is required. Other translations are optional.
            </p>
          </div>

          {/* Language tabs */}
          <div
            className="flex border-b border-gray-100"
            style={{ backgroundColor: 'rgba(27,67,50,0.03)' }}
          >
            {languages.map((lang) => {
              const isActive = activeLangCode === lang.code
              const langTrans = allTranslations.filter((t) => t.languages?.code === lang.code)
              const filledCount = langTrans.filter(
                (t) => contents[t.id]?.verse_text?.trim()
              ).length
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setActiveLangCode(lang.code)}
                  className="px-5 py-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2"
                  style={{
                    borderBottomColor: isActive ? 'var(--green-deep)' : 'transparent',
                    color: isActive ? 'var(--green-deep)' : '#6B7280',
                    backgroundColor: isActive ? 'rgba(27,67,50,0.06)' : 'transparent',
                  }}
                >
                  {lang.name}
                  {lang.native_name && lang.native_name !== lang.name && (
                    <span className="text-xs text-gray-400">({lang.native_name})</span>
                  )}
                  {filledCount > 0 && (
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 text-xs rounded-full text-white font-bold"
                      style={{ backgroundColor: 'var(--green-mid)', fontSize: '0.6rem' }}
                    >
                      {filledCount}
                    </span>
                  )}
                  {lang.code === 'en' && (
                    <span className="text-xs text-red-400 font-bold">*</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Translation text areas */}
          <div className="p-6 space-y-5">
            {transForLang.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No translations configured for this language.
              </p>
            )}
            {transForLang.map((trans) => {
              const c = contents[trans.id] || { verse_text: '' }
              const isFilled = Boolean(c.verse_text?.trim())
              const isRequired = trans.code === 'ESV' && trans.languages?.code === 'en'
              return (
                <div
                  key={trans.id}
                  className="rounded-xl border overflow-hidden"
                  style={{
                    borderColor: isFilled ? 'rgba(45,106,79,0.3)' : '#E5E7EB',
                    boxShadow: isFilled ? '0 0 0 1px rgba(45,106,79,0.12)' : 'none',
                  }}
                >
                  {/* Header */}
                  <div
                    className="flex items-center gap-2 px-4 py-3 border-b"
                    style={{
                      borderColor: isFilled ? 'rgba(45,106,79,0.12)' : '#F3F4F6',
                      backgroundColor: isFilled ? 'rgba(27,67,50,0.04)' : '#FAFAFA',
                    }}
                  >
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-lg"
                      style={{
                        backgroundColor: isFilled ? 'var(--green-deep)' : '#E5E7EB',
                        color: isFilled ? '#fff' : '#6B7280',
                      }}
                    >
                      {trans.code}
                    </span>
                    <span className="text-sm font-semibold text-gray-700 flex-1">{trans.name}</span>
                    {isRequired ? (
                      <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Required</span>
                    ) : (
                      <span className="text-xs text-gray-400">Optional</span>
                    )}
                    {isFilled && (
                      <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">✓ Filled</span>
                    )}
                  </div>

                  {/* Verse text */}
                  <div className="p-4">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      Verse Text {isRequired && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                      rows={4}
                      placeholder={`Enter the ${trans.code} verse text for the carousel…`}
                      value={c.verse_text}
                      onChange={(e) => setContent(trans.id, e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-y"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Submit ────────────────────────────────────────────────── */}
        <div className="flex justify-end pb-6">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: 'var(--green-mid)' }}
          >
            <Save size={16} />
            {saving ? 'Saving…' : isEdit ? 'Update Slide' : 'Create Slide'}
          </button>
        </div>
      </form>
    </div>
  )
}
