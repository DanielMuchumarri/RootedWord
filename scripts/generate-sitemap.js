/**
 * generate-sitemap.js
 * Fetches all active verse IDs from Supabase and writes public/sitemap.xml.
 * Run before every production build:  node scripts/generate-sitemap.js
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Config ─────────────────────────────────────────────────────────────────
const BASE_URL       = process.env.SITE_URL || 'https://rootedgodsword.com'
const SUPABASE_URL   = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY   = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '❌  Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n' +
    '   Run:  VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/generate-sitemap.js\n' +
    '   Or load your .env.local first with:  node -r dotenv/config scripts/generate-sitemap.js'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Fetch active verse IDs ──────────────────────────────────────────────────
const { data: verses, error } = await supabase
  .from('memory_verses')
  .select('id, verse_date, verse_reference')
  .eq('is_active', true)
  .order('verse_date', { ascending: false })

if (error) {
  console.error('❌  Supabase error:', error.message)
  process.exit(1)
}

// ── Build XML ───────────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0]

const urlEntries = [
  // Homepage
  `  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`,
  // Individual verse pages
  ...verses.map((v) => `  <url>
    <loc>${BASE_URL}/verse/${v.id}</loc>
    <lastmod>${v.verse_date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`),
].join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`

// ── Write to public/ ────────────────────────────────────────────────────────
const outPath = resolve(__dirname, '../public/sitemap.xml')
writeFileSync(outPath, xml, 'utf8')
console.log(`✅  Sitemap written: ${outPath}`)
console.log(`    ${verses.length + 1} URLs (1 homepage + ${verses.length} verse pages)`)
