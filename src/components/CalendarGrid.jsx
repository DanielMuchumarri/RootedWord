import { getDaysInMonth, format } from 'date-fns'
import VerseCard from './VerseCard'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarGrid({ year, month, verses, ageGroupId }) {
  const daysInMonth = getDaysInMonth(new Date(year, month - 1))
  const firstDay = new Date(year, month - 1, 1).getDay()

  // Map verses by date string
  const verseMap = {}
  verses.forEach((v) => {
    verseMap[v.verse_date] = v
  })

  const cells = []
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    cells.push(null)
  }
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d)
  }

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-gray-400 py-1 hidden sm:block">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid — 7 cols desktop, 2 cols mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="hidden lg:block" />
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const verse = verseMap[dateStr]
          return (
            <VerseCard
              key={dateStr}
              date={dateStr}
              verse={verse}
              ageGroupId={ageGroupId}
            />
          )
        })}
      </div>
    </div>
  )
}
