import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AGE_GROUP_BY_ID } from '../../lib/constants'
import StatCard from '../../components/StatCard'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { PlusCircle, Edit2 } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [topVerse, setTopVerse] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [versesRes, hitsRes, recentRes, topRes] = await Promise.all([
        supabase.from('memory_verses').select('id, age_group_id, is_active', { count: 'exact' }),
        supabase.from('verse_hits').select('id', { count: 'exact' }),
        supabase
          .from('memory_verses')
          .select('id, verse_date, verse_reference, age_group_id, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('verse_hit_counts')
          .select('verse_id, total_hits, hits_this_month')
          .order('hits_this_month', { ascending: false })
          .limit(1)
          .single(),
      ])

      const verses = versesRes.data || []
      const totalVerses = versesRes.count ?? 0
      const totalHits = hitsRes.count ?? 0
      const byGroup = { 1: 0, 2: 0, 3: 0 }
      verses.forEach((v) => { byGroup[v.age_group_id] = (byGroup[v.age_group_id] || 0) + 1 })

      let topVerseData = null
      if (topRes.data?.verse_id) {
        const { data } = await supabase
          .from('memory_verses')
          .select('verse_reference, verse_date')
          .eq('id', topRes.data.verse_id)
          .single()
        topVerseData = data ? { ...data, hits: topRes.data.hits_this_month } : null
      }

      setStats({ totalVerses, totalHits, byGroup })
      setRecent(recentRes.data || [])
      setTopVerse(topVerseData)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-4xl animate-bounce">🌿</div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-dark)' }}>Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <Link
          to="/admin/verses/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--green-mid)' }}
        >
          <PlusCircle size={16} />
          Add Verse
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Verses"
          value={stats.totalVerses}
          icon="📖"
          color="var(--green-mid)"
        />
        <StatCard
          label="Total Hits"
          value={stats.totalHits.toLocaleString()}
          icon="👁️"
          color="#7C3AED"
        />
        <StatCard
          label="Top Verse This Month"
          value={topVerse?.verse_reference ?? 'No data'}
          icon="⭐"
          color="var(--gold-accent)"
          sub={topVerse ? `${topVerse.hits} views` : undefined}
        />
        <StatCard
          label="Active Verses"
          value={stats.totalVerses}
          icon="✅"
          color="#059669"
        />
      </div>

      {/* Age group breakdown */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-800 mb-4">Verses by Age Group</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((gid) => {
            const group = AGE_GROUP_BY_ID[gid]
            const count = stats.byGroup[gid] || 0
            const pct = stats.totalVerses ? Math.round((count / stats.totalVerses) * 100) : 0
            return (
              <div key={gid}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium" style={{ color: group.color }}>{group.label}</span>
                  <span className="text-gray-500">{count} verse{count !== 1 ? 's' : ''}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: group.color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800">Recent Verses</h2>
          <Link to="/admin/verses" className="text-xs text-green-700 hover:underline">
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">No verses yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map((v) => {
              const group = AGE_GROUP_BY_ID[v.age_group_id]
              return (
                <div key={v.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{v.verse_reference}</p>
                      <p className="text-xs text-gray-400">
                        {format(parseISO(v.verse_date), 'MMM d, yyyy')} · {group.label}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/admin/verses/${v.id}/edit`}
                    className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-green-700 hover:bg-green-50 transition-colors"
                  >
                    <Edit2 size={14} />
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
