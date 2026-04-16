import { useNavigate } from 'react-router-dom'
import { AGE_GROUP_BY_ID } from '../lib/constants'
import { format, isToday, isPast, isFuture } from 'date-fns'

export default function VerseCard({ date, verse, ageGroupId }) {
  const navigate = useNavigate()
  const group = AGE_GROUP_BY_ID[ageGroupId]
  const dateObj = new Date(date + 'T00:00:00')
  const today = isToday(dateObj)
  const past = isPast(dateObj) && !today
  const future = isFuture(dateObj)

  function handleClick() {
    if (verse) navigate(`/verse/${verse.id}`)
  }

  return (
    <div
      onClick={handleClick}
      className={`
        relative rounded-xl border-2 p-3 min-h-[110px] flex flex-col transition-all duration-200
        ${verse ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg' : 'cursor-default'}
        ${today ? 'shadow-md' : ''}
        ${past && !verse ? 'opacity-50' : ''}
      `}
      style={{
        borderColor: today ? 'var(--gold-accent)' : verse ? group?.color : '#E5E7EB',
        backgroundColor: today
          ? '#FFFBEB'
          : verse
          ? '#FFFFFF'
          : future
          ? '#F9FAFB'
          : '#F3F4F6',
      }}
    >
      {/* Date number */}
      <div className="flex items-start justify-between mb-2">
        <span
          className={`text-sm font-bold rounded-full w-7 h-7 flex items-center justify-center ${
            today ? 'text-white' : 'text-gray-600'
          }`}
          style={{ backgroundColor: today ? 'var(--gold-accent)' : 'transparent' }}
        >
          {format(dateObj, 'd')}
        </span>
        {today && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full text-white font-semibold"
            style={{ backgroundColor: 'var(--gold-accent)' }}
          >
            Today
          </span>
        )}
      </div>

      {verse ? (
        <div className="flex-1">
          <p
            className="text-xs font-bold mb-1 truncate"
            style={{ color: group?.color }}
          >
            {verse.verse_reference}
          </p>
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed font-serif-display italic">
            {verse.verse_text}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-lg opacity-20">🍃</span>
        </div>
      )}
    </div>
  )
}
