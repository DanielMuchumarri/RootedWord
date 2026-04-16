import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTHS } from '../lib/constants'

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i)

export default function MonthPicker({ year, month, onChange }) {
  function prev() {
    if (month === 1) onChange(year - 1, 12)
    else onChange(year, month - 1)
  }
  function next() {
    if (month === 12) onChange(year + 1, 1)
    else onChange(year, month + 1)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
      <button
        onClick={prev}
        className="p-1.5 rounded-lg hover:bg-green-100 transition-colors text-green-800"
      >
        <ChevronLeft size={18} />
      </button>

      <select
        value={month}
        onChange={(e) => onChange(year, Number(e.target.value))}
        className="border border-green-300 rounded-lg px-2 py-1.5 text-sm bg-white text-green-900 focus:outline-none focus:ring-2 focus:ring-green-400"
      >
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>

      <select
        value={year}
        onChange={(e) => onChange(Number(e.target.value), month)}
        className="border border-green-300 rounded-lg px-2 py-1.5 text-sm bg-white text-green-900 focus:outline-none focus:ring-2 focus:ring-green-400"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      <button
        onClick={next}
        className="p-1.5 rounded-lg hover:bg-green-100 transition-colors text-green-800"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
