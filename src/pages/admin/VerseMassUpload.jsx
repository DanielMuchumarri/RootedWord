import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Download, Upload, FileSpreadsheet,
  CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  Loader2, RefreshCw, FileUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { generateTemplate, parseVerseFile, insertVerseRows } from '../../lib/verseUpload'
import { AGE_GROUP_BY_ID } from '../../lib/constants'

// ── phase machine: idle → parsing → preview → uploading → done ─────────────
const PHASES = { IDLE: 'idle', PARSING: 'parsing', PREVIEW: 'preview', UPLOADING: 'uploading', DONE: 'done' }

export default function VerseMassUpload() {
  const navigate = useNavigate()

  const [phase, setPhase]                = useState(PHASES.IDLE)
  const [templateLoading, setTplLoading] = useState(false)
  const [dragOver, setDragOver]          = useState(false)
  const [fileName, setFileName]          = useState(null)

  const [validRows, setValidRows]        = useState([])
  const [parseErrors, setParseErrors]    = useState([])
  const [showErrors, setShowErrors]      = useState(true)

  const [progress, setProgress]          = useState(0)
  const [uploadResult, setUploadResult]  = useState(null)

  const fileRef = useRef(null)

  // ── Template download ─────────────────────────────────────────────────────
  async function handleDownloadTemplate() {
    setTplLoading(true)
    try {
      await generateTemplate()
      toast.success('Template downloaded!')
    } catch (err) {
      toast.error(`Template generation failed: ${err.message}`)
    } finally {
      setTplLoading(false)
    }
  }

  // ── File selection ────────────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    if (!file) return
    const name = file.name.toLowerCase()
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)')
      return
    }
    setFileName(file.name)
    setPhase(PHASES.PARSING)
    try {
      const { rows, errors } = await parseVerseFile(file)
      setValidRows(rows)
      setParseErrors(errors)
      setPhase(PHASES.PREVIEW)
      if (rows.length === 0 && errors.length === 0) {
        toast('No data rows found — did you forget to fill the template?', { icon: '⚠️' })
      }
    } catch (err) {
      toast.error(err.message)
      setPhase(PHASES.IDLE)
    }
  }, [])

  function onFileInput(e) {
    processFile(e.target.files?.[0])
    e.target.value = ''
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    processFile(e.dataTransfer.files?.[0])
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (validRows.length === 0) return
    setPhase(PHASES.UPLOADING)
    setProgress(0)
    try {
      const result = await insertVerseRows(validRows, (pct) => setProgress(pct))
      setUploadResult(result)
      setPhase(PHASES.DONE)
      if (result.inserted > 0) {
        toast.success(`${result.inserted} verse${result.inserted > 1 ? 's' : ''} uploaded successfully!`)
      }
    } catch (err) {
      toast.error(`Upload failed: ${err.message}`)
      setPhase(PHASES.PREVIEW)
    }
  }

  function reset() {
    setPhase(PHASES.IDLE)
    setFileName(null)
    setValidRows([])
    setParseErrors([])
    setProgress(0)
    setUploadResult(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6 pb-12">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/verses')}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-dark)' }}>
            Mass Upload Verses
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Upload many verses at once using the Excel template
          </p>
        </div>
      </div>

      {/* ── Step 1: Download Template ───────────────────────────────────── */}
      <SectionCard
        step="1"
        title="Download the Template"
        subtitle="Start by downloading the pre-formatted Excel template"
        accent="green"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Feature list */}
          <ul className="flex-1 space-y-2 text-sm text-gray-600">
            {[
              'Age Group & Active status dropdowns built in',
              'Date picker enabled for Verse Date column',
              'Columns for ESV (required), NIV & Telugu (optional)',
              'Verse references auto-normalised on upload (Matt → Matthew)',
              'Duplicate rows detected before they reach the database',
              'Re-uploading updates existing verses safely (no duplicates created)',
              'Instructions sheet with accepted reference formats included',
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-green-600" />
                {f}
              </li>
            ))}
          </ul>

          {/* Download button */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-sm"
              style={{ backgroundColor: 'rgba(27,67,50,0.07)' }}
            >
              <FileSpreadsheet size={36} style={{ color: 'var(--green-mid)' }} />
            </div>
            <button
              onClick={handleDownloadTemplate}
              disabled={templateLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold
                         disabled:opacity-60 transition-opacity hover:opacity-90 shadow-sm"
              style={{ backgroundColor: 'var(--green-mid)' }}
            >
              {templateLoading
                ? <Loader2 size={15} className="animate-spin" />
                : <Download size={15} />}
              {templateLoading ? 'Generating…' : 'Download Template'}
            </button>
            <p className="text-xs text-gray-400 text-center">Excel (.xlsx) · ~10 KB</p>
          </div>
        </div>
      </SectionCard>

      {/* ── Step 2: Upload File ─────────────────────────────────────────── */}
      {phase === PHASES.IDLE && (
        <SectionCard
          step="2"
          title="Upload Your File"
          subtitle="Fill in the template then drag & drop or browse to upload"
          accent="blue"
        >
          <DropZone
            dragOver={dragOver}
            setDragOver={setDragOver}
            onDrop={onDrop}
            onBrowse={() => fileRef.current?.click()}
          />
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={onFileInput}
          />
        </SectionCard>
      )}

      {/* ── Parsing spinner ─────────────────────────────────────────────── */}
      {phase === PHASES.PARSING && (
        <SectionCard step="2" title="Reading File…" subtitle={fileName} accent="blue">
          <div className="flex items-center justify-center py-12 gap-4 text-gray-500">
            <Loader2 size={28} className="animate-spin text-green-600" />
            <span className="text-sm font-medium">Parsing rows and validating fields…</span>
          </div>
        </SectionCard>
      )}

      {/* ── Step 3: Preview ─────────────────────────────────────────────── */}
      {(phase === PHASES.PREVIEW || phase === PHASES.UPLOADING) && (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatPill
              label="Ready to upload"
              value={validRows.length}
              color="green"
              icon={<CheckCircle2 size={18} />}
            />
            <StatPill
              label="Rows with errors"
              value={parseErrors.length}
              color={parseErrors.length > 0 ? 'red' : 'gray'}
              icon={<XCircle size={18} />}
            />
            <StatPill
              label="File"
              value={fileName}
              color="gray"
              icon={<FileUp size={18} />}
              small
            />
          </div>

          {/* Parse errors */}
          {parseErrors.length > 0 && (
            <div className="bg-red-50 rounded-2xl border border-red-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowErrors((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-red-700">
                  <AlertTriangle size={15} />
                  {parseErrors.length} row{parseErrors.length > 1 ? 's' : ''} skipped due to errors
                </span>
                {showErrors ? <ChevronUp size={15} className="text-red-400" /> : <ChevronDown size={15} className="text-red-400" />}
              </button>
              {showErrors && (
                <ul className="px-5 pb-4 space-y-2">
                  {parseErrors.map(({ rowNum, ref, errors }) => (
                    <li key={rowNum} className="text-xs text-red-700">
                      <span className="font-bold">Row {rowNum}</span>
                      {ref && ref !== `Row ${rowNum}` && (
                        <span className="text-red-500"> — {ref}</span>
                      )}
                      <span className="text-red-500">: {errors.join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Preview table */}
          {validRows.length > 0 && (
            <SectionCard
              step="3"
              title={`Preview — ${validRows.length} Valid Row${validRows.length > 1 ? 's' : ''}`}
              subtitle="Review before uploading. References have been normalised to canonical form."
              accent="green"
            >
              <div className="overflow-x-auto -mx-1 rounded-xl border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(27,67,50,0.06)' }}>
                      {['Row', 'Date', 'Reference', 'Age Group', 'Active', 'Translations', 'Content'].map((h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2.5 font-semibold uppercase tracking-wide text-gray-500"
                          style={{ fontSize: '0.68rem' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {validRows.map((row) => {
                      const group = AGE_GROUP_BY_ID[row.age_group_id]

                      // translations values are plain strings keyed by bible_translation_id
                      const transCodes = Object.entries(row.translations)
                        .filter(([, text]) => text?.trim())
                        .map(([tid]) => ({ 1: 'ESV', 2: 'NIV', 3: 'TEL' }[Number(tid)]))
                        .filter(Boolean)

                      // reflection / live-it-out presence badges
                      const hasEnContent = row.langContent[1]?.reflection?.trim() || row.langContent[1]?.live_it_out?.trim()
                      const hasTeContent = row.langContent[2]?.reflection?.trim() || row.langContent[2]?.live_it_out?.trim()

                      // Was the reference normalised? (original_ref differs from stored verse_reference)
                      const wasNormalised = row.original_ref && row.original_ref !== row.verse_reference

                      return (
                        <tr key={row.rowNum} className="hover:bg-gray-50/60">
                          {/* Row number from Excel */}
                          <td className="px-3 py-2 text-gray-400 tabular-nums">{row.rowNum}</td>

                          {/* Date */}
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap font-mono">{row.verse_date}</td>

                          {/* Reference — show original + normalised if they differ */}
                          <td className="px-3 py-2">
                            <span className="font-semibold text-gray-800">{row.verse_reference}</span>
                            {wasNormalised && (
                              <div className="text-amber-600 mt-0.5" style={{ fontSize: '0.62rem' }}>
                                was: {row.original_ref}
                              </div>
                            )}
                          </td>

                          {/* Age group */}
                          <td className="px-3 py-2">
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-white font-medium whitespace-nowrap"
                              style={{ backgroundColor: group?.color, fontSize: '0.65rem' }}
                            >
                              {group?.label}
                            </span>
                          </td>

                          {/* Active */}
                          <td className="px-3 py-2">
                            <span className={`font-medium ${row.is_active ? 'text-green-700' : 'text-gray-400'}`}>
                              {row.is_active ? 'Yes' : 'No'}
                            </span>
                          </td>

                          {/* Translation codes */}
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {transCodes.length === 0 ? (
                                <span className="text-gray-300">—</span>
                              ) : transCodes.map((code) => (
                                <span
                                  key={code}
                                  className="px-1.5 py-0.5 rounded font-bold"
                                  style={{
                                    backgroundColor: code === 'TEL'
                                      ? 'rgba(212,160,23,0.15)' : 'rgba(27,67,50,0.1)',
                                    color: code === 'TEL' ? '#92600A' : 'var(--green-deep)',
                                    fontSize: '0.65rem',
                                  }}
                                >
                                  {code}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Reflection content badges */}
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {hasEnContent && (
                                <span
                                  className="px-1.5 py-0.5 rounded font-bold"
                                  style={{ backgroundColor: 'rgba(160,82,45,0.12)', color: '#7C3D12', fontSize: '0.62rem' }}
                                  title="English reflection/live-it-out"
                                >
                                  EN refl
                                </span>
                              )}
                              {hasTeContent && (
                                <span
                                  className="px-1.5 py-0.5 rounded font-bold"
                                  style={{ backgroundColor: 'rgba(92,61,17,0.12)', color: '#5C3D11', fontSize: '0.62rem' }}
                                  title="Telugu reflection/live-it-out"
                                >
                                  TE refl
                                </span>
                              )}
                              {!hasEnContent && !hasTeContent && (
                                <span className="text-gray-300">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Upload actions */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 flex-wrap gap-3">
                <button
                  onClick={reset}
                  disabled={phase === PHASES.UPLOADING}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200
                             text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  <RefreshCw size={14} />
                  Choose Different File
                </button>

                {phase === PHASES.UPLOADING ? (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Loader2 size={16} className="animate-spin text-green-600" />
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">Uploading… {progress}%</span>
                      <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: 'var(--green-mid)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleUpload}
                    disabled={validRows.length === 0}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm
                               font-semibold disabled:opacity-50 transition-opacity hover:opacity-90 shadow-sm"
                    style={{ backgroundColor: 'var(--green-mid)' }}
                  >
                    <Upload size={15} />
                    Upload {validRows.length} Verse{validRows.length > 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* ── Done ────────────────────────────────────────────────────────── */}
      {phase === PHASES.DONE && uploadResult && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ backgroundColor: 'rgba(27,67,50,0.1)' }}
          >
            <CheckCircle2 size={32} style={{ color: 'var(--green-mid)' }} />
          </div>

          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-dark)' }}>
              Upload Complete
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {uploadResult.inserted} verse{uploadResult.inserted !== 1 ? 's' : ''} saved
              {uploadResult.failed > 0 && ` · ${uploadResult.failed} failed`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Existing verses with matching date + age group were updated in place.
            </p>
          </div>

          {uploadResult.errors.length > 0 && (
            <div className="text-left bg-red-50 rounded-xl p-4 border border-red-100">
              <p className="text-xs font-bold text-red-700 mb-2">
                Failed rows:
              </p>
              <ul className="space-y-1">
                {uploadResult.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-600">{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-center gap-3 flex-wrap">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border border-gray-200
                         text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Upload size={14} />
              Upload Another File
            </button>
            <button
              onClick={() => navigate('/admin/verses')}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm
                         font-semibold hover:opacity-90 transition-opacity shadow-sm"
              style={{ backgroundColor: 'var(--green-mid)' }}
            >
              View All Verses
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ step, title, subtitle, accent = 'green', children }) {
  const accentColor = accent === 'green' ? 'var(--green-mid)' : '#3B82F6'
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header stripe */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: accentColor }}
        >
          {step}
        </span>
        <div>
          <h2 className="text-sm font-bold text-gray-800">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function DropZone({ dragOver, setDragOver, onDrop, onBrowse }) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={onBrowse}
      className="cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col
                 items-center justify-center py-14 px-6 text-center gap-4"
      style={{
        borderColor:      dragOver ? 'var(--green-mid)' : '#D1D5DB',
        backgroundColor:  dragOver ? 'rgba(27,67,50,0.04)' : '#FAFAFA',
      }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: dragOver ? 'rgba(27,67,50,0.1)' : 'rgba(27,67,50,0.05)' }}
      >
        <FileSpreadsheet
          size={32}
          style={{ color: dragOver ? 'var(--green-mid)' : '#9CA3AF' }}
        />
      </div>
      <div>
        <p className="font-semibold text-gray-700 text-sm">
          {dragOver ? 'Drop to upload' : 'Drag & drop your Excel file here'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          or{' '}
          <span style={{ color: 'var(--green-mid)' }} className="font-semibold underline underline-offset-2">
            browse files
          </span>
          {' '}· .xlsx or .xls · max 10 MB
        </p>
      </div>
    </div>
  )
}

function StatPill({ label, value, color, icon, small = false }) {
  const colors = {
    green: { bg: 'rgba(27,67,50,0.07)', text: 'var(--green-deep)', val: 'var(--green-mid)' },
    red:   { bg: 'rgba(239,68,68,0.07)', text: '#B91C1C', val: '#DC2626' },
    gray:  { bg: '#F9FAFB', text: '#6B7280', val: '#374151' },
  }
  const c = colors[color] || colors.gray
  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center gap-3 border border-gray-100"
      style={{ backgroundColor: c.bg }}
    >
      <span style={{ color: c.val }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p
          className={`font-bold truncate ${small ? 'text-xs' : 'text-lg'}`}
          style={{ color: c.val }}
        >
          {value ?? 0}
        </p>
      </div>
    </div>
  )
}
