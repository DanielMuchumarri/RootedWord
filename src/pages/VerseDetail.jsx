import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { AGE_GROUP_BY_ID } from '../lib/constants'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, ArrowLeft, Copy, Check, Eye, EyeOff } from 'lucide-react'
import { useUserPreferences } from '../contexts/UserPreferencesContext'

export default function VerseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const calendarHref = location.state?.from || '/'

  const { selectedTranslation, defaultTranslation, prefs, setPrefs } = useUserPreferences()

  const [verse, setVerse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [adjVerses, setAdjVerses] = useState({ prev: null, next: null })
  const [showEnglish, setShowEnglish] = useState(prefs.showOriginal)

  useEffect(() => {
    setShowEnglish(prefs.showOriginal)
  }, [prefs.showOriginal])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    supabase
      .from('memory_verses')
      .select(`
        *,
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
      .then(({ data }) => {
        setVerse(data)
        setLoading(false)
        if (data) {
          recordHit(data.id)
          fetchAdjacent(data.verse_date, data.age_group_id)
        }
      })
  }, [id])

  async function recordHit(verseId) {
    await supabase.from('verse_hits').insert({
      verse_id: verseId,
      user_agent: navigator.userAgent,
      referrer: document.referrer || null,
      session_id: sessionStorage.getItem('rw_session') ?? (() => {
        const s = Math.random().toString(36).slice(2)
        sessionStorage.setItem('rw_session', s)
        return s
      })(),
    })
  }

  async function fetchAdjacent(verseDate, ageGroupId) {
    const [prevRes, nextRes] = await Promise.all([
      supabase
        .from('memory_verses')
        .select('id, verse_date, verse_reference')
        .eq('age_group_id', ageGroupId)
        .eq('is_active', true)
        .lt('verse_date', verseDate)
        .order('verse_date', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('memory_verses')
        .select('id, verse_date, verse_reference')
        .eq('age_group_id', ageGroupId)
        .eq('is_active', true)
        .gt('verse_date', verseDate)
        .order('verse_date', { ascending: true })
        .limit(1)
        .single(),
    ])
    setAdjVerses({ prev: prevRes.data, next: nextRes.data })
  }

  // ── Translation resolution ─────────────────────────────────────────────────
  // Look up a verse_translations row by its bible_translations.id
  function getContent(bibleTranslationId) {
    return verse?.verse_translations?.find(
      (c) => c.bible_translation_id === bibleTranslationId
    ) || null
  }

  // The content row that matches the user's selected bible translation
  const matchedContent  = selectedTranslation ? getContent(selectedTranslation.id)  : null
  // The fallback English/ESV content row
  const fallbackContent = defaultTranslation  ? getContent(defaultTranslation.id)   : null

  // Primary display: selected translation → fallback (ESV)
  const primaryContent  = matchedContent || fallbackContent
  const displayText     = primaryContent?.verse_text ?? ''
  const displayCode     = primaryContent?.bible_translations?.code ?? defaultTranslation?.code ?? 'ESV'

  const isNonEnglish        = prefs.languageCode !== 'en'
  const hasSelectedContent  = Boolean(matchedContent)
  const missingTranslation  = isNonEnglish && !hasSelectedContent

  // ── Reflection — per language, not per translation ────────────────────────
  const langRefls = verse?.verse_language_reflections || []

  // Language id of the currently displayed translation
  const activeLangId = primaryContent?.bible_translations?.language_id
    ?? selectedTranslation?.language_id
    ?? null

  // Reflection for the active language; fallback to English
  const displayReflection =
    (activeLangId ? langRefls.find((r) => r.language_id === activeLangId)?.reflection : null)
    ?? langRefls.find((r) => r.languages?.code === 'en')?.reflection
    ?? ''

  // English reflection shown in the "alongside" panel
  const englishReflection =
    langRefls.find((r) => r.languages?.code === 'en')?.reflection
    ?? ''

  // Live It Out — same resolution pattern as reflection
  const displayLiveItOut =
    (activeLangId ? langRefls.find((r) => r.language_id === activeLangId)?.live_it_out : null)
    ?? langRefls.find((r) => r.languages?.code === 'en')?.live_it_out
    ?? ''

  // English content for "show alongside"
  const englishText = fallbackContent?.verse_text ?? ''
  const englishCode = fallbackContent?.bible_translations?.code ?? defaultTranslation?.code ?? 'ESV'

  async function handleCopy() {
    if (!verse) return
    const text = `${displayText}\n— ${verse.verse_reference} (${displayCode})`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleToggleEnglish() {
    const next = !showEnglish
    setShowEnglish(next)
    setPrefs({ showOriginal: next })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-5xl animate-bounce">🌿</div>
      </div>
    )
  }

  if (!verse) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Verse not found.</p>
        <Link to="/" className="text-green-700 underline">Back to Calendar</Link>
      </div>
    )
  }

  const group   = AGE_GROUP_BY_ID[verse.age_group_id]
  const dateObj = parseISO(verse.verse_date)

  // SEO helpers
  const formattedDate = format(dateObj, 'MMMM d, yyyy')
  const snippet = displayReflection
    ? displayReflection.slice(0, 140).trimEnd() + (displayReflection.length > 140 ? '…' : '')
    : displayText.slice(0, 140).trimEnd() + (displayText.length > 140 ? '…' : '')
  const verseTitle = `${verse.verse_reference} — ${formattedDate} | Rooted God's Word`
  const verseDesc  = `Memorize ${verse.verse_reference} with reflection and application. ${snippet}`
  const verseUrl   = `https://rootedgodsword.com/verse/${verse.id}`

  const ldJson = {
    '@context':     'https://schema.org',
    '@type':        'Article',
    headline:       verse.verse_reference,
    description:    verseDesc,
    datePublished:  verse.verse_date,
    author:    { '@type': 'Organization', name: "Rooted God's Word" },
    publisher: { '@type': 'Organization', name: "Rooted God's Word", url: 'https://rootedgodsword.com' },
    url:            verseUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': verseUrl },
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in-up">
      <Helmet>
        <title>{verseTitle}</title>
        <meta name="description"          content={verseDesc} />
        <meta property="og:title"         content={`${verse.verse_reference} | Rooted God's Word Memory Verse`} />
        <meta property="og:description"   content={verseDesc} />
        <meta property="og:url"           content={verseUrl} />
        <meta property="og:type"          content="article" />
        <meta property="article:published_time" content={verse.verse_date} />
        <link rel="canonical"             href={verseUrl} />
        <script type="application/ld+json">{JSON.stringify(ldJson)}</script>
      </Helmet>
      {/* Back button */}
      <Link
        to={calendarHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors hover:opacity-80"
        style={{ color: group.color }}
      >
        <ArrowLeft size={16} />
        Back to Calendar
      </Link>

      {/* Date display */}
      <p className="text-gray-400 text-sm uppercase tracking-widest mb-1 font-medium">
        Memory Verse
      </p>
      <h1
        className="font-serif-display text-3xl sm:text-4xl font-bold mb-4"
        style={{ color: 'var(--text-dark)' }}
      >
        {format(dateObj, 'EEEE, MMMM d, yyyy')}
      </h1>

      {/* Age group badge */}
      <span
        className="inline-block text-xs px-3 py-1 rounded-full text-white font-semibold mb-6"
        style={{ backgroundColor: group.color }}
      >
        {group.label} · {group.ageRange}
      </span>

      {/* Missing translation notice */}
      {missingTranslation && (
        <div
          className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-sm"
          style={{ backgroundColor: 'rgba(212,160,23,0.12)', borderLeft: '3px solid var(--gold-accent)' }}
        >
          <span className="text-lg">🌐</span>
          <span style={{ color: 'var(--text-dark)' }}>
            {selectedTranslation?.languages?.name || 'This language'} translation not yet available —
            showing English ({englishCode}).
          </span>
        </div>
      )}

      {/* Primary verse card */}
      <div
        className="rounded-2xl p-6 sm:p-8 mb-4 shadow-sm border"
        style={{ backgroundColor: '#FFFDF7', borderColor: '#E8DEC8' }}
      >
        {/* Reference + translation badge row */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <span className="font-bold text-lg" style={{ color: group.color }}>
            {verse.verse_reference}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {isNonEnglish && hasSelectedContent && (
              <span
                className="text-xs px-2.5 py-0.5 rounded-full font-semibold text-white"
                style={{ backgroundColor: group.color }}
              >
                {selectedTranslation?.languages?.native_name ||
                  selectedTranslation?.languages?.name || ''}
              </span>
            )}
            <span className="text-xs border rounded-full px-2.5 py-0.5 text-gray-400 border-gray-200">
              {displayCode}
            </span>
          </div>
        </div>

        {/* Verse text */}
        <blockquote
          className="font-serif-display text-xl sm:text-2xl leading-relaxed text-gray-800 italic border-l-4 pl-4 mb-2"
          style={{ borderColor: group.color }}
        >
          "{displayText}"
        </blockquote>

        {/* Action row */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-all duration-200 font-medium"
            style={{
              backgroundColor: copied ? '#D1FAE5' : 'var(--green-pale)',
              color: copied ? '#065F46' : group.color,
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copied!' : 'Copy Verse'}
          </button>

          {/* Show/hide English alongside (only for non-English with a real translation) */}
          {isNonEnglish && hasSelectedContent && (
            <button
              onClick={handleToggleEnglish}
              className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-all duration-200 font-medium"
              style={{
                borderColor: showEnglish ? group.color : '#D1D5DB',
                color: showEnglish ? group.color : '#6B7280',
                backgroundColor: showEnglish ? `${group.color}12` : 'transparent',
              }}
            >
              {showEnglish ? <Eye size={15} /> : <EyeOff size={15} />}
              {showEnglish ? 'Hide English' : 'Show English'}
            </button>
          )}
        </div>
      </div>

      {/* English alongside card */}
      {isNonEnglish && hasSelectedContent && showEnglish && (
        <div
          className="rounded-2xl p-6 mb-4 border"
          style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">English</span>
            <span className="text-xs border rounded-full px-2 py-0.5 text-gray-400 border-gray-200">
              {englishCode}
            </span>
          </div>
          <blockquote
            className="font-serif-display text-lg sm:text-xl leading-relaxed text-gray-600 italic border-l-4 pl-4"
            style={{ borderColor: '#D1D5DB' }}
          >
            "{englishText}"
          </blockquote>
        </div>
      )}

      {/* Reflection */}
      <div
        className="rounded-2xl p-6 sm:p-8 mb-8 border"
        style={{ backgroundColor: 'var(--green-pale)', borderColor: 'var(--green-light)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🌿</span>
          <h2 className="font-bold text-base" style={{ color: 'var(--green-deep)' }}>
            Reflection
          </h2>
          {isNonEnglish && hasSelectedContent && (
            <span className="text-xs text-gray-400 ml-1">
              ({selectedTranslation?.languages?.native_name || selectedTranslation?.languages?.name})
            </span>
          )}
        </div>
        <p
          className="text-gray-700 leading-relaxed"
          style={{ fontSize: group.id === 1 ? '1.1rem' : '1rem' }}
        >
          {displayReflection}
        </p>

        {/* English reflection alongside */}
        {isNonEnglish && hasSelectedContent && showEnglish && englishReflection && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(27,67,50,0.15)' }}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              English Reflection
            </p>
            <p className="text-gray-600 leading-relaxed text-sm">{englishReflection}</p>
          </div>
        )}
      </div>

      {/* Live It Out */}
      {displayLiveItOut && (
        <div
          className="rounded-2xl p-6 sm:p-8 mb-8 border"
          style={{
            backgroundColor: 'rgba(212,160,23,0.06)',
            borderColor: 'rgba(212,160,23,0.35)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">✋</span>
            <h2 className="font-bold text-base" style={{ color: '#92600A' }}>
              Live It Out
            </h2>
            {isNonEnglish && hasSelectedContent && (
              <span className="text-xs text-gray-400 ml-1">
                ({selectedTranslation?.languages?.native_name || selectedTranslation?.languages?.name})
              </span>
            )}
          </div>
          {(() => {
            // Split "1. text 2. text 3. text" into individual numbered points
            const parts = displayLiveItOut.split(/(?=\d+\.\s)/).map((s) => s.trim()).filter(Boolean)
            const isList = parts.length > 1 && parts.every((p) => /^\d+\./.test(p))
            const fontSize = { fontSize: group.id === 1 ? '1.05rem' : '1rem' }
            if (isList) {
              return (
                <ol className="space-y-2 list-none" style={fontSize}>
                  {parts.map((item, i) => (
                    <li key={i} className="flex gap-2 text-gray-700 leading-relaxed">
                      <span className="font-semibold shrink-0" style={{ color: '#92600A' }}>
                        {i + 1}.
                      </span>
                      <span>{item.replace(/^\d+\.\s*/, '')}</span>
                    </li>
                  ))}
                </ol>
              )
            }
            return (
              <div className="text-gray-700 leading-relaxed whitespace-pre-line" style={fontSize}>
                {displayLiveItOut}
              </div>
            )
          })()}
        </div>
      )}

      {/* Prev / Next navigation */}
      <div className="flex items-center justify-between gap-4">
        {adjVerses.prev ? (
          <button
            onClick={() => navigate(`/verse/${adjVerses.prev.id}`, { state: { from: calendarHref } })}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border transition-all hover:shadow-sm"
            style={{ borderColor: group.color, color: group.color }}
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">
              {format(parseISO(adjVerses.prev.verse_date), 'MMM d')} · {adjVerses.prev.verse_reference}
            </span>
            <span className="sm:hidden">Previous</span>
          </button>
        ) : <div />}

        {adjVerses.next ? (
          <button
            onClick={() => navigate(`/verse/${adjVerses.next.id}`, { state: { from: calendarHref } })}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border transition-all hover:shadow-sm ml-auto"
            style={{ borderColor: group.color, color: group.color }}
          >
            <span className="hidden sm:inline">
              {format(parseISO(adjVerses.next.verse_date), 'MMM d')} · {adjVerses.next.verse_reference}
            </span>
            <span className="sm:hidden">Next</span>
            <ChevronRight size={16} />
          </button>
        ) : <div />}
      </div>
    </div>
  )
}
