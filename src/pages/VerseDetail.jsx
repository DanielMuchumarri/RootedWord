import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AGE_GROUP_BY_ID } from '../lib/constants'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, ArrowLeft, Copy, Check } from 'lucide-react'

export default function VerseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  // Restore the exact calendar URL the user came from (group + month + year)
  const calendarHref = location.state?.from || '/'
  const [verse, setVerse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [adjVerses, setAdjVerses] = useState({ prev: null, next: null })

  useEffect(() => {
    if (!id) return
    setLoading(true)
    supabase
      .from('memory_verses')
      .select('*, age_groups(slug, label, color_hex)')
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

  async function handleCopy() {
    if (!verse) return
    const text = `${verse.verse_text}\n— ${verse.verse_reference} (${verse.bible_translation})`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  const group = AGE_GROUP_BY_ID[verse.age_group_id]
  const dateObj = parseISO(verse.verse_date)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in-up">
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
      <h1 className="font-serif-display text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--text-dark)' }}>
        {format(dateObj, 'EEEE, MMMM d, yyyy')}
      </h1>

      {/* Age group badge */}
      <span
        className="inline-block text-xs px-3 py-1 rounded-full text-white font-semibold mb-6"
        style={{ backgroundColor: group.color }}
      >
        {group.label} · {group.ageRange}
      </span>

      {/* Verse card */}
      <div
        className="rounded-2xl p-6 sm:p-8 mb-6 shadow-sm border"
        style={{ backgroundColor: '#FFFDF7', borderColor: '#E8DEC8' }}
      >
        {/* Reference */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <span
            className="font-bold text-lg"
            style={{ color: group.color }}
          >
            {verse.verse_reference}
          </span>
          <span className="text-xs border rounded-full px-2.5 py-0.5 text-gray-400 border-gray-200">
            {verse.bible_translation}
          </span>
        </div>

        {/* Verse text */}
        <blockquote className="font-serif-display text-xl sm:text-2xl leading-relaxed text-gray-800 italic border-l-4 pl-4 mb-2"
          style={{ borderColor: group.color }}>
          "{verse.verse_text}"
        </blockquote>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="mt-4 inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-all duration-200 font-medium"
          style={{
            backgroundColor: copied ? '#D1FAE5' : 'var(--green-pale)',
            color: copied ? '#065F46' : group.color,
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? 'Copied!' : 'Copy Verse'}
        </button>
      </div>

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
        </div>
        <p className="text-gray-700 leading-relaxed" style={{ fontSize: group.id === 1 ? '1.1rem' : '1rem' }}>
          {verse.reflection}
        </p>
      </div>

      {/* Prev / Next navigation */}
      <div className="flex items-center justify-between gap-4">
        {adjVerses.prev ? (
          <button
            onClick={() => navigate(`/verse/${adjVerses.prev.id}`)}
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
            onClick={() => navigate(`/verse/${adjVerses.next.id}`)}
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
