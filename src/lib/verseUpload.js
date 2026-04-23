/**
 * verseUpload.js
 * Utilities for mass-uploading memory verses via Excel template.
 * Reflection is per-language (English or Telugu), NOT per-translation (ESV / NIV).
 */
import ExcelJS from 'exceljs'
import { supabase } from './supabase'
import { AGE_GROUPS } from './constants'

// ── Constants ────────────────────────────────────────────────────────────────

/** All active bible translations — IDs must match the live DB */
export const TRANSLATION_COLUMNS = [
  { id: 1, code: 'ESV', langCode: 'en', label: 'ESV — English Standard Version', required: true  },
  { id: 2, code: 'NIV', langCode: 'en', label: 'NIV — New International Version', required: false },
  { id: 3, code: 'TEL', langCode: 'te', label: 'Telugu Bible',                    required: false },
]

/** Languages that have a reflection column in the template */
const REFLECTION_LANGUAGES = [
  { code: 'en', id: 1, label: 'English Reflection',  note: 'Shared for ESV & NIV (and any future English translation)' },
  { code: 'te', id: 2, label: 'Telugu Reflection',   note: 'Optional — leave blank if not available' },
]

const AGE_GROUP_LABELS   = AGE_GROUPS.map((g) => `${g.label} (${g.ageRange})`)
const AGE_GROUP_BY_LABEL = Object.fromEntries(
  AGE_GROUPS.map((g) => [`${g.label} (${g.ageRange})`.toLowerCase(), g.id])
)

const STORAGE_BUCKET  = 'admin-assets'
const TEMPLATE_PATH   = 'templates/verse-upload-template.xlsx'

// ── Styling helpers ───────────────────────────────────────────────────────────

const C = {
  headerBg:    '1B4332',
  headerFont:  'FFFFFF',
  reqHeaderBg: '2D6A4F',
  sampleBg:    'D8F3DC',
  sampleFont:  '1B4332',
  reflBg:      'FFF8E7',    // warm amber tint for reflection columns
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
// Layout:
//   A  Verse Date               (required)
//   B  Verse Reference          (required)
//   C  Age Group                (required, dropdown)
//   D  Active                   (required, dropdown Yes/No)
//   E  ESV Verse Text           (required)
//   F  NIV Verse Text           (optional)
//   G  English Reflection       (optional – shared for ALL English translations)
//   H  English Live It Out      (optional – practical steps, shared for English)
//   I  Telugu Verse Text        (optional)
//   J  Telugu Reflection        (optional)
//   K  Telugu Live It Out       (optional)
//
const COLUMNS = [
  { key: 'verse_date',      header: 'Verse Date *',                                   width: 14, headerBg: C.reqHeaderBg },
  { key: 'verse_ref',       header: 'Verse Reference *',                               width: 22, headerBg: C.reqHeaderBg },
  { key: 'age_group',       header: 'Age Group *',                                     width: 26, headerBg: C.reqHeaderBg },
  { key: 'is_active',       header: 'Active *',                                        width: 10, headerBg: C.reqHeaderBg },
  { key: 'esv_verse',       header: 'ESV — Verse Text  [Required]',                   width: 45, headerBg: C.reqHeaderBg },
  { key: 'niv_verse',       header: 'NIV — Verse Text  [Optional]',                   width: 45, headerBg: C.headerBg   },
  { key: 'en_reflection',   header: 'English Reflection  [Optional · ESV + NIV]',    width: 45, headerBg: 'A0522D'     },
  { key: 'en_live_it_out',  header: 'English Live It Out  [Optional · ESV + NIV]',   width: 45, headerBg: 'A0522D'     },
  { key: 'tel_verse',       header: 'Telugu — Verse Text  [Optional]',                width: 45, headerBg: C.headerBg   },
  { key: 'tel_reflection',  header: 'Telugu Reflection  [Optional]',                   width: 45, headerBg: '5C3D11'    },
  { key: 'tel_live_it_out', header: 'Telugu Live It Out  [Optional]',                  width: 45, headerBg: '5C3D11'    },
]

// ── Template generation ───────────────────────────────────────────────────────

export async function generateTemplate() {
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'RootedWord'
  wb.created  = new Date()

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

  // Row 2 — sample data
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

  // Data validation
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

  // Alternating row shading + reflection column tints
  for (let r = 3; r <= 52; r++) {
    const row = ws.getRow(r)
    row.height = 18
    for (let c = 1; c <= COLUMNS.length; c++) {
      const cell = row.getCell(c)
      // Reflection/Live-It-Out columns G(7), H(8), J(10), K(11) get a warm tint
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
    ['RootedWord — Verse Upload Template Guide', ''],
    ['', ''],
    ['HOW TO USE', ''],
    ['1. Go to the "Verse Upload" sheet.', ''],
    ['2. Delete the sample row (Row 2) before uploading.', ''],
    ['3. Fill in one verse per row starting from Row 3.', ''],
    ['4. Save as .xlsx and upload via Admin → Verses → Mass Upload.', ''],
    ['', ''],
    ['COLUMN GUIDE', ''],
    ['Verse Date *',                          'Required. Format: YYYY-MM-DD (e.g. 2025-01-15)'],
    ['Verse Reference *',                     'Required. e.g. "John 3:16" or "Psalm 23:1"'],
    ['Age Group *',                           'Required. Select from dropdown on the sheet'],
    ['Active *',                              'Required. "Yes" = published, "No" = hidden'],
    ['ESV — Verse Text',                      'Required. The English Standard Version text'],
    ['NIV — Verse Text',                      'Optional. New International Version text'],
    ['English Reflection',                    'Optional. ONE reflection for all English translations (ESV + NIV + any future English Bible)'],
    ['English Live It Out',                   'Optional. Practical steps to apply the verse — shared for all English translations'],
    ['Telugu — Verse Text',                   'Optional. Telugu Bible translation text'],
    ['Telugu Reflection',                     'Optional. Reflection written in Telugu'],
    ['Telugu Live It Out',                    'Optional. Practical steps written in Telugu'],
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
    ['• Duplicate verse_date + age_group combinations will be reported as errors.', ''],
  ]

  instrData.forEach(([col1, col2]) => {
    const row = instrWs.addRow([col1, col2])
    const section = ['HOW TO USE', 'COLUMN GUIDE', 'WHY ONE REFLECTION PER LANGUAGE?', 'AGE GROUPS', 'NOTES']
    if (col1 === instrData[0][0]) {
      row.getCell(1).font = { bold: true, size: 14, color: { argb: `FF${C.headerBg}` } }
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD8F3DC' } }
    } else if (section.includes(col1)) {
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

  // ── Generate buffer and upload to Storage ─────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  // Upload to Supabase Storage (upsert so re-generates when translations change)
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
  a.download = 'RootedWord_Verse_Upload_Template.xlsx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Parsing ───────────────────────────────────────────────────────────────────

/**
 * Parse an uploaded .xlsx file → validated row objects.
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
    if (rowNum <= 2) return // skip header + sample

    const get = (col) => {
      const v = row.getCell(col).value
      if (v === null || v === undefined) return ''
      if (v instanceof Date) return v
      if (typeof v === 'object' && v.text) return String(v.text).trim()
      return String(v).trim()
    }

    const rawDate       = get(1)
    const verseRef      = get(2)
    const ageGroupRaw   = get(3)
    const isActiveRaw   = get(4)
    const esvVerse      = get(5)   // E
    const nivVerse      = get(6)   // F
    const enReflection  = get(7)   // G — English reflection (ESV + NIV)
    const enLiveItOut   = get(8)   // H — English live it out
    const telVerse      = get(9)   // I
    const telReflection = get(10)  // J — Telugu reflection
    const telLiveItOut  = get(11)  // K — Telugu live it out

    // Skip fully blank rows
    if (!rawDate && !verseRef && !ageGroupRaw && !esvVerse) return

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

    // ── Reference ──────────────────────────────────────────────────────────
    if (!verseRef) rowErrors.push('verse_reference is required')

    // ── Age Group ──────────────────────────────────────────────────────────
    const ageGroupId = AGE_GROUP_BY_LABEL[ageGroupRaw.toLowerCase()]
    if (!ageGroupId) rowErrors.push(
      `age_group "${ageGroupRaw}" not recognised. Use: ${AGE_GROUP_LABELS.join(' | ')}`
    )

    // ── Active ─────────────────────────────────────────────────────────────
    const isActiveStr = isActiveRaw.toLowerCase()
    let isActive = null
    if      (isActiveStr === 'yes') isActive = true
    else if (isActiveStr === 'no')  isActive = false
    else rowErrors.push(`is_active must be "Yes" or "No" (got "${isActiveRaw}")`)

    // ── ESV Required ───────────────────────────────────────────────────────
    if (!esvVerse) rowErrors.push('ESV — Verse Text is required')

    if (rowErrors.length > 0) {
      errors.push({ rowNum, ref: verseRef || `Row ${rowNum}`, errors: rowErrors })
      return
    }

    rows.push({
      rowNum,
      verse_date:      verseDate,
      verse_reference: verseRef,
      age_group_id:    ageGroupId,
      is_active:       isActive,
      // Verse texts per bible_translation id
      translations: {
        1: esvVerse,
        2: nivVerse,
        3: telVerse,
      },
      // Per-language content (language_id: 1=English, 2=Telugu)
      langContent: {
        1: { reflection: enReflection,  live_it_out: enLiveItOut  },
        2: { reflection: telReflection, live_it_out: telLiveItOut },
      },
    })
  })

  return { rows, errors }
}

// ── DB Insertion ──────────────────────────────────────────────────────────────

/**
 * Insert parsed verse rows into memory_verses + verse_translations + verse_language_reflections.
 * @param {ParsedRow[]} rows
 * @param {(pct: number) => void} onProgress
 */
export async function insertVerseRows(rows, onProgress = () => {}) {
  const result = { inserted: 0, failed: 0, errors: [] }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    onProgress(Math.round(((i + 1) / rows.length) * 100))

    try {
      // 1. Insert memory_verses (metadata only — text lives in verse_translations)
      const { data: verse, error: verseErr } = await supabase
        .from('memory_verses')
        .insert({
          verse_date:      row.verse_date,
          verse_reference: row.verse_reference,
          age_group_id:    row.age_group_id,
          is_active:       row.is_active,
        })
        .select('id')
        .single()

      if (verseErr) {
        result.failed++
        result.errors.push(`Row ${row.rowNum} (${row.verse_reference}): ${verseErr.message}`)
        continue
      }

      // 2. Insert verse_translations (verse text only, no reflection here) ──
      const translationRows = Object.entries(row.translations)
        .filter(([, text]) => text?.trim())
        .map(([tid, text]) => ({
          verse_id:             verse.id,
          bible_translation_id: Number(tid),
          verse_text:           text.trim(),
        }))

      if (translationRows.length > 0) {
        const { error: transErr } = await supabase
          .from('verse_translations')
          .insert(translationRows)
        if (transErr) {
          result.failed++
          result.errors.push(
            `Row ${row.rowNum} (${row.verse_reference}) translations: ${transErr.message}`
          )
          continue
        }
      }

      // 3. Insert verse_language_reflections (one per language) ─────────────
      const reflectionRows = Object.entries(row.langContent)
        .filter(([, c]) => c.reflection?.trim() || c.live_it_out?.trim())
        .map(([langId, c]) => ({
          verse_id:    verse.id,
          language_id: Number(langId),
          reflection:  c.reflection?.trim()  || null,
          live_it_out: c.live_it_out?.trim() || null,
          updated_at:  new Date().toISOString(),
        }))

      if (reflectionRows.length > 0) {
        const { error: reflErr } = await supabase
          .from('verse_language_reflections')
          .insert(reflectionRows)
        if (reflErr) {
          // Non-fatal: log but don't fail the whole verse
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
