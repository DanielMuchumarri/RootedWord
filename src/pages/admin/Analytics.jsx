import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AGE_GROUP_BY_ID } from '../../lib/constants'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { format, parseISO, subMonths } from 'date-fns'
import { Download } from 'lucide-react'

const PIE_COLORS = ['#40916C', '#2D6A4F', '#1B4332']

export default function Analytics() {
  const [topVerses, setTopVerses] = useState([])
  const [monthlyData, setMonthlyData] = useState([])
  const [groupData, setGroupData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Top verses by all-time hits
      const { data: hitCounts } = await supabase
        .from('verse_hit_counts')
        .select('verse_id, total_hits, hits_this_month, last_viewed_at')
        .order('total_hits', { ascending: false })
        .limit(10)

      if (hitCounts?.length) {
        const ids = hitCounts.map((h) => h.verse_id)
        const { data: verseData } = await supabase
          .from('memory_verses')
          .select('id, verse_reference, verse_date, age_group_id')
          .in('id', ids)

        const verseMap = Object.fromEntries((verseData || []).map((v) => [v.id, v]))
        setTopVerses(
          hitCounts.map((h) => ({ ...h, verse: verseMap[h.verse_id] }))
        )
      }

      // Monthly hits for last 6 months
      const sixMonthsAgo = subMonths(new Date(), 5)
      const { data: hitRows } = await supabase
        .from('verse_hits')
        .select('viewed_at, verse_id')
        .gte('viewed_at', sixMonthsAgo.toISOString())

      if (hitRows) {
        const monthly = {}
        hitRows.forEach((h) => {
          const key = format(new Date(h.viewed_at), 'MMM yyyy')
          monthly[key] = (monthly[key] || 0) + 1
        })
        const sorted = []
        for (let i = 5; i >= 0; i--) {
          const d = subMonths(new Date(), i)
          const key = format(d, 'MMM yyyy')
          sorted.push({ month: format(d, 'MMM'), hits: monthly[key] || 0 })
        }
        setMonthlyData(sorted)
      }

      // Hits by age group
      const { data: allHits } = await supabase
        .from('verse_hits')
        .select('verse_id')

      if (allHits?.length) {
        const { data: allVerses } = await supabase
          .from('memory_verses')
          .select('id, age_group_id')

        const verseGroupMap = Object.fromEntries((allVerses || []).map((v) => [v.id, v.age_group_id]))
        const groupCounts = { 1: 0, 2: 0, 3: 0 }
        allHits.forEach((h) => {
          const gid = verseGroupMap[h.verse_id]
          if (gid) groupCounts[gid] = (groupCounts[gid] || 0) + 1
        })
        setGroupData(
          Object.entries(groupCounts).map(([gid, hits]) => ({
            name: AGE_GROUP_BY_ID[gid]?.label,
            hits,
          }))
        )
      }

      setLoading(false)
    }
    load()
  }, [])

  function exportCSV() {
    const rows = [
      ['Verse Reference', 'Date', 'Age Group', 'Total Hits', 'This Month', 'Last Viewed'],
      ...topVerses.map((h) => [
        h.verse?.verse_reference ?? '',
        h.verse?.verse_date ?? '',
        AGE_GROUP_BY_ID[h.verse?.age_group_id]?.label ?? '',
        h.total_hits,
        h.hits_this_month,
        h.last_viewed_at ? format(new Date(h.last_viewed_at), 'yyyy-MM-dd') : '',
      ]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rootedword-hits-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-4xl animate-bounce">🌿</div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-dark)' }}>Analytics</h1>
          <p className="text-sm text-gray-500">Verse view tracking and engagement</p>
        </div>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4">Monthly Hits (Last 6 Months)</h2>
          {monthlyData.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No hit data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="hits" fill="var(--green-mid)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Group pie chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4">Hits by Age Group</h2>
          {groupData.every((g) => g.hits === 0) ? (
            <p className="text-gray-400 text-sm text-center py-8">No hit data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={groupData} dataKey="hits" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {groupData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top 10 verses table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-50">
          <h2 className="font-bold text-gray-800">Top Verses — All Time</h2>
        </div>
        {topVerses.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-10">No data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reference</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Group</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Hits</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">This Month</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topVerses.map((h, i) => {
                  const group = AGE_GROUP_BY_ID[h.verse?.age_group_id]
                  return (
                    <tr key={h.verse_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {h.verse?.verse_reference ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {h.verse?.verse_date ? format(parseISO(h.verse.verse_date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {group && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                            style={{ backgroundColor: group.color }}
                          >
                            {group.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--green-mid)' }}>
                        {Number(h.total_hits).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 hidden lg:table-cell">
                        {Number(h.hits_this_month).toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
