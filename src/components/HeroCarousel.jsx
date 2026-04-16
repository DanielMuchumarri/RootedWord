import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function HeroCarousel() {
  const [slides, setSlides]     = useState([])
  const [current, setCurrent]   = useState(0)
  const [prev, setPrev]         = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    supabase
      .from('hero_verses')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setSlides(data || []))
  }, [])

  const goTo = useCallback(
    (next) => {
      if (transitioning || !slides.length || next === current) return
      setTransitioning(true)
      setPrev(current)
      setCurrent(next)
      setTimeout(() => {
        setPrev(null)
        setTransitioning(false)
      }, 700)
    },
    [current, slides.length, transitioning]
  )

  const advance = useCallback(
    (dir) => {
      const next = (current + dir + slides.length) % slides.length
      goTo(next)
    },
    [current, slides.length, goTo]
  )

  // Auto-advance every 6 s
  useEffect(() => {
    if (slides.length <= 1) return
    timerRef.current = setInterval(() => advance(1), 6000)
    return () => clearInterval(timerRef.current)
  }, [slides.length, advance])

  // Pause on hover
  function pauseTimer()  { clearInterval(timerRef.current) }
  function resumeTimer() {
    if (slides.length <= 1) return
    timerRef.current = setInterval(() => advance(1), 6000)
  }

  if (!slides.length) {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{ minHeight: 420, background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 60%, #40916C 100%)' }}
      >
        <div className="text-center">
          <p className="font-serif-display text-3xl font-bold text-white mb-2">RootedWord</p>
          <p className="text-green-200 italic font-serif-display">Plant the Word. Grow in Faith.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative overflow-hidden select-none"
      style={{ minHeight: 420 }}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
    >
      {/* ── Slide layers ───────────────────────────────── */}
      {slides.map((slide, idx) => {
        const isCurrent = idx === current
        const isPrev    = idx === prev
        if (!isCurrent && !isPrev) return null

        return (
          <div
            key={slide.id}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: isCurrent ? 1 : 0, zIndex: isCurrent ? 2 : 1 }}
          >
            {/* Background image */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${slide.background_image_url})` }}
            />
            {/* Gradient overlay */}
            <div
              className="absolute inset-0"
              style={{
                background: `${slide.overlay_color}, linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 100%)`,
              }}
            />
          </div>
        )
      })}

      {/* ── Content ────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 sm:px-12 text-center"
        style={{ minHeight: 420, paddingTop: '3rem', paddingBottom: '5rem' }}>

        {/* App brand */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl drop-shadow">🌿</span>
          <span className="font-serif-display text-xl font-bold text-white tracking-wide drop-shadow">
            RootedWord
          </span>
        </div>

        {/* Decorative opening quote */}
        <div
          className="font-serif-display text-7xl sm:text-8xl leading-none mb-1 drop-shadow-lg"
          style={{ color: 'rgba(255,255,255,0.25)', lineHeight: 0.6, fontStyle: 'italic' }}
          aria-hidden
        >
          "
        </div>

        {/* Verse text — key forces re-mount/re-animate on slide change */}
        <blockquote
          key={current}
          className="animate-fade-in-up font-serif-display italic font-medium max-w-3xl mx-auto drop-shadow-lg"
          style={{
            fontSize: 'clamp(1.15rem, 2.8vw, 1.65rem)',
            lineHeight: 1.65,
            color: '#FFFFFF',
            textShadow: '0 2px 12px rgba(0,0,0,0.45)',
          }}
        >
          {slides[current]?.verse_text}
        </blockquote>

        {/* Reference + translation */}
        <div
          key={`ref-${current}`}
          className="animate-fade-in mt-5 flex items-center gap-3"
          style={{ animationDelay: '0.2s' }}
        >
          <span
            className="font-serif-display font-semibold tracking-wide text-white drop-shadow"
            style={{ fontSize: '1rem', opacity: 0.92 }}
          >
            — {slides[current]?.verse_reference}
          </span>
          <span
            className="text-xs px-2.5 py-0.5 rounded-full font-semibold tracking-widest uppercase"
            style={{
              backgroundColor: 'rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.90)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          >
            {slides[current]?.bible_translation}
          </span>
        </div>
      </div>

      {/* ── Arrow buttons ───────────────────────────────── */}
      {slides.length > 1 && (
        <>
          <button
            onClick={() => advance(-1)}
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.30)',
              backdropFilter: 'blur(6px)',
              color: '#fff',
            }}
            aria-label="Previous verse"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => advance(1)}
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.30)',
              backdropFilter: 'blur(6px)',
              color: '#fff',
            }}
            aria-label="Next verse"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* ── Dot indicators ─────────────────────────────── */}
      {slides.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className="transition-all duration-300"
              style={{
                width:  idx === current ? 24 : 8,
                height: 8,
                borderRadius: 9999,
                backgroundColor: idx === current
                  ? 'rgba(255,255,255,0.95)'
                  : 'rgba(255,255,255,0.40)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* ── Progress bar ───────────────────────────────── */}
      {slides.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 z-20 h-0.5"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
          <div
            key={current}
            className="h-full"
            style={{
              backgroundColor: 'rgba(255,255,255,0.70)',
              animation: 'progress 6s linear forwards',
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  )
}
