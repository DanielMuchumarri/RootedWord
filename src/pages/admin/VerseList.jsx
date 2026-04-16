import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AGE_GROUPS, AGE_GROUP_BY_ID, MONTHS } from '../../lib/constants'
import { format, parseISO } from 'date-fns'
import { PlusCircle, Edit2, Trash2, Search, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

const PAGE_SIZE = 20

export default function VerseList() {
  const [verses, setVerses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  useEffect(() => {
    fetchVerses()
  }, [search, filterGroup, filterYear, filterMonth, page])

  async function fetchVerses() {
    setLoading(true)
    let query = supabase
      .from('memory_verses')
      .select('id, verse_date, verse_reference, age_group_id, bible_translation, is_active, created_at', { count: 'exact' })
      .order('verse_date', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (search) query = query.ilike('verse_reference', `%${search}%`)
    if (filterGroup) query = query.eq('age_group_id', filterGroup)
    if (filterYear) {
      query = query
        .gte('verse_date', `${filterYear}-01-01`)
        .lte('verse_date', `${filterYear}-12-31`)
    }
    if (filterMonth && filterYear) {
      const m = String(filterMonth).padStart(2, '0')
      query = query
        .gte('verse_date', `${filterYear}-${m}-01`)
        .lte('verse_date', `${filterYear}-${m}-31`)
    }

    const { data, count } = await query
    setVerses(data || [])
    setTotal(count ?? 0)
    setLoading(false)
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('memory_verses').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete verse')
    } else {
      toast.success('Verse deleted')
      setDeleteTarget(null)
      fetchVerses()
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-dark)' }}>Verses</h1>
          <p className="text-sm text-gray-500">{total} total verses</p>
        </div>
        <Link
          to="/admin/verses/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ backgroundColor: 'var(--green-mid)' }}
        >
          <PlusCircle size={16} /> Add Verse
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search reference…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1"
          />
        </div>
        <select
          value={filterGroup}
          onChange={(e) => { setFilterGroup(e.target.value); setPage(0) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All Groups</option>
          {AGE_GROUPS.map((g) => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>
        <select
          value={filterYear}
          onChange={(e) => { setFilterYear(e.target.value); setPage(0) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All Years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={filterMonth}
          onChange={(e) => { setFilterMonth(e.target.value); setPage(0) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
          disabled={!filterYear}
        >
          <option value="">All Months</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-4xl animate-bounce">🌿</div>
          </div>
        ) : verses.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📖</div>
            <p className="text-gray-500">No verses found.</p>
            <Link to="/admin/verses/new" className="text-green-700 text-sm underline mt-2 inline-block">
              Add the first verse
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Group</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Translation</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {verses.map((v, i) => {
                  const group = AGE_GROUP_BY_ID[v.age_group_id]
                  return (
                    <tr key={v.id} className={`hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {format(parseISO(v.verse_date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{v.verse_reference}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span
                          className="inline-block text-xs px-2 py-0.5 rounded-full text-white font-medium"
                          style={{ backgroundColor: group?.color }}
                        >
                          {group?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{v.bible_translation}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          v.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {v.is_active ? 'Active' : 'Hidden'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/verse/${v.id}`}
                            target="_blank"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View public"
                          >
                            <Eye size={15} />
                          </Link>
                          <Link
                            to={`/admin/verses/${v.id}/edit`}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-green-700 hover:bg-green-50 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={15} />
                          </Link>
                          <button
                            onClick={() => setDeleteTarget(v)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between text-sm">
            <p className="text-gray-500">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Prev
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-3xl mb-3">⚠️</div>
            <h3 className="font-bold text-gray-800 mb-2">Delete Verse?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Are you sure you want to delete{' '}
              <strong>{deleteTarget.verse_reference}</strong> (
              {format(parseISO(deleteTarget.verse_date), 'MMM d, yyyy')})?
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget.id)}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
