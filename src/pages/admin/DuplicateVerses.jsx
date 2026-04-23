import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import ExcelJS from 'exceljs'
import { supabase } from '../../lib/supabase'
import { AGE_GROUPS, AGE_GROUP_BY_ID } from '../../lib/constants'
import { normalizeRef } from '../../lib/verseReference'
import { format, parseISO } from 'date-fns'
import {
  AlertTriangle, Edit2, Eye, ChevronDown, ChevronUp,
  RefreshCw, ExternalLink, Check, X, Tag,
  Download, FileSpreadsheet, BookOpen, Copy, ChevronRight,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Palette (matches app CSS variables) ──────────────────────────────────────
const GREEN_DEEP  = '1B4332'
const GREEN_MID   = '2D6A4F'
const GOLD        = 'D4A017'
const AMBER_LIGHT = 'FFF8E7'
const WHITE       = 'FFFFFF'
const GRAY_50     = 'F9FAFB'

// ── Excel helpers ─────────────────────────────────────────────────────────────
function styleHeader(cell, bgArgb = GREEN_DEEP) {
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bgArgb}` } }
  cell.font      = { bold: true, color: { argb: `FF${WHITE}` }, size: 10, name: 'Calibri' }
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false }
  cell.border    = { bottom: { style: 'medium', color: { argb: `FF${GOLD}` } } }
}

function styleInfoRow(cell) {
  cell.font      = { italic: true, size: 9, color: { argb: 'FF6B7280' } }
  cell.alignment = { vertical: 'middle' }
}

function applyRowFill(row, argb) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
  })
}

function triggerDownload(buffer, filename) {
  const blob = new Blob(
    [buffer],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  )
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DuplicateVerses() {
  const [allVerses, setAllVerses]           = useState([])
  const [loading, setLoading]               = useState(true)
  const [filterGroup, setFilterGroup]       = useState('')
  const [filterType, setFilterType]         = useState('all')
  const [expandedGroups, setExpandedGroups] = useState({})
  const [editingRef, setEditingRef]         = useState(null)
  const [savingId, setSavingId]             = useState(null)

  // Export panel state
  const [showExport, setShowExport]   = useState(false)
  const [exportGroup, setExportGroup] = useState('all') // 'all' | '1' | '2' | '3'
  const [downloading, setDownloading] = useState(null)  // null | 'all' | 'dupes'

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data, error } = await supabase
      .from('memory_verses')
      .select('id, verse_reference, age_group_id, verse_date, is_active')
      .order('verse_date')

    if (error) toast.error('Failed to load verses')
    else setAllVerses(data || [])
    setLoading(false)
  }

  // ── Group by normalised verse_reference ───────────────────────────────────
  const allGroups = useMemo(() => {
    const map = {}
    for (const v of allVerses) {
      const key = normalizeRef(v.verse_reference) ?? v.verse_reference.toLowerCase().trim()
      if (!map[key]) {
        map[key] = { canonical: normalizeRef(v.verse_reference) ?? v.verse_reference, verses: [], variants: new Set() }
      }
      map[key].verses.push(v)
      map[key].variants.add(v.verse_reference)
    }

    return Object.entries(map)
      .filter(([, g]) => g.verses.length > 1)
      .map(([key, g]) => {
        const countByGroup = {}
        AGE_GROUPS.forEach((ag) => { countByGroup[ag.id] = g.verses.filter((v) => v.age_group_id === ag.id).length })
        const hasSameGroupDup = AGE_GROUPS.some((ag) => countByGroup[ag.id] > 1)
        return { key, canonical: g.canonical, verses: g.verses, variants: [...g.variants], countByGroup, hasSameGroupDup, hasVariants: g.variants.size > 1 }
      })
      .sort((a, b) => b.verses.length - a.verses.length)
  }, [allVerses])

  // ── Filtered groups (main list) ───────────────────────────────────────────
  const filteredGroups = useMemo(() => allGroups.filter((g) => {
    if (filterGroup && !g.verses.some((v) => v.age_group_id === parseInt(filterGroup))) return false
    if (filterType === 'same_group'  && !g.hasSameGroupDup) return false
    if (filterType === 'cross_group' &&  g.hasSameGroupDup) return false
    return true
  }), [allGroups, filterGroup, filterType])

  const totalAffected = filteredGroups.reduce((s, g) => s + g.verses.length, 0)

  // ── Export counts (driven by exportGroup selector) ────────────────────────
  const exportVerses = useMemo(() =>
    exportGroup === 'all' ? allVerses : allVerses.filter((v) => v.age_group_id === parseInt(exportGroup)),
  [allVerses, exportGroup])

  const exportDupVerses = useMemo(() => {
    const entries = allGroups.flatMap((g) => g.verses)
    return exportGroup === 'all' ? entries : entries.filter((v) => v.age_group_id === parseInt(exportGroup))
  }, [allGroups, exportGroup])

  // ── Helpers ───────────────────────────────────────────────────────────────
  function toggleGroup(key) {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function saveRef(verseId, rawValue) {
    const normalized = normalizeRef(rawValue.trim())
    if (!normalized) { toast.error('Invalid verse reference. Use format: "John 3:16"'); return }

    // Guard: check if the new reference would create a ref+group+year duplicate
    const verse = allVerses.find((v) => v.id === verseId)
    if (verse) {
      const year = verse.verse_date.substring(0, 4)
      const { data: existing } = await supabase
        .from('memory_verses')
        .select('id, verse_reference, verse_date, age_group_id')
        .eq('age_group_id', verse.age_group_id)
        .gte('verse_date', `${year}-01-01`)
        .lte('verse_date', `${year}-12-31`)
        .neq('id', verseId)

      const trueDups = (existing || []).filter(
        (v) => (normalizeRef(v.verse_reference) ?? v.verse_reference.trim()) === normalized
      )
      if (trueDups.length > 0) {
        const ag = AGE_GROUP_BY_ID[verse.age_group_id]
        toast.error(
          `"${normalized}" is already scheduled for ${ag?.label} on ${trueDups[0].verse_date} (${year}). ` +
          'The same verse reference cannot appear twice for the same age group in the same year.'
        )
        return
      }
    }

    setSavingId(verseId)
    const { error } = await supabase
      .from('memory_verses')
      .update({ verse_reference: normalized, updated_at: new Date().toISOString() })
      .eq('id', verseId)
    if (error) toast.error('Update failed: ' + error.message)
    else { toast.success(`Saved as "${normalized}"`); setEditingRef(null); await loadAll() }
    setSavingId(null)
  }

  // ── Download: All Verses ──────────────────────────────────────────────────
  async function downloadAll() {
    setDownloading('all')
    try {
      const groupLabel  = exportGroup === 'all' ? 'All-Groups' : (AGE_GROUP_BY_ID[parseInt(exportGroup)]?.label ?? exportGroup)
      const dateStamp   = format(new Date(), 'yyyy-MM-dd')
      const dupIds      = new Set(allGroups.flatMap((g) => g.verses.map((v) => v.id)))
      const sorted      = [...exportVerses].sort((a, b) => a.verse_date.localeCompare(b.verse_date))

      const wb  = new ExcelJS.Workbook()
      wb.creator = 'RootedWord Admin'
      wb.created = new Date()

      const ws = wb.addWorksheet('All Verses', { views: [{ state: 'frozen', ySplit: 3 }] })
      ws.columns = [
        { key: 'date',        width: 14 },
        { key: 'reference',   width: 30 },
        { key: 'age_group',   width: 20 },
        { key: 'active',      width: 10 },
        { key: 'is_dup',      width: 16 },
      ]

      // Row 1 — report title
      const titleRow = ws.addRow([`RootedWord — All Verse References · ${groupLabel} · ${dateStamp}`, '', '', '', ''])
      ws.mergeCells('A1:E1')
      titleRow.height = 26
      titleRow.getCell(1).font      = { bold: true, size: 12, color: { argb: `FF${GREEN_DEEP}` } }
      titleRow.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD8F3DC' } }
      titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }

      // Row 2 — info
      const infoRow = ws.addRow([`${sorted.length} verses · ${dupIds.size} in a duplicate group (highlighted)`, '', '', '', ''])
      ws.mergeCells('A2:E2')
      infoRow.height = 18
      styleInfoRow(infoRow.getCell(1))
      infoRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }

      // Row 3 — column headers
      const hRow = ws.addRow(['Date', 'Verse Reference', 'Age Group', 'Active', 'Duplicate?'])
      hRow.height = 26
      styleHeader(hRow.getCell(1))
      styleHeader(hRow.getCell(2))
      styleHeader(hRow.getCell(3))
      styleHeader(hRow.getCell(4))
      styleHeader(hRow.getCell(5), GREEN_MID)

      // Data rows
      sorted.forEach((verse, i) => {
        const ag    = AGE_GROUP_BY_ID[verse.age_group_id]
        const isDup = dupIds.has(verse.id)
        const row   = ws.addRow([
          verse.verse_date,
          verse.verse_reference,
          ag?.label ?? `Group ${verse.age_group_id}`,
          verse.is_active ? 'Yes' : 'No',
          isDup ? '⚠ Yes' : 'No',
        ])
        row.height = 18
        row.getCell(1).numFmt = 'yyyy-mm-dd'
        row.getCell(1).font   = { size: 10, color: { argb: 'FF374151' } }
        row.getCell(2).font   = { size: 10, bold: true,  color: { argb: `FF${GREEN_DEEP}` } }
        row.getCell(3).font   = { size: 10, color: { argb: 'FF374151' } }
        row.getCell(4).font   = { size: 10, color: { argb: verse.is_active ? 'FF166534' : 'FF9CA3AF' } }
        row.getCell(5).font   = { size: 10, color: { argb: isDup ? 'FFB45309' : 'FF9CA3AF' }, bold: isDup }

        if (isDup) {
          applyRowFill(row, `FF${AMBER_LIGHT}`)
        } else {
          applyRowFill(row, i % 2 === 0 ? `FFF8FBF9` : `FF${WHITE}`)
        }

        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border  = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } }
          cell.alignment = { vertical: 'middle' }
        })
      })

      // Auto-filter on header row
      ws.autoFilter = { from: 'A3', to: 'E3' }

      const buffer = await wb.xlsx.writeBuffer()
      triggerDownload(buffer, `RootedWord_All-Verses_${groupLabel}_${dateStamp}.xlsx`)
      toast.success(`Downloaded ${sorted.length} verses`)
    } catch (err) {
      toast.error('Download failed: ' + err.message)
      console.error(err)
    }
    setDownloading(null)
  }

  // ── Download: Duplicates Only ─────────────────────────────────────────────
  async function downloadDupes() {
    setDownloading('dupes')
    try {
      const groupLabel = exportGroup === 'all' ? 'All-Groups' : (AGE_GROUP_BY_ID[parseInt(exportGroup)]?.label ?? exportGroup)
      const dateStamp  = format(new Date(), 'yyyy-MM-dd')

      // Build list of groups that have entries in the selected age group
      const relevantGroups = exportGroup === 'all'
        ? allGroups
        : allGroups.filter((g) => g.verses.some((v) => v.age_group_id === parseInt(exportGroup)))

      const wb  = new ExcelJS.Workbook()
      wb.creator = 'RootedWord Admin'
      wb.created = new Date()

      const ws = wb.addWorksheet('Duplicate Verses', { views: [{ state: 'frozen', ySplit: 3 }] })
      ws.columns = [
        { key: 'ref',          width: 28 },
        { key: 'date',         width: 14 },
        { key: 'age_group',    width: 20 },
        { key: 'active',       width: 10 },
        { key: 'stored_ref',   width: 28 },
        { key: 'group_count',  width: 14 },
        { key: 'same_grp_dup', width: 18 },
      ]

      // Row 1 — title
      const totalEntries = exportDupVerses.length
      const titleRow = ws.addRow([`RootedWord — Duplicate Verse References · ${groupLabel} · ${dateStamp}`, '', '', '', '', '', ''])
      ws.mergeCells('A1:G1')
      titleRow.height = 26
      titleRow.getCell(1).font      = { bold: true, size: 12, color: { argb: `FF${GREEN_DEEP}` } }
      titleRow.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }
      titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }

      // Row 2 — info
      const infoRow = ws.addRow([`${relevantGroups.length} duplicate groups · ${totalEntries} total entries`, '', '', '', '', '', ''])
      ws.mergeCells('A2:G2')
      infoRow.height = 18
      styleInfoRow(infoRow.getCell(1))
      infoRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E7' } }

      // Row 3 — headers
      const hRow = ws.addRow(['Canonical Reference', 'Date', 'Age Group', 'Active', 'Stored As', 'Group Count', 'Same-Group Dup?'])
      hRow.height = 26
      ;['A3','B3','C3','D3','E3'].forEach((addr) => styleHeader(ws.getCell(addr)))
      styleHeader(ws.getCell('F3'), 'B45309')
      styleHeader(ws.getCell('G3'), '991B1B')

      // Band colours for visual grouping (alternating per duplicate group)
      const BAND_COLORS = [
        'FFFFF8ED', 'FFEFF6FF', 'FFFDF4FF', 'FFF0FDF4',
        'FFFFF1F2', 'FFFFFBEB', 'FFF0F9FF', 'FFFAF5FF',
      ]

      let rowIndex = 0
      relevantGroups.forEach((group, gi) => {
        const bandFill = `FF${BAND_COLORS[gi % BAND_COLORS.length].slice(2)}`
        const versesForGroup = exportGroup === 'all'
          ? group.verses
          : group.verses.filter((v) => v.age_group_id === parseInt(exportGroup))

        const sortedVerses = [...versesForGroup].sort((a, b) => a.verse_date.localeCompare(b.verse_date))

        sortedVerses.forEach((verse) => {
          const ag         = AGE_GROUP_BY_ID[verse.age_group_id]
          const isVariant  = verse.verse_reference !== group.canonical
          const row        = ws.addRow([
            group.canonical,
            verse.verse_date,
            ag?.label ?? `Group ${verse.age_group_id}`,
            verse.is_active ? 'Yes' : 'No',
            isVariant ? verse.verse_reference : '—',
            group.verses.length,
            group.hasSameGroupDup ? '⚠ Yes' : 'No',
          ])
          row.height = 18
          row.getCell(1).font  = { size: 10, bold: true, color: { argb: `FF${GREEN_DEEP}` } }
          row.getCell(2).numFmt = 'yyyy-mm-dd'
          row.getCell(2).font  = { size: 10, color: { argb: 'FF374151' } }
          row.getCell(3).font  = { size: 10, color: { argb: 'FF374151' } }
          row.getCell(4).font  = { size: 10, color: { argb: verse.is_active ? 'FF166534' : 'FF9CA3AF' } }
          row.getCell(5).font  = { size: 10, italic: true, color: { argb: isVariant ? 'FFB45309' : 'FFD1D5DB' } }
          row.getCell(6).font  = { size: 10, bold: true, color: { argb: 'FFB45309' } }
          row.getCell(6).alignment = { horizontal: 'center' }
          row.getCell(7).font  = { size: 10, bold: group.hasSameGroupDup, color: { argb: group.hasSameGroupDup ? 'FF991B1B' : 'FF9CA3AF' } }

          applyRowFill(row, bandFill)
          row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border    = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } }
            cell.alignment = { ...cell.alignment, vertical: 'middle' }
          })
          rowIndex++
        })

        // Thin separator between groups
        if (gi < relevantGroups.length - 1) {
          const sepRow = ws.addRow(['', '', '', '', '', '', ''])
          sepRow.height = 4
          applyRowFill(sepRow, 'FFE5E7EB')
          rowIndex++
        }
      })

      ws.autoFilter = { from: 'A3', to: 'G3' }

      const buffer = await wb.xlsx.writeBuffer()
      triggerDownload(buffer, `RootedWord_Duplicate-Verses_${groupLabel}_${dateStamp}.xlsx`)
      toast.success(`Downloaded ${totalEntries} duplicate entries across ${relevantGroups.length} groups`)
    } catch (err) {
      toast.error('Download failed: ' + err.message)
      console.error(err)
    }
    setDownloading(null)
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-4xl animate-bounce">🌿</div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-dark)' }}>
            Duplicate Verse References
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filteredGroups.length} duplicate group{filteredGroups.length !== 1 ? 's' : ''} · {totalAffected} affected entries
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200
                       text-sm font-medium text-gray-600 hover:bg-gray-50 bg-white shadow-sm transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>

          <button
            onClick={() => setShowExport((v) => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                        shadow-sm transition-all border ${
              showExport
                ? 'text-white border-transparent'
                : 'bg-white border-gray-200 text-gray-700 hover:border-green-300 hover:text-green-800'
            }`}
            style={showExport ? { backgroundColor: 'var(--green-mid)', borderColor: 'var(--green-mid)' } : {}}
          >
            <Download size={15} />
            Export
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${showExport ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* ── Export panel ─────────────────────────────────────────────────── */}
      {showExport && (
        <ExportPanel
          allVerses={allVerses}
          allGroups={allGroups}
          exportGroup={exportGroup}
          setExportGroup={setExportGroup}
          exportVerses={exportVerses}
          exportDupVerses={exportDupVerses}
          downloading={downloading}
          onDownloadAll={downloadAll}
          onDownloadDupes={downloadDupes}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* ── Status banner ────────────────────────────────────────────────── */}
      {allGroups.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">
                {allGroups.length} verse reference{allGroups.length !== 1 ? 's' : ''} appear in multiple database entries
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Expand a group to review entries. Use
                <span className="inline-flex items-center gap-0.5 mx-1 bg-amber-100 px-1.5 py-0.5 rounded text-amber-800">
                  <Tag size={10} /> quick-edit
                </span>
                to fix the reference only, or open the full editor for complete changes.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
          <Check size={18} className="text-green-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-800">All verse references are unique — no duplicates found.</p>
        </div>
      )}

      {/* ── Filters bar ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap gap-3 items-center">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filter:</span>
        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
        >
          <option value="">All Age Groups</option>
          {AGE_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
        >
          <option value="all">All duplicate types</option>
          <option value="same_group">Same age group only</option>
          <option value="cross_group">Cross age group only</option>
        </select>
        {(filterGroup || filterType !== 'all') && (
          <button
            onClick={() => { setFilterGroup(''); setFilterType('all') }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {filteredGroups.length} group{filteredGroups.length !== 1 ? 's' : ''} shown
        </span>
      </div>

      {/* ── Duplicate groups list ─────────────────────────────────────────── */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm text-center py-16">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-gray-500 font-medium">No duplicates match the current filters</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting the filters above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isExpanded    = expandedGroups[group.key]
            const visibleVerses = filterGroup
              ? group.verses.filter((v) => v.age_group_id === parseInt(filterGroup))
              : group.verses

            return (
              <div
                key={group.key}
                className="bg-white rounded-xl shadow-sm overflow-hidden border"
                style={{ borderColor: group.hasSameGroupDup ? 'rgba(239,68,68,0.35)' : 'rgba(251,146,60,0.35)' }}
              >
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50/70 transition-colors text-left"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: group.hasSameGroupDup ? '#EF4444' : '#F97316' }}
                  >
                    {group.verses.length}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-semibold text-gray-800 text-[15px]">{group.canonical}</span>
                      {group.hasVariants && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          {group.variants.length} spelling variants
                        </span>
                      )}
                      {group.hasSameGroupDup && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                          same-group duplicates
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {AGE_GROUPS.filter((ag) => group.countByGroup[ag.id] > 0).map((ag) => (
                        <span
                          key={ag.id}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: ag.color }}
                        >
                          {ag.label}
                          <span className="bg-white/25 rounded-full px-1 font-bold">{group.countByGroup[ag.id]}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <span className="text-gray-400 flex-shrink-0">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </span>
                </button>

                {/* Expanded entries */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {group.hasVariants && (
                      <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
                        <p className="text-xs font-semibold text-amber-700 mb-1.5">Spelling variants in database:</p>
                        <div className="flex flex-wrap gap-2">
                          {group.variants.map((v) => (
                            <span key={v} className="text-xs font-mono bg-white border border-amber-200 text-amber-800 px-2.5 py-1 rounded-lg">
                              {v}
                              {v === group.canonical && <span className="ml-1.5 text-green-600 font-semibold"> ✓ canonical</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="divide-y divide-gray-50">
                      {visibleVerses.map((verse) => {
                        const ageGroup  = AGE_GROUP_BY_ID[verse.age_group_id]
                        const isEditing = editingRef?.verseId === verse.id
                        const isSaving  = savingId === verse.id
                        const isVariant = verse.verse_reference !== group.canonical

                        return (
                          <div key={verse.id} className="px-5 py-3 flex items-center gap-3 flex-wrap hover:bg-gray-50/60 transition-colors">
                            <span className="text-sm text-gray-500 w-28 flex-shrink-0">
                              {format(parseISO(verse.verse_date), 'MMM d, yyyy')}
                            </span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full text-white font-medium flex-shrink-0"
                              style={{ backgroundColor: ageGroup?.color }}>
                              {ageGroup?.label}
                            </span>

                            {isEditing ? (
                              <div className="flex-1 flex items-center gap-2 min-w-0">
                                <input
                                  type="text" value={editingRef.value} autoFocus
                                  onChange={(e) => setEditingRef((p) => ({ ...p, value: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter')  saveRef(verse.id, editingRef.value)
                                    if (e.key === 'Escape') setEditingRef(null)
                                  }}
                                  className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 font-mono"
                                  placeholder="e.g. John 3:16"
                                />
                                <RefNormalizeHint raw={editingRef.value} />
                                <button onClick={() => saveRef(verse.id, editingRef.value)} disabled={isSaving}
                                  className="px-3 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-60"
                                  style={{ backgroundColor: 'var(--green-mid)' }}>
                                  {isSaving ? '…' : 'Save'}
                                </button>
                                <button onClick={() => setEditingRef(null)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 border border-gray-200">
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <span className="flex-1 min-w-0 text-sm font-mono text-gray-700 truncate">
                                {verse.verse_reference}
                                {isVariant && <span className="ml-2 text-xs text-amber-500 not-italic font-sans">(variant)</span>}
                              </span>
                            )}

                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                              verse.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {verse.is_active ? 'Active' : 'Hidden'}
                            </span>

                            {!isEditing && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => setEditingRef({ verseId: verse.id, value: verse.verse_reference })}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                  title="Quick-edit reference">
                                  <Tag size={14} />
                                </button>
                                <Link to={`/admin/verses/${verse.id}/edit`}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-green-700 hover:bg-green-50 transition-colors"
                                  title="Full edit">
                                  <Edit2 size={14} />
                                </Link>
                                <Link to={`/verse/${verse.id}`} target="_blank"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                  title="View public page">
                                  <ExternalLink size={14} />
                                </Link>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Export Panel ──────────────────────────────────────────────────────────────
function ExportPanel({
  allVerses, allGroups,
  exportGroup, setExportGroup,
  exportVerses, exportDupVerses,
  downloading, onDownloadAll, onDownloadDupes, onClose,
}) {
  const dupGroupCount = allGroups.filter((g) =>
    exportGroup === 'all' || g.verses.some((v) => v.age_group_id === parseInt(exportGroup))
  ).length

  return (
    <div
      className="rounded-2xl border shadow-lg overflow-hidden"
      style={{ borderColor: 'rgba(45,106,79,0.2)', backgroundColor: 'var(--green-deep)' }}
    >
      {/* Panel header */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <FileSpreadsheet size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Export Verse References</p>
            <p className="text-green-300 text-xs mt-0.5">Download to Excel (.xlsx) · choose scope and age group</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <X size={14} className="text-white" />
        </button>
      </div>

      {/* Age group selector */}
      <div className="px-6 pb-4">
        <p className="text-green-300 text-xs font-semibold uppercase tracking-wider mb-2.5">
          Age Group
        </p>
        <div className="flex flex-wrap gap-2">
          {/* "All" pill */}
          <button
            onClick={() => setExportGroup('all')}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all border ${
              exportGroup === 'all'
                ? 'bg-white text-green-900 border-white shadow-sm'
                : 'bg-white/10 text-green-200 border-white/20 hover:bg-white/20'
            }`}
          >
            All Groups
            <span className={`ml-1.5 text-xs font-bold ${exportGroup === 'all' ? 'text-green-600' : 'text-green-400'}`}>
              {allVerses.length}
            </span>
          </button>

          {AGE_GROUPS.map((ag) => {
            const count   = allVerses.filter((v) => v.age_group_id === ag.id).length
            const isActive = exportGroup === String(ag.id)
            return (
              <button
                key={ag.id}
                onClick={() => setExportGroup(String(ag.id))}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all border ${
                  isActive
                    ? 'bg-white border-white shadow-sm'
                    : 'bg-white/10 text-green-200 border-white/20 hover:bg-white/20'
                }`}
                style={isActive ? { color: ag.color } : {}}
              >
                {ag.label}
                <span className={`ml-1.5 text-xs font-bold ${isActive ? '' : 'text-green-400'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Download cards */}
      <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Card 1 — All Verses */}
        <DownloadCard
          icon={<BookOpen size={22} />}
          title="All Verse References"
          description="Every verse entry with its date, age group, and active status. Duplicate rows are highlighted in amber for quick review."
          count={exportVerses.length}
          countLabel="entries"
          accentColor="rgba(255,255,255,0.12)"
          buttonLabel="Download All Verses"
          buttonBg="rgba(255,255,255,0.15)"
          buttonHoverBg="rgba(255,255,255,0.25)"
          isLoading={downloading === 'all'}
          disabled={downloading !== null || exportVerses.length === 0}
          onClick={onDownloadAll}
          tags={['Date', 'Reference', 'Age Group', 'Active', 'Duplicate?']}
        />

        {/* Card 2 — Duplicates Only */}
        <DownloadCard
          icon={<Copy size={22} />}
          title="Duplicate References Only"
          description="Only entries whose verse reference appears more than once. Groups are banded by colour so you can see which entries cluster together."
          count={exportDupVerses.length}
          countLabel={`entries · ${dupGroupCount} groups`}
          accentColor="rgba(251,191,36,0.15)"
          buttonLabel="Download Duplicates"
          buttonBg="rgba(251,191,36,0.2)"
          buttonHoverBg="rgba(251,191,36,0.35)"
          isLoading={downloading === 'dupes'}
          disabled={downloading !== null || exportDupVerses.length === 0}
          onClick={onDownloadDupes}
          tags={['Canonical Ref', 'Date', 'Age Group', 'Stored As', 'Group Count']}
          accent
        />
      </div>
    </div>
  )
}

// ── Download Card ─────────────────────────────────────────────────────────────
function DownloadCard({
  icon, title, description, count, countLabel,
  accentColor, buttonLabel, buttonBg, buttonHoverBg,
  isLoading, disabled, onClick, tags, accent = false,
}) {
  const [hover, setHover] = useState(false)

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4 border"
      style={{ backgroundColor: accentColor, borderColor: 'rgba(255,255,255,0.1)' }}
    >
      {/* Icon + title */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-white">
          {icon}
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-snug">{title}</p>
          <p className="text-green-200 text-xs mt-1 leading-relaxed">{description}</p>
        </div>
      </div>

      {/* Column preview chips */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="text-xs bg-white/10 text-green-200 px-2 py-0.5 rounded-full">
            {tag}
          </span>
        ))}
      </div>

      {/* Count + download button */}
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-white/10">
        <div>
          <span className={`text-2xl font-bold ${accent ? 'text-amber-300' : 'text-white'}`}>{count}</span>
          <span className="text-xs text-green-300 ml-1.5">{countLabel}</span>
        </div>

        <button
          onClick={onClick}
          disabled={disabled}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                     text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: hover && !disabled ? buttonHoverBg : buttonBg }}
        >
          {isLoading
            ? <><Loader2 size={14} className="animate-spin" /> Downloading…</>
            : <><Download size={14} /> {buttonLabel}</>
          }
        </button>
      </div>
    </div>
  )
}

// ── Inline ref normalise hint ─────────────────────────────────────────────────
function RefNormalizeHint({ raw }) {
  if (!raw?.trim()) return null
  const normalized = normalizeRef(raw.trim())
  if (!normalized) return <span className="text-xs text-red-500 flex-shrink-0 whitespace-nowrap">Invalid format</span>
  if (normalized === raw.trim()) return <span className="text-xs text-green-600 flex-shrink-0 whitespace-nowrap">✓ valid</span>
  return <span className="text-xs text-amber-600 flex-shrink-0 whitespace-nowrap">→ {normalized}</span>
}
