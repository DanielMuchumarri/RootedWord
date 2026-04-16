import { useState } from 'react'
import { MONTHS, AGE_GROUP_BY_ID } from '../lib/constants'
import { useMonthVerses } from '../hooks/useVerses'
import AgeGroupTabs from '../components/AgeGroupTabs'
import MonthPicker from '../components/MonthPicker'
import CalendarGrid from '../components/CalendarGrid'
import HeroCarousel from '../components/HeroCarousel'

export default function CalendarHome() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [ageGroupId, setAgeGroupId] = useState(1)

  const { verses, loading } = useMonthVerses(year, month, ageGroupId)
  const group = AGE_GROUP_BY_ID[ageGroupId]

  function handleMonthChange(y, m) {
    setYear(y)
    setMonth(m)
  }

  return (
    <div>
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
