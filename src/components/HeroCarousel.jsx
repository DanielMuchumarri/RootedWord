import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/* Ken-Burns pan/zoom variants — one per slide slot */
const KB = [
  'kenburns-a',
  'kenburns-b',
  'kenburns-c',
  'kenburns-d',
  'kenburns-e',
]

export default function HeroCarousel() {
  const [slides, setSlides]           = useState([])
  const [current, setCurrent]         = useState(0)
  const [prev, setPrev]               = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const timerRef                      = useRef(null)

  /* ── Load slides from Supabase ─────────────────────── */
  useEffect(() => {
    supabase
      .from('hero_verses')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setSlides(data || []))
  }, [])

  /* ── Navigation ─────────────────────────────────────── */
  const goTo = useCallback(
    (next) => {
      if (transitioning || !slides.length || next === current) return
      setTransitioning(true)
      setPrev(current)
      setCurrent(next)
      setTimeout(() => { setPrev(null); setTransitioning(false) }, 800)
    },
    [current, slides.length, transitioning]
  )

  const advance = useCallback(
    (dir) => goTo((current + dir + slides.length) % slides.length),
    [current, slides.length, goTo]
  )

  /* ── Auto-advance ───────────────────────────────────── */
  useEffect(() => {
    if (slides.length <= 1) return
    timerRef.current = setInterval(() => advance(1), 7000)
    return () => clearInterval(timerRef.current)
  }, [slides.length, advance])

  const pauseTimer  = () => clearInterval(timerRef.current)
  const resumeTimer = () => {
    if (slides.length <= 1) return
    timerRef.current = setInterval(() => advance(1), 7000)
  }

  /* ── Loading / empty state ──────────────────────────── */
  if (!slides.length) {
    return (
      <div className="relative flex items-center justify-center"
        style={{ height: 520, background: 'linear-gradient(135deg,#1B4332 0%,#2D6A4F 60%,#40916C 100%)' }}>
        <div className="text-center">
          <span className="text-4xl">🌿</span>
          <p className="font-serif-display text-3xl font-bold text-white mt-3">RootedWord</p>
          <p className="text-green-200 italic font-serif-display mt-1">Plant the Word. Grow in Faith.</p>
        </div>
      </div>
    )
  }

  const slide = slides[current]

  return (
    <div
      className="relative overflow-hidden select-none"
      style={{ height: 520 }}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
    >

      {/* ═══════════════════════════════════════════════════
          BACKGROUND LAYERS — cross-fade between slides
      ════════════════════════════════════════════════════ */}
      {slides.map((s, idx) => {
        const isCurrent = idx === current
        const isPrev    = idx === prev
        if (!isCurrent && !isPrev) return null
        return (
          <div
            key={s.id}
            className="absolute inset-0"
            style={{
              opacity: isCurrent ? 1 : 0,
              transition: 'opacity 0.9s ease-in-out',
              zIndex: isCurrent ? 2 : 1,
            }}
          >
            {/* Photo with Ken-Burns zoom */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${s.background_image_url})`,
                animation: `${KB[idx % KB.length]} 14s ease-in-out infinite alternate`,
                transformOrigin: 'center center',
              }}
            />

            {/* Layer 1 – vignette (darkens edges) */}
            <div className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 60% 40%, transparent 30%, rgba(0,0,0,0.55) 100%)' }} />

            {/* Layer 2 – bottom gradient (ensures card area is dark) */}
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.30) 40%, rgba(0,0,0,0.60) 100%)' }} />

            {/* Layer 3 – tonal colour from DB (brand consistency) */}
            <div className="absolute inset-0"
              style={{ background: s.overlay_color, mixBlendMode: 'multiply' }} />
          </div>
        )
      })}

      {/* ═══════════════════════════════════════════════════
          FROSTED GLASS VERSE CARD
      ════════════════════════════════════════════════════ */}
      <div className="absolute inset-0 z-10 flex items-center justify-center px-5 sm:px-10"
        style={{ paddingTop: 40, paddingBottom: 64 }}>
        <div
          key={current}
          className="animate-fade-in-up w-full max-w-2xl rounded-2xl sm:rounded-3xl px-7 sm:px-10 py-8 sm:py-10"
          style={{
            background: 'rgba(8, 28, 18, 0.62)',
            backdropFilter: 'blur(28px) saturate(160%)',
            WebkitBackdropFilter: 'blur(28px) saturate(160%)',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10)',
          }}
        >
          {/* Decorative quote mark */}
          <div
            className="font-serif-display font-bold leading-none mb-3 select-none"
            aria-hidden
            style={{
              fontSize: '4.5rem',
              lineHeight: 0.75,
              color: 'var(--gold-accent)',
              opacity: 0.85,
              fontStyle: 'italic',
            }}
          >
            "
          </div>

          {/* Verse text */}
          <blockquote
            className="font-serif-display italic font-medium"
            style={{
              fontSize: 'clamp(1.1rem, 2.4vw, 1.5rem)',
              lineHeight: 1.72,
              color: '#FFFFFF',
              letterSpacing: '0.01em',
            }}
          >
            {slide.verse_text}
          </blockquote>

          {/* Divider */}
          <div className="my-5" style={{ height: 1, background: 'rgba(255,255,255,0.15)' }} />

          {/* Reference row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span
              className="font-serif-display font-semibold"
              style={{ color: 'var(--gold-accent)', fontSize: '1.05rem', letterSpacing: '0.02em' }}
            >
              — {slide.verse_reference}
            </span>
            <span
              className="text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full"
              style={{
                background: 'rgba(212, 160, 23, 0.22)',
                color: '#F5C842',
                border: '1px solid rgba(212, 160, 23, 0.40)',
                letterSpacing: '0.12em',
              }}
            >
              {slide.bible_translation}
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          ARROW BUTTONS
      ════════════════════════════════════════════════════ */}
      {slides.length > 1 && (
        <>
          {[[-1, 'left-3 sm:left-5', 'Previous'], [1, 'right-3 sm:right-5', 'Next']].map(
            ([dir, pos, label]) => (
              <button
                key={label}
                onClick={() => advance(dir)}
                aria-label={`${label} verse`}
                className={`absolute ${pos} top-1/2 -translate-y-1/2 z-20
                            w-10 h-10 sm:w-12 sm:h-12 rounded-full
                            flex items-center justify-center
                            transition-all duration-200 hover:scale-110 active:scale-95`}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.28)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color: '#fff',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
                }}
              >
                {dir === -1 ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
              </button>
            )
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════
          SLIDE COUNTER + DOTS
      ════════════════════════════════════════════════════ */}
      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20
                        flex items-center gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              aria-label={`Slide ${idx + 1}`}
              className="transition-all duration-400"
              style={{
                width:           idx === current ? 28 : 8,
                height:          8,
                borderRadius:    999,
                padding:         0,
                border:          'none',
                cursor:          'pointer',
                backgroundColor: idx === current
                  ? 'var(--gold-accent)'
                  : 'rgba(255,255,255,0.35)',
                boxShadow: idx === current ? '0 0 8px rgba(212,160,23,0.6)' : 'none',
              }}
            />
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          PROGRESS BAR
      ════════════════════════════════════════════════════ */}
      {slides.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 z-30"
          style={{ height: 3, background: 'rgba(255,255,255,0.10)' }}>
          <div
            key={`pb-${current}`}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, var(--gold-accent), #F5C842)',
              animation: 'rw-progress 7s linear forwards',
              boxShadow: '0 0 6px rgba(212,160,23,0.8)',
            }}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          KEYFRAME STYLES
      ════════════════════════════════════════════════════ */}
      <style>{`
        @keyframes rw-progress {
          from { width: 0% }
          to   { width: 100% }
        }
        @keyframes kenburns-a {
          from { transform: scale(1.00) translate(0%,    0%)   }
          to   { transform: scale(1.10) translate(-1.5%, -1%)  }
        }
        @keyframes kenburns-b {
          from { transform: scale(1.06) translate(-1%,   1%)   }
          to   { transform: scale(1.00) translate(0%,    0%)   }
        }
        @keyframes kenburns-c {
          from { transform: scale(1.00) translate(1%,    0%)   }
          to   { transform: scale(1.08) translate(-0.5%, 1%)   }
        }
        @keyframes kenburns-d {
          from { transform: scale(1.08) translate(0%,   -1%)   }
          to   { transform: scale(1.00) translate(1%,    0.5%) }
        }
        @keyframes kenburns-e {
          from { transform: scale(1.04) translate(-0.5%, 0.5%) }
          to   { transform: scale(1.10) translate(0.5%, -0.5%) }
        }
      `}</style>
    </div>
  )
}
