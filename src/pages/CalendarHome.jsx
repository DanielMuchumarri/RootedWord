import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { MONTHS, AGE_GROUP_BY_ID } from '../lib/constants'
import { useMonthVerses } from '../hooks/useVerses'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import AgeGroupTabs from '../components/AgeGroupTabs'
import MonthPicker from '../components/MonthPicker'
import CalendarGrid from '../components/CalendarGrid'
import HeroCarousel from '../components/HeroCarousel'

export default function CalendarHome() {
  const now = new Date()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read state from URL; fall back to sensible defaults
  const year       = parseInt(searchParams.get('year')  || now.getFullYear(), 10)
  const month      = parseInt(searchParams.get('month') || (now.getMonth() + 1), 10)
  const ageGroupId = parseInt(searchParams.get('group') || 1, 10)

  // Write state back to URL (replace — no extra history entries for tab/month changes)
  function setYear(y)        { setSearchParams({ group: ageGroupId, year: y, month }, { replace: true }) }
  function setMonth(m)       { setSearchParams({ group: ageGroupId, year, month: m }, { replace: true }) }
  function setAgeGroupId(g)  { setSearchParams({ group: g, year, month }, { replace: true }) }

  const { selectedTranslation, defaultTranslation } = useUserPreferences()
  const { verses, loading } = useMonthVerses(
    year, month, ageGroupId,
    selectedTranslation?.id ?? null,
    defaultTranslation?.id ?? null
  )
  const group = AGE_GROUP_BY_ID[ageGroupId]

  function handleMonthChange(y, m) {
    setSearchParams({ group: ageGroupId, year: y, month: m }, { replace: true })
  }

  const monthName = MONTHS[month - 1]
  const pageTitle = `Bible Memory Verses — ${monthName} ${year} | RootedWord`
  const pageDesc  = `Daily Bible memory verses for ${monthName} ${year}. Scripture structured for kids (Little Roots), youth (Growing Roots), and adults (Deep Roots).`

  return (
    <div>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta property="og:title"       content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url"         content="https://rootedword.com/" />
        <link rel="canonical"           href="https://rootedword.com/" />
      </Helmet>

      {/* Hero Carousel */}
      <HeroCarousel />

      {/* Controls */}
      <div
        className="sticky top-14 z-30 border-b shadow-sm"
        style={{ backgroundColor: 'var(--parchment)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Row 1 — age group tabs (full width on mobile) */}
          <div className="pt-3 pb-2">
            <AgeGroupTabs activeGroupId={ageGroupId} onChange={setAgeGroupId} />
          </div>
          {/* Row 2 — month picker right-aligned */}
          <div className="flex justify-end pb-3">
            <MonthPicker year={year} month={month} onChange={handleMonthChange} />
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-dark)' }}>
            {MONTHS[month - 1]} {year}
          </h2>
          <span
            className="text-xs px-2.5 py-0.5 rounded-full text-white font-medium"
            style={{ backgroundColor: group.color }}
          >
            {group.label}
          </span>
          {!loading && (
            <span className="text-xs text-gray-400 ml-1">
              {verses.length} verse{verses.length !== 1 ? 's' : ''} this month
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-4xl animate-bounce">🌱</div>
          </div>
        ) : (
          <CalendarGrid
            year={year}
            month={month}
            verses={verses}
            ageGroupId={ageGroupId}
          />
        )}
      </div>
    </div>
  )
}
