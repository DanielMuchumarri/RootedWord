import { useState } from 'react'
import { MONTHS, AGE_GROUP_BY_ID } from '../lib/constants'
import { useMonthVerses } from '../hooks/useVerses'
import AgeGroupTabs from '../components/AgeGroupTabs'
import MonthPicker from '../components/MonthPicker'
import CalendarGrid from '../components/CalendarGrid'

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
      {/* Hero */}
      <div
        className="relative py-14 px-4 text-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${group.color} 0%, #40916C 50%, #52B788 100%)`,
        }}
      >
        <div className="relative z-10 max-w-2xl mx-auto animate-fade-in-up">
          <p className="text-green-200 text-sm font-medium tracking-widest uppercase mb-2">
            Colossians 2:7
          </p>
          <h1 className="font-serif-display text-4xl sm:text-5xl font-bold text-white mb-3">
            RootedWord
          </h1>
          <p className="text-green-100 text-lg italic font-serif-display">
            Plant the Word. Grow in Faith.
          </p>
        </div>
        {/* Decorative leaves */}
        <div className="absolute left-4 top-4 text-4xl opacity-20 select-none">🌿</div>
        <div className="absolute right-8 bottom-4 text-5xl opacity-15 select-none rotate-45">🍃</div>
        <div className="absolute right-4 top-8 text-3xl opacity-10 select-none">🌱</div>
      </div>

      {/* Controls */}
      <div
        className="sticky top-14 z-30 border-b px-4 sm:px-6 py-3 shadow-sm"
        style={{ backgroundColor: 'var(--parchment)' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-3 items-center justify-between">
          <AgeGroupTabs activeGroupId={ageGroupId} onChange={setAgeGroupId} />
          <MonthPicker year={year} month={month} onChange={handleMonthChange} />
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
