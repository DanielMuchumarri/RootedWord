/**
 * Bible verse reference utilities.
 * Handles parsing, normalization, and validation of verse references
 * in various forms: "Matthew 6:34", "Matt6:34", "Math 6:34", "1Jn 3:16", etc.
 */

export const BIBLE_BOOKS = [
  // Old Testament
  { name: 'Genesis',          abbrs: ['gen', 'ge', 'gn'] },
  { name: 'Exodus',           abbrs: ['exo', 'ex', 'exod'] },
  { name: 'Leviticus',        abbrs: ['lev', 'le', 'lv'] },
  { name: 'Numbers',          abbrs: ['num', 'nu', 'nm', 'nb'] },
  { name: 'Deuteronomy',      abbrs: ['deut', 'dt', 'de', 'deu'] },
  { name: 'Joshua',           abbrs: ['josh', 'jos', 'jsh'] },
  { name: 'Judges',           abbrs: ['judg', 'jdg', 'jg', 'jdgs'] },
  { name: 'Ruth',             abbrs: ['rth', 'ru'] },
  { name: '1 Samuel',         abbrs: ['1sam', '1sa', '1s'] },
  { name: '2 Samuel',         abbrs: ['2sam', '2sa', '2s'] },
  { name: '1 Kings',          abbrs: ['1kgs', '1ki', '1k', '1kings'] },
  { name: '2 Kings',          abbrs: ['2kgs', '2ki', '2k', '2kings'] },
  { name: '1 Chronicles',     abbrs: ['1chr', '1ch', '1chron', '1chronicles'] },
  { name: '2 Chronicles',     abbrs: ['2chr', '2ch', '2chron', '2chronicles'] },
  { name: 'Ezra',             abbrs: ['ezr'] },
  { name: 'Nehemiah',         abbrs: ['neh', 'ne'] },
  { name: 'Esther',           abbrs: ['est', 'esth', 'es'] },
  { name: 'Job',              abbrs: ['jb'] },
  { name: 'Psalms',           abbrs: ['ps', 'psa', 'psalm', 'pss', 'pslm'] },
  { name: 'Proverbs',         abbrs: ['prov', 'pro', 'prv', 'pr'] },
  { name: 'Ecclesiastes',     abbrs: ['eccl', 'ecc', 'ec', 'qoh'] },
  { name: 'Song of Solomon',  abbrs: ['song', 'so', 'sos', 'ss', 'cant', 'sng', 'songofsongs', 'songofsolomon'] },
  { name: 'Isaiah',           abbrs: ['isa', 'is'] },
  { name: 'Jeremiah',         abbrs: ['jer', 'je', 'jr'] },
  { name: 'Lamentations',     abbrs: ['lam', 'la'] },
  { name: 'Ezekiel',          abbrs: ['ezek', 'eze', 'ezk'] },
  { name: 'Daniel',           abbrs: ['dan', 'da', 'dn'] },
  { name: 'Hosea',            abbrs: ['hos', 'ho'] },
  { name: 'Joel',             abbrs: ['jl', 'joe'] },
  { name: 'Amos',             abbrs: ['am'] },
  { name: 'Obadiah',          abbrs: ['obad', 'ob', 'oba'] },
  { name: 'Jonah',            abbrs: ['jon', 'jnh'] },
  { name: 'Micah',            abbrs: ['mic', 'mc'] },
  { name: 'Nahum',            abbrs: ['nah', 'na'] },
  { name: 'Habakkuk',         abbrs: ['hab', 'hb'] },
  { name: 'Zephaniah',        abbrs: ['zeph', 'zep', 'zp'] },
  { name: 'Haggai',           abbrs: ['hag', 'hg'] },
  { name: 'Zechariah',        abbrs: ['zech', 'zec', 'zc'] },
  { name: 'Malachi',          abbrs: ['mal', 'ml'] },
  // New Testament
  { name: 'Matthew',          abbrs: ['matt', 'mat', 'mt'] },
  { name: 'Mark',             abbrs: ['mrk', 'mar', 'mk', 'mr'] },
  { name: 'Luke',             abbrs: ['luk', 'lk'] },
  { name: 'John',             abbrs: ['jhn', 'jn'] },
  { name: 'Acts',             abbrs: ['act', 'ac'] },
  { name: 'Romans',           abbrs: ['rom', 'ro', 'rm'] },
  { name: '1 Corinthians',    abbrs: ['1cor', '1co', '1corinthians'] },
  { name: '2 Corinthians',    abbrs: ['2cor', '2co', '2corinthians'] },
  { name: 'Galatians',        abbrs: ['gal', 'ga'] },
  { name: 'Ephesians',        abbrs: ['eph', 'ep'] },
  { name: 'Philippians',      abbrs: ['phil', 'php', 'pp'] },
  { name: 'Colossians',       abbrs: ['col'] },
  { name: '1 Thessalonians',  abbrs: ['1thess', '1thes', '1th'] },
  { name: '2 Thessalonians',  abbrs: ['2thess', '2thes', '2th'] },
  { name: '1 Timothy',        abbrs: ['1tim', '1ti'] },
  { name: '2 Timothy',        abbrs: ['2tim', '2ti'] },
  { name: 'Titus',            abbrs: ['tit', 'ti'] },
  { name: 'Philemon',         abbrs: ['philem', 'phlm', 'phm', 'pm'] },
  { name: 'Hebrews',          abbrs: ['heb'] },
  { name: 'James',            abbrs: ['jas', 'jm', 'ja'] },
  { name: '1 Peter',          abbrs: ['1pet', '1pe', '1pt'] },
  { name: '2 Peter',          abbrs: ['2pet', '2pe', '2pt'] },
  { name: '1 John',           abbrs: ['1jn', '1john', '1jo'] },
  { name: '2 John',           abbrs: ['2jn', '2john', '2jo'] },
  { name: '3 John',           abbrs: ['3jn', '3john', '3jo'] },
  { name: 'Jude',             abbrs: ['jud'] },
  { name: 'Revelation',       abbrs: ['rev', 're', 'rv', 'apoc'] },
]

// Build lookup: normalized-key → canonical book name
// Key = lowercase, all spaces and dots removed
const BOOK_LOOKUP = new Map()
;(function buildLookup() {
  const key = (s) => s.toLowerCase().replace(/[\s.]/g, '')
  for (const book of BIBLE_BOOKS) {
    BOOK_LOOKUP.set(key(book.name), book.name)
    for (const abbr of book.abbrs) {
      BOOK_LOOKUP.set(key(abbr), book.name)
    }
  }
})()

/**
 * Resolve a raw book name string to its canonical form.
 * Handles abbreviations, no-space forms, common typos via prefix matching.
 * @param {string} raw
 * @returns {string|null}
 */
export function resolveBookName(raw) {
  if (!raw) return null
  const key = raw.toLowerCase().replace(/[\s.]/g, '')

  // 1. Direct lookup (exact names + known abbreviations)
  if (BOOK_LOOKUP.has(key)) return BOOK_LOOKUP.get(key)

  // 2. Prefix match (min 3 chars) — catches partial typing and common typos
  if (key.length >= 3) {
    for (const book of BIBLE_BOOKS) {
      const bookKey = book.name.toLowerCase().replace(/[\s.]/g, '')
      if (bookKey.startsWith(key)) return book.name
    }
  }

  return null
}

/**
 * Parse a verse reference string into structured components.
 * Handles:
 *   "John 3:16"  →  book=John, chapter=3, verseStart=16
 *   "John3:16"   →  same (no space between book and chapter)
 *   "Jn 3:16"    →  same (abbreviation)
 *   "Matt 6:34"  →  book=Matthew ...
 *   "1 John 3:16-17" → verseEnd=17
 *   "Ps 23.1"    →  dot separator
 *
 * @param {string} input
 * @returns {{ book: string, chapter: number, verseStart: number, verseEnd: number|null }|null}
 */
export function parseVerseRef(input) {
  if (!input || typeof input !== 'string') return null

  // Normalize internal whitespace
  const s = input.trim().replace(/\s+/g, ' ')

  // Find chapter:verse at the end.
  // Supports colons or dots as separator, and optional verse range with hyphen/en-dash.
  const cvRegex = /(\d+)\s*[:.]\s*(\d+)\s*(?:[-\u2013]\s*(\d+))?\s*$/
  const cvMatch = s.match(cvRegex)
  if (!cvMatch) return null

  const chapter    = parseInt(cvMatch[1], 10)
  const verseStart = parseInt(cvMatch[2], 10)
  const verseEnd   = cvMatch[3] ? parseInt(cvMatch[3], 10) : null

  if (chapter < 1 || verseStart < 1) return null
  if (verseEnd !== null && verseEnd < verseStart) return null

  // Book raw = everything before the chapter:verse portion
  const bookRaw = s.slice(0, cvMatch.index).trim()
  if (!bookRaw) return null

  const book = resolveBookName(bookRaw)
  if (!book) return null

  return { book, chapter, verseStart, verseEnd }
}

/**
 * Normalize a verse reference to canonical format.
 * Examples:
 *   "Matt 6:34"   → "Matthew 6:34"
 *   "Matthew6:34" → "Matthew 6:34"
 *   "Jn3:16-17"   → "John 3:16-17"
 *
 * @param {string} input
 * @returns {string|null}  canonical string, or null if unparseable
 */
export function normalizeRef(input) {
  const parsed = parseVerseRef(input)
  if (!parsed) return null
  const { book, chapter, verseStart, verseEnd } = parsed
  return verseEnd
    ? `${book} ${chapter}:${verseStart}-${verseEnd}`
    : `${book} ${chapter}:${verseStart}`
}

/**
 * Returns true if the input can be parsed as a valid verse reference.
 */
export function isValidRef(input) {
  return parseVerseRef(input) !== null
}

/**
 * Returns true if the input is already in normalized canonical form.
 */
export function isNormalizedRef(input) {
  if (!input) return false
  return normalizeRef(input) === input.trim()
}
