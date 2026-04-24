/**
 * verseUpload.js
 * Utilities for mass-uploading memory verses via Excel template.
 * Reflection is per-language (English or Telugu), NOT per-translation (ESV / NIV).
 */
import ExcelJS from 'exceljs'
import { supabase } from './supabase'
import { AGE_GROUPS } from './constants'
import { normalizeRef, isValidRef } from './verseReference'

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Active bible translations — IDs verified against the live DB:
 *   SELECT id, code FROM bible_translations ORDER BY id;
 *   → 1=ESV, 2=NIV, 3=TEL
 */
export const TRANSLATION_COLUMNS = [
  { id: 1, code: 'ESV', langCode: 'en', label: 'ESV — English Standard Version', required: true  },
  { id: 2, code: 'NIV', langCode: 'en', label: 'NIV — New International Version', required: false },
  { id: 3, code: 'TEL', langCode: 'te', label: 'Telugu Bible',                    required: false },
]

/**
 * Languages with reflection columns — IDs verified against the live DB:
 *   SELECT id, code FROM languages ORDER BY id;
 *   → 1=en (English), 2=te (Telugu)
 */
const REFLECTION_LANGUAGES = [
  { code: 'en', id: 1, label: 'English Reflection',  note: 'Shared for ESV & NIV' },
  { code: 'te', id: 2, label: 'Telugu Reflection',   note: 'Optional' },
]

const AGE_GROUP_LABELS   = AGE_GROUPS.map((g) => `${g.label} (${g.ageRange})`)
const AGE_GROUP_BY_LABEL = Object.fromEntries(
  AGE_GROUPS.map((g) => [`${g.label} (${g.ageRange})`.toLowerCase(), g.id])
)

const STORAGE_BUCKET = 'admin-assets'
const TEMPLATE_PATH  = 'templates/verse-upload-template.xlsx'

// ── Styling helpers ───────────────────────────────────────────────────────────

const C = {
  headerBg:    '1B4332',
  headerFont:  'FFFFFF',
  reqHeaderBg: '2D6A4F',
  sampleBg:    'D8F3DC',
  sampleFont:  '1B4332',
  borderColor: 'B7E4C7',
  accentGold:  'D4A017',
}

function applyHeaderStyle(cell, bgArgb) {
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bgArgb || C.headerBg}` } }
  cell.font      = { bold: true, color: { argb: `FF${C.headerFont}` }, size: 10 }
  cell.border    = {
    bottom: { style: 'medium', color: { argb: `FF${C.accentGold}` } },
    right:  { style: 'thin',   color: { argb: `FF${C.borderColor}` } },
  }
  cell.alignment = { vertical: 'middle', wrapText: true }
}

function applySampleStyle(cell) {
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.sampleBg}` } }
  cell.font      = { italic: true, color: { argb: `FF${C.sampleFont}` }, size: 10 }
  cell.alignment = { wrapText: true, vertical: 'top' }
}

// ── Column definitions ────────────────────────────────────────────────────────
//
// Layout (matches parsing order exactly — do NOT reorder):
//   A  Verse Date               (required)
//   B  Verse Reference          (required, format validated)
//   C  Age Group                (required, dropdown)
//   D  Active                   (required, Yes/No)
//   E  ESV Verse Text           (required)
//   F  NIV Verse Text           (optional)
//   G  English Reflection       (optional — shared for all English translations)
//   H  English Live It Out      (optional)
//   I  Telugu Verse Text        (optional)
//   J  Telugu Reflection        (optional)
//   K  Telugu Live It Out       (optional)
//
const COLUMNS = [
  { key: 'verse_date',      header: 'Verse Date *',                                  width: 14, headerBg: C.reqHeaderBg },
  { key: 'verse_ref',       header: 'Verse Reference *',                              width: 22, headerBg: C.reqHeaderBg },
  { key: 'age_group',       header: 'Age Group *',                                    width: 26, headerBg: C.reqHeaderBg },
  { key: 'is_active',       header: 'Active *',                                       width: 10, headerBg: C.reqHeaderBg },
  { key: 'esv_verse',       header: 'ESV — Verse Text  [Required]',                  width: 45, headerBg: C.reqHeaderBg },
  { key: 'niv_verse',       header: 'NIV — Verse Text  [Optional]',                  width: 45, headerBg: C.headerBg   },
  { key: 'en_reflection',   header: 'English Reflection  [Optional · ESV + NIV]',   width: 45, headerBg: 'A0522D'     },
  { key: 'en_live_it_out',  header: 'English Live It Out  [Optional · ESV + NIV]',  width: 45, headerBg: 'A0522D'     },
  { key: 'tel_verse',       header: 'Telugu — Verse Text  [Optional]',               width: 45, headerBg: C.headerBg   },
  { key: 'tel_reflection',  header: 'Telugu Reflection  [Optional]',                  width: 45, headerBg: '5C3D11'    },
  { key: 'tel_live_it_out', header: 'Telugu Live It Out  [Optional]',                 width: 45, headerBg: '5C3D11'    },
]

// ── Template generation ───────────────────────────────────────────────────────

export async function generateTemplate() {
  const wb     = new ExcelJS.Workbook()
  wb.creator   = "Rooted God's Word"
  wb.created   = new Date()

  // ── Sheet 1: Verse Upload ─────────────────────────────────────────────────
  const ws = wb.addWorksheet('Verse Upload', {
    views:     [{ state: 'frozen', ySplit: 2 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  })

  ws.columns = COLUMNS.map((c) => ({ key: c.key, header: c.header, width: c.width }))

  // Row 1 — headers
  const headerRow = ws.getRow(1)
  headerRow.height = 32
  COLUMNS.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = col.header
    applyHeaderStyle(cell, col.headerBg)
  })

  // Row 2 — sample data (admin deletes before uploading)
  const sampleRow = ws.addRow({
    verse_date:      new Date(2025, 0, 1),
    verse_ref:       'John 3:16',
    age_group:       AGE_GROUP_LABELS[0],
    is_active:       'Yes',
    esv_verse:       'For God so loved the world that he gave his one and only Son…',
    niv_verse:       'For God so loved the world that he gave his one and only Son…',
    en_reflection:   'Reflect on the depth of God\'s love for you today.',
    en_live_it_out:  '1. Memorize this verse today.\n2. Share it with a friend.\n3. Journal how God\'s love has impacted your life.',
    tel_verse:       '',
    tel_reflection:  '',
    tel_live_it_out: '',
  })
  sampleRow.height = 48
  sampleRow.eachCell((cell) => applySampleStyle(cell))
  sampleRow.getCell(1).numFmt = 'yyyy-mm-dd'

  // Data validations
  ws.dataValidations.add('C3:C1001', {
    type: 'list', allowBlank: false,
    formulae: [`"${AGE_GROUP_LABELS.join(',')}"`],
    showErrorMessage: true, errorStyle: 'error',
    errorTitle: 'Invalid Age Group',
    error: `Select one of: ${AGE_GROUP_LABELS.join(', ')}`,
    showInputMessage: true, promptTitle: 'Age Group',
    prompt: 'Select the age group this verse is for',
  })
  ws.dataValidations.add('D3:D1001', {
    type: 'list', allowBlank: false,
    formulae: ['"Yes,No"'],
    showErrorMessage: true, errorStyle: 'error',
    errorTitle: 'Invalid Value', error: 'Please select Yes or No',
  })
  ws.dataValidations.add('A3:A1001', {
    type: 'date', operator: 'between',
    formulae: [new Date(2000, 0, 1), new Date(2099, 11, 31)],
    showErrorMessage: true, errorStyle: 'warning',
    showInputMessage: true, promptTitle: 'Verse Date',
    prompt: 'Enter date in YYYY-MM-DD format (e.g. 2025-01-01)',
  })
  for (let r = 3; r <= 1001; r++) ws.getCell(`A${r}`).numFmt = 'yyyy-mm-dd'

  // Add a note in col B header about accepted reference formats
  ws.getCell('B1').note = [
    'Accepted formats:',
    '  • John 3:16',
    '  • Matt 6:34',
    '  • Ps 23:1',
    '  • 1 John 4:8',
    '  • Gen 1:1-3  (verse range)',
    '',
    'References are automatically normalised on upload.',
    'Abbreviations (Matt, Jn, Ps, etc.) are resolved to full book names.',
  ].join('\n')

  // Alternating row shading + reflection column tints
  for (let r = 3; r <= 52; r++) {
    const row = ws.getRow(r)
    row.height = 18
    for (let c = 1; c <= COLUMNS.length; c++) {
      const cell     = row.getCell(c)
      const isReflCol = c === 7 || c === 8 || c === 10 || c === 11
      cell.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: isReflCol
          ? (r % 2 === 0 ? 'FFFFF3D4' : 'FFFFFCE8')
          : (r % 2 === 0 ? 'FFF8FBF9' : 'FFFFFFFF') },
      }
      cell.border    = {
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right:  { style: 'hair', color: { argb: 'FFE5E7EB' } },
      }
      cell.alignment = { wrapText: true, vertical: 'top' }
    }
  }

  // ── Sheet 2: Instructions ─────────────────────────────────────────────────
  const instrWs = wb.addWorksheet('Instructions')
  instrWs.columns = [{ width: 82 }, { width: 36 }]

  const instrData = [
    ["Rooted God's Word — Verse Upload Template Guide", ''],
    ['', ''],
    ['HOW TO USE', ''],
    ['1. Go to the "Verse Upload" sheet.', ''],
    ['2. Delete the sample row (Row 2) before uploading.', ''],
    ['3. Fill in one verse per row starting from Row 3.', ''],
    ['4. Save as .xlsx and upload via Admin → Verses → Mass Upload.', ''],
    ['', ''],
    ['COLUMN GUIDE', ''],
    ['Verse Date *',                          'Required. Format: YYYY-MM-DD (e.g. 2025-01-15)'],
    ['Verse Reference *',                     'Required. e.g. "John 3:16" or "Matt 6:34". Abbreviations are accepted and auto-normalised.'],
    ['Age Group *',                           'Required. Select from dropdown on the sheet'],
    ['Active *',                              'Required. "Yes" = published, "No" = hidden'],
    ['ESV — Verse Text',                      'Required. The English Standard Version text'],
    ['NIV — Verse Text',                      'Optional. New International Version text'],
    ['English Reflection',                    'Optional. ONE reflection for all English translations (ESV + NIV)'],
    ['English Live It Out',                   'Optional. Practical steps — shared for all English translations'],
    ['Telugu — Verse Text',                   'Optional. Telugu Bible translation text'],
    ['Telugu Reflection',                     'Optional. Reflection written in Telugu'],
    ['Telugu Live It Out',                    'Optional. Practical steps written in Telugu'],
    ['', ''],
    ['VERSE REFERENCE FORMAT', ''],
    ['References must include book, chapter, and verse: "John 3:16"', ''],
    ['Abbreviations are accepted: Matt, Ps, Gen, Jn, Rev, etc.', ''],
    ['Verse ranges are accepted: "Romans 8:28-30"', ''],
    ['References are automatically normalised to full canonical form on upload.', ''],
    ['', ''],
    ['WHY ONE REFLECTION PER LANGUAGE?', ''],
    ['The reflection is a devotional note for the language, not the translation.', ''],
    ['ESV and NIV readers share the same English reflection.', ''],
    ['Telugu readers have their own Telugu reflection.', ''],
    ['', ''],
    ['AGE GROUPS', ''],
    ...AGE_GROUPS.map((g) => [`${g.label} (${g.ageRange})`, g.description]),
    ['', ''],
    ['NOTES', ''],
    ['• Fields marked * are required — rows with missing required fields are skipped.', ''],
    ['• At least ESV Verse Text must be filled for each row.', ''],
    ['• Do not rename, remove, or reorder columns.', ''],
    ['• Duplicate verse_date + age_group combinations within the file are reported as errors.', ''],
    ['• Re-uploading a file updates existing verses rather than creating duplicates.', ''],
  ]

  instrData.forEach(([col1, col2]) => {
    const row = instrWs.addRow([col1, col2])
    const sections = ['HOW TO USE', 'COLUMN GUIDE', 'VERSE REFERENCE FORMAT', 'WHY ONE REFLECTION PER LANGUAGE?', 'AGE GROUPS', 'NOTES']
    if (col1 === instrData[0][0]) {
      row.getCell(1).font = { bold: true, size: 14, color: { argb: `FF${C.headerBg}` } }
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD8F3DC' } }
    } else if (sections.includes(col1)) {
      row.getCell(1).font = { bold: true, size: 11, color: { argb: `FF${C.headerBg}` } }
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF7EE' } }
      row.height = 20
    } else if (col2) {
      row.getCell(1).font = { bold: true, size: 10 }
      row.getCell(2).font = { size: 10, color: { argb: 'FF374151' } }
    } else {
      row.getCell(1).font = { size: 10, color: { argb: 'FF374151' } }
    }
  })

  // ── Generate buffer and save ──────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  // Upload to Supabase Storage (upsert so re-generates when schema changes)
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(TEMPLATE_PATH, blob, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
        cacheControl: '3600',
      })
    if (error) console.warn('Template storage upload failed:', error.message)
  } catch (err) {
    console.warn('Template storage upload skipped:', err.message)
  }

  // Trigger browser download
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = 'RootedGodsWord_Verse_Upload_Template.xlsx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Parsing ───────────────────────────────────────────────────────────────────

/**
 * Parse an uploaded .xlsx file into validated, normalised row objects.
 *
 * Validation rules:
 *   - verse_date required, YYYY-MM-DD
 *   - verse_reference required, must be a parseable Bible reference
 *   - age_group required, must match a known label
 *   - is_active required, Yes/No
 *   - ESV verse text required
 *
 * Intra-file duplicates on (verse_date, age_group_id) are detected and
 * reported as errors so they never reach the database.
 *
 * @param {File} file
 * @returns {{ rows: ParsedRow[], errors: ParseError[] }}
 */
export async function parseVerseFile(file) {
  const buffer = await file.arrayBuffer()
  const wb     = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const ws = wb.getWorksheet('Verse Upload')
  if (!ws) throw new Error(
    'Sheet "Verse Upload" not found. Please download the official template and fill it in.'
  )

  const rows   = []
  const errors = []

  ws.eachRow((row, rowNum) => {
    if (rowNum <= 2) return // skip header + sample row

    const get = (col) => {
      const v = row.getCell(col).value
      if (v === null || v === undefined) return ''
      if (v instanceof Date) return v
      if (typeof v === 'object' && v.text) return String(v.text).trim()
      return String(v).trim()
    }

    const rawDate        = get(1)  // A — Verse Date
    const rawVerseRef    = get(2)  // B — Verse Reference
    const ageGroupRaw    = get(3)  // C — Age Group
    const isActiveRaw    = get(4)  // D — Active
    const esvVerse       = get(5)  // E — ESV
    const nivVerse       = get(6)  // F — NIV
    const enReflection   = get(7)  // G — English reflection
    const enLiveItOut    = get(8)  // H — English live-it-out
    const telVerse       = get(9)  // I — Telugu
    const telReflection  = get(10) // J — Telugu reflection
    const telLiveItOut   = get(11) // K — Telugu live-it-out

    // Skip fully blank rows
    if (!rawDate && !rawVerseRef && !ageGroupRaw && !esvVerse) return

    const rowErrors = []

    // ── Date ───────────────────────────────────────────────────────────────
    let verseDate = null
    if (!rawDate) {
      rowErrors.push('verse_date is required')
    } else if (rawDate instanceof Date) {
      verseDate = rawDate.toISOString().split('T')[0]
    } else {
      const str = String(rawDate).trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        verseDate = str
      } else {
        rowErrors.push(`verse_date "${str}" must be YYYY-MM-DD format`)
      }
    }

    // ── Verse reference ────────────────────────────────────────────────────
    let verseReference = null
    if (!rawVerseRef) {
      rowErrors.push('verse_reference is required')
    } else {
      const normalized = normalizeRef(rawVerseRef)
      if (!normalized) {
        rowErrors.push(
          `verse_reference "${rawVerseRef}" is not a recognised Bible reference. ` +
          'Use: "John 3:16", "Matt 6:34", "Ps 23:1", etc.'
        )
      } else {
        verseReference = normalized // always store in canonical form
      }
    }

    // ── Age group ──────────────────────────────────────────────────────────
    const ageGroupId = AGE_GROUP_BY_LABEL[ageGroupRaw.toLowerCase()]
    if (!ageGroupId) {
      rowErrors.push(
        `age_group "${ageGroupRaw}" not recognised. Use: ${AGE_GROUP_LABELS.join(' | ')}`
      )
    }

    // ── Active ─────────────────────────────────────────────────────────────
    const isActiveStr = isActiveRaw.toLowerCase()
    let isActive = null
    if      (isActiveStr === 'yes') isActive = true
    else if (isActiveStr === 'no')  isActive = false
    else rowErrors.push(`active must be "Yes" or "No" (got "${isActiveRaw}")`)

    // ── ESV required ───────────────────────────────────────────────────────
    if (!esvVerse) rowErrors.push('ESV verse text is required')

    if (rowErrors.length > 0) {
      errors.push({ rowNum, ref: rawVerseRef || `Row ${rowNum}`, errors: rowErrors })
      return
    }

    rows.push({
      rowNum,
      verse_date:      verseDate,
      verse_reference: verseReference,  // normalised canonical form
      original_ref:    rawVerseRef,     // keep original for display purposes
      age_group_id:    ageGroupId,
      is_active:       isActive,
      // Values are plain strings keyed by bible_translation_id
      translations: {
        1: esvVerse  || '',
        2: nivVerse  || '',
        3: telVerse  || '',
      },
      // Per-language content keyed by language_id (1=English, 2=Telugu)
      langContent: {
        1: { reflection: enReflection  || '', live_it_out: enLiveItOut  || '' },
        2: { reflection: telReflection || '', live_it_out: telLiveItOut || '' },
      },
    })
  })

  // ── Phase 1: detect intra-file duplicates on (verse_date, age_group_id) ──
  // Two rows targeting the same date+group would collide in the DB unique
  // constraint; catch them here so the admin gets clear row-level feedback.
  const seenDateGroup = new Map() // "date|groupId" → first row number
  const phase1Rows = []

  for (const row of rows) {
    const key = `${row.verse_date}|${row.age_group_id}`
    if (seenDateGroup.has(key)) {
      errors.push({
        rowNum: row.rowNum,
        ref:    row.verse_reference,
        errors: [
          `Duplicate: same date (${row.verse_date}) and age group as row ${seenDateGroup.get(key)}`,
        ],
      })
    } else {
      seenDateGroup.set(key, row.rowNum)
      phase1Rows.push(row)
    }
  }

  // ── Phase 2: detect intra-file duplicates on (verse_reference, age_group_id, year) ──
  // Same verse reference for the same age group in the same year is a business-rule
  // duplicate, even when the dates differ. Block these before they reach the DB.
  const seenRefYearGroup = new Map() // "ref|groupId|year" → first row number
  const finalRows = []

  for (const row of phase1Rows) {
    const year = row.verse_date ? row.verse_date.substring(0, 4) : ''
    const key  = `${row.verse_reference}|${row.age_group_id}|${year}`
    if (seenRefYearGroup.has(key)) {
      const ag = AGE_GROUPS.find((g) => g.id === row.age_group_id)
      errors.push({
        rowNum: row.rowNum,
        ref:    row.verse_reference,
        errors: [
          `Duplicate: "${row.verse_reference}" already scheduled for ${ag?.label ?? `Group ${row.age_group_id}`} in ${year} (first seen on row ${seenRefYearGroup.get(key)})`,
        ],
      })
    } else {
      seenRefYearGroup.set(key, row.rowNum)
      finalRows.push(row)
    }
  }

  // Sort errors by row number for readable output
  errors.sort((a, b) => a.rowNum - b.rowNum)

  return { rows: finalRows, errors }
}

// ── DB Insertion ──────────────────────────────────────────────────────────────

/**
 * Upsert parsed verse rows into the three related tables:
 *   memory_verses  →  verse_translations  →  verse_language_reflections
 *
 * Uses upsert throughout so re-uploading the same file safely updates
 * existing records rather than failing on unique constraints.
 *
 * Conflict keys (verified against live DB constraints):
 *   memory_verses              → (verse_date, age_group_id)
 *   verse_translations         → (verse_id, bible_translation_id)
 *   verse_language_reflections → (verse_id, language_id)
 *
 * @param {ParsedRow[]} rows       - output of parseVerseFile()
 * @param {Function}    onProgress - called with 0–100 percent
 */
export async function insertVerseRows(rows, onProgress = () => {}) {
  const result = { inserted: 0, updated: 0, failed: 0, errors: [] }

  // ── Pre-fetch: check for existing ref+group+year duplicates in the DB ─────
  // The upsert conflict key is (verse_date, age_group_id). That means uploading
  // the same verse reference to a different date for the same group+year would
  // silently create a business-rule duplicate. We catch that here before upserting.
  const yearsInFile  = [...new Set(rows.map((r) => r.verse_date.substring(0, 4)))]
  const groupsInFile = [...new Set(rows.map((r) => r.age_group_id))]

  const existingVerses = []
  for (const year of yearsInFile) {
    const { data } = await supabase
      .from('memory_verses')
      .select('id, verse_date, age_group_id, verse_reference')
      .in('age_group_id', groupsInFile)
      .gte('verse_date', `${year}-01-01`)
      .lte('verse_date', `${year}-12-31`)
    if (data) existingVerses.push(...data)
  }

  // Build lookup: "normalizedRef|age_group_id|year" → { id, verse_date }
  const existingRefGroupYear = new Map()
  for (const v of existingVerses) {
    const nRef = normalizeRef(v.verse_reference) ?? v.verse_reference.trim()
    const year = v.verse_date.substring(0, 4)
    const key  = `${nRef}|${v.age_group_id}|${year}`
    if (!existingRefGroupYear.has(key)) {
      existingRefGroupYear.set(key, { id: v.id, verse_date: v.verse_date })
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    onProgress(Math.round(((i + 1) / rows.length) * 100))

    // ── Guard: block ref+group+year duplicates against existing DB data ────
    const nRef    = normalizeRef(row.verse_reference) ?? row.verse_reference.trim()
    const rowYear = row.verse_date.substring(0, 4)
    const refKey  = `${nRef}|${row.age_group_id}|${rowYear}`
    const clash   = existingRefGroupYear.get(refKey)

    if (clash && clash.verse_date !== row.verse_date) {
      // Same ref + same group + same year but on a different date → true duplicate
      const ag = AGE_GROUPS.find((g) => g.id === row.age_group_id)
      result.failed++
      result.errors.push(
        `Row ${row.rowNum} (${row.verse_reference}): ` +
        `"${nRef}" is already scheduled for ${ag?.label ?? `Group ${row.age_group_id}`} ` +
        `on ${clash.verse_date} in ${rowYear}. ` +
        `The same verse reference cannot appear twice for the same age group in the same year.`
      )
      continue
    }

    try {
      // ── 1. Upsert memory_verses ─────────────────────────────────────────
      // ON CONFLICT (verse_date, age_group_id) → update reference + active flag
      const now = new Date().toISOString()
      const { data: verse, error: verseErr } = await supabase
        .from('memory_verses')
        .upsert(
          {
            verse_date:      row.verse_date,
            age_group_id:    row.age_group_id,
            verse_reference: row.verse_reference,
            is_active:       row.is_active,
            updated_at:      now,
          },
          { onConflict: 'verse_date,age_group_id' }
        )
        .select('id')
        .single()

      if (verseErr) {
        result.failed++
        const msg = verseErr.code === '23505'
          ? `A verse already exists for ${row.verse_date} / ${row.age_group_id}`
          : verseErr.message
        result.errors.push(`Row ${row.rowNum} (${row.verse_reference}): ${msg}`)
        continue
      }

      const verseId = verse.id

      // ── 2. Upsert verse_translations ────────────────────────────────────
      // Only rows with non-empty text; skip empties rather than inserting blanks.
      // ON CONFLICT (verse_id, bible_translation_id) → update verse_text
      const translationRows = Object.entries(row.translations)
        .filter(([, text]) => text?.trim())
        .map(([tid, text]) => ({
          verse_id:             verseId,
          bible_translation_id: Number(tid),
          verse_text:           text.trim(),
          updated_at:           now,
        }))

      if (translationRows.length > 0) {
        const { error: transErr } = await supabase
          .from('verse_translations')
          .upsert(translationRows, { onConflict: 'verse_id,bible_translation_id' })

        if (transErr) {
          result.failed++
          result.errors.push(
            `Row ${row.rowNum} (${row.verse_reference}) translations: ${transErr.message}`
          )
          continue
        }
      }

      // ── 3. Upsert verse_language_reflections ────────────────────────────
      // One row per language that has reflection or live-it-out content.
      // ON CONFLICT (verse_id, language_id) → update reflection + live_it_out
      const reflectionRows = Object.entries(row.langContent)
        .filter(([, c]) => c.reflection?.trim() || c.live_it_out?.trim())
        .map(([langId, c]) => ({
          verse_id:    verseId,
          language_id: Number(langId),
          reflection:  c.reflection?.trim()  || null,
          live_it_out: c.live_it_out?.trim() || null,
          updated_at:  now,
        }))

      if (reflectionRows.length > 0) {
        const { error: reflErr } = await supabase
          .from('verse_language_reflections')
          .upsert(reflectionRows, { onConflict: 'verse_id,language_id' })

        if (reflErr) {
          // Non-fatal: reflections are optional; log but don't fail the verse
          console.warn(`Row ${row.rowNum} reflections: ${reflErr.message}`)
        }
      }

      result.inserted++
    } catch (err) {
      result.failed++
      result.errors.push(`Row ${row.rowNum} (${row.verse_reference}): ${err.message}`)
    }
  }

  return result
}

/** Public URL of the stored template (for sharing). */
export function getTemplatePublicUrl() {
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(TEMPLATE_PATH)
  return publicUrl
}
