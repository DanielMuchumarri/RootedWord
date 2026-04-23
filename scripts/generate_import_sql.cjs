/**
 * Generates SQL import files for all 365 DeepRoots verses.
 * Run: node scripts/generate_import_sql.js
 * Output: scripts/sql/
 */
const fs = require('fs');
const path = require('path');

const monthFiles = [
  'DeepRoots_January_2026.json',
  'DeepRoots_February_2026.json',
  'DeepRoots_March_2026.json',
  'DeepRoots_April_2026.json',
  'DeepRoots_May_2026.json',
  'DeepRoots_June_2026.json',
  'DeepRoots_July_2026.json',
  'DeepRoots_Aug_2026.json',
  'DeepRoots_Sept_2026.json',
  'DeepRoots_October_2026.json',
  'DeepRoots_November_2026.json',
  'DeepRoots_December_2026.json',
];

const deepRootsDir = path.join(__dirname, '..', 'DeepRoots');
const outDir = path.join(__dirname, 'sql');
fs.mkdirSync(outDir, { recursive: true });

// Escape single quotes for SQL string literals
function esc(s) {
  if (!s) return '';
  return s.replace(/'/g, "''");
}

// Load all data
const allData = [];
for (const file of monthFiles) {
  const filePath = path.join(deepRootsDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  allData.push(...data);
}

console.log(`Loaded ${allData.length} records`);

// ── File 01: TRUNCATE ──────────────────────────────────────────────────────
fs.writeFileSync(
  path.join(outDir, '01_truncate.sql'),
  `-- Clear all verse data (child tables first)
TRUNCATE verse_language_reflections, verse_translations, memory_verses CASCADE;
`
);

// ── File 02: memory_verses (all 365) ─────────────────────────────────────
const mvLines = allData.map(
  r => `  ('${r.verse_date}', '${esc(r.verse_reference)}', 3, true)`
);
fs.writeFileSync(
  path.join(outDir, '02_memory_verses.sql'),
  `INSERT INTO memory_verses (verse_date, verse_reference, age_group_id, is_active)\nVALUES\n${mvLines.join(',\n')};`
);

// ── Files 03-04: ESV verse_translations (split H1 / H2) ──────────────────
function buildTranslationSql(records, bibleTranslationId, versionKey) {
  const lines = records.map(
    r => `  ('${r.verse_date}'::date, ${r.age_group_id ? r.age_group_id : 3}, '${esc(r[versionKey])}')`
  );
  return `INSERT INTO verse_translations (verse_id, bible_translation_id, verse_text)
SELECT mv.id, ${bibleTranslationId}, t.verse_text
FROM (VALUES
${lines.join(',\n')}
) AS t(verse_date, age_group_id, verse_text)
JOIN memory_verses mv ON mv.verse_date = t.verse_date AND mv.age_group_id = t.age_group_id;`;
}

const h1 = allData.filter(r => r.verse_date <= '2026-06-30');
const h2 = allData.filter(r => r.verse_date >= '2026-07-01');

fs.writeFileSync(path.join(outDir, '03_esv_h1.sql'), buildTranslationSql(h1, 1, 'esv_version'));
fs.writeFileSync(path.join(outDir, '04_esv_h2.sql'), buildTranslationSql(h2, 1, 'esv_version'));
fs.writeFileSync(path.join(outDir, '05_niv_h1.sql'), buildTranslationSql(h1, 2, 'niv_version'));
fs.writeFileSync(path.join(outDir, '06_niv_h2.sql'), buildTranslationSql(h2, 2, 'niv_version'));

// ── Files 07-10: English verse_language_reflections (4 quarters) ─────────
function buildReflectionSql(records) {
  const lines = records.map(r => {
    const d = r.verse_date;
    const refl = esc(r.reflection);
    const lio = esc(r.live_it_out);
    return `  ('${d}'::date, 3, '${refl}', '${lio}')`;
  });
  return `INSERT INTO verse_language_reflections (verse_id, language_id, reflection, live_it_out)
SELECT mv.id, 1, t.reflection, t.live_it_out
FROM (VALUES
${lines.join(',\n')}
) AS t(verse_date, age_group_id, reflection, live_it_out)
JOIN memory_verses mv ON mv.verse_date = t.verse_date AND mv.age_group_id = t.age_group_id;`;
}

const q1 = allData.filter(r => r.verse_date <= '2026-03-31');
const q2 = allData.filter(r => r.verse_date >= '2026-04-01' && r.verse_date <= '2026-06-30');
const q3 = allData.filter(r => r.verse_date >= '2026-07-01' && r.verse_date <= '2026-09-30');
const q4 = allData.filter(r => r.verse_date >= '2026-10-01');

fs.writeFileSync(path.join(outDir, '07_reflections_q1.sql'), buildReflectionSql(q1));
fs.writeFileSync(path.join(outDir, '08_reflections_q2.sql'), buildReflectionSql(q2));
fs.writeFileSync(path.join(outDir, '09_reflections_q3.sql'), buildReflectionSql(q3));
fs.writeFileSync(path.join(outDir, '10_reflections_q4.sql'), buildReflectionSql(q4));

console.log('SQL files written to scripts/sql/');
console.log('Records per section:');
console.log(`  memory_verses: ${allData.length}`);
console.log(`  ESV H1: ${h1.length}, H2: ${h2.length}`);
console.log(`  Reflections Q1: ${q1.length}, Q2: ${q2.length}, Q3: ${q3.length}, Q4: ${q4.length}`);
