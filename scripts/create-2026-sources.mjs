/**
 * create-2026-sources.mjs
 * Genera los source files de 2026 desde el batch curado y actualiza index.json + catalog.json
 * Uso: node scripts/create-2026-sources.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = path.join(__dirname, '../public/data/tournaments/world-cup')
const BATCH     = path.join(__dirname, 'curated/batch-2022-2026.json')
const INDEX     = path.join(DATA_DIR, 'index.json')
const CATALOG   = path.join(DATA_DIR, 'catalog.json')

const POSITION_STATS = {
  POR: ['reflejos', 'manejo', 'salidas', 'penales', 'distribucion', 'comunicacion'],
  LD:  ['defAerea', 'intercepciones', 'duelos', 'centro', 'velocidad', 'comunicacion'],
  LI:  ['defAerea', 'intercepciones', 'duelos', 'centro', 'velocidad', 'comunicacion'],
  DFC: ['defAerea', 'intercepciones', 'duelos', 'cabezazo', 'posicionamiento', 'comunicacion'],
  MCD: ['recuperacion', 'duelos', 'posicionamiento', 'pases', 'llegada', 'tirosLejanos'],
  MC:  ['vision', 'pases', 'llegada', 'tirosLejanos', 'recuperacion', 'regate'],
  MCO: ['vision', 'paseFiltrado', 'llegada', 'regate', 'tirosLejanos', 'definicion'],
  MD:  ['velocidad', 'pases', 'regate', 'centro', 'duelos', 'tirosLejanos'],
  MI:  ['velocidad', 'pases', 'regate', 'centro', 'duelos', 'tirosLejanos'],
  EI:  ['velocidad', 'regate', 'centro', 'tirosLejanos', 'desmarque', 'definicion'],
  ED:  ['velocidad', 'regate', 'centro', 'tirosLejanos', 'desmarque', 'definicion'],
  DC:  ['definicion', 'cabezazo', 'fisico', 'desmarque', 'velocidad', 'pases'],
}

function generateStats(position, rating) {
  const keys = POSITION_STATS[position] ?? POSITION_STATS['MC']
  const n = keys.length
  const offsets5 = [3, 2, 0, -2, -3]
  const offsets6 = [3, 2, 1, -1, -2, -3]
  const offsets  = n === 6 ? offsets6 : offsets5
  const stats = {}
  keys.forEach((k, i) => {
    stats[k] = Math.min(99, Math.max(50, rating + (offsets[i] ?? 0)))
  })
  return stats
}

function slugify(name) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function makeId(countryPrefix, name, usedIds) {
  const parts = name.trim().split(/\s+/)
  const last  = parts[parts.length - 1]
  const first = parts[0]
  const code  = (first[0] + last).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12)
  let id = `${countryPrefix}26-${code}`
  let n = 2
  while (usedIds.has(id)) { id = `${countryPrefix}26-${code}${n}`; n++ }
  usedIds.add(id)
  return id
}

const COUNTRY_META = {
  'Argentina': { code: 'ARG', slug: 'argentina', conf: 'CONMEBOL', prefix: 'arg' },
  'Brasil':    { code: 'BRA', slug: 'brazil',    conf: 'CONMEBOL', prefix: 'bra' },
  'Uruguay':   { code: 'URU', slug: 'uruguay',   conf: 'CONMEBOL', prefix: 'uru' },
  'España':    { code: 'ESP', slug: 'spain',     conf: 'UEFA',     prefix: 'esp' },
  'Francia':   { code: 'FRA', slug: 'france',    conf: 'UEFA',     prefix: 'fra' },
  'Alemania':  { code: 'GER', slug: 'germany',   conf: 'UEFA',     prefix: 'ger' },
  'Holanda':   { code: 'NED', slug: 'netherlands', conf: 'UEFA',   prefix: 'ned' },
  'Inglaterra':{ code: 'ENG', slug: 'england',   conf: 'UEFA',     prefix: 'eng' },
  'Portugal':  { code: 'POR', slug: 'portugal',  conf: 'UEFA',     prefix: 'por' },
}

const batch   = JSON.parse(fs.readFileSync(BATCH, 'utf8'))
const squads2026 = batch.filter(s => s.year === 2026)

const createdSlugs = []

for (const squad of squads2026) {
  const meta = COUNTRY_META[squad.country]
  if (!meta) { console.warn(`⚠ País desconocido: ${squad.country}`); continue }

  const usedIds = new Set()
  const players = squad.players.map(p => {
    const id    = makeId(meta.prefix, p.name, usedIds)
    const stats = generateStats(p.position, p.rating)
    return {
      id,
      name: p.name,
      position: p.position,
      altPositions: p.altPositions ?? [],
      stats,
      rating: p.rating,
      country: squad.country,
      tournamentYear: 2026,
      tournamentId: 'wc-2026',
    }
  })

  const sourceFile = {
    country: squad.country,
    countryCode: meta.code,
    confederation: meta.conf,
    year: 2026,
    tournamentId: 'wc-2026',
    players,
  }

  const outPath = path.join(DATA_DIR, `2026-${meta.slug}.json`)
  fs.writeFileSync(outPath, JSON.stringify(sourceFile, null, 2))
  console.log(`✓ Creado: 2026-${meta.slug}.json (${players.length} jugadores)`)
  createdSlugs.push(meta.slug)
}

// ── Actualizar index.json ────────────────────────────────────────────────────
const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'))
const already2026 = index.tournaments.find(t => t.id === 'wc-2026')
if (!already2026) {
  index.tournaments.push({
    id: 'wc-2026',
    type: 'world-cup',
    year: 2026,
    host: 'USA/Canadá/México',
    winner: null,
    squads: createdSlugs,
  })
  fs.writeFileSync(INDEX, JSON.stringify(index, null, 2))
  console.log(`✓ index.json actualizado (entrada wc-2026 agregada)`)
} else {
  console.log(`ℹ wc-2026 ya estaba en index.json`)
}

// ── Actualizar catalog.json ───────────────────────────────────────────────────
const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'))
for (const slug of createdSlugs) {
  const meta = Object.values(COUNTRY_META).find(m => m.slug === slug)
  const nameEntry = Object.entries(COUNTRY_META).find(([, m]) => m.slug === slug)
  const countryName = nameEntry?.[0]
  const alreadyInCatalog = catalog.squads.find(s => s.tournamentId === 'wc-2026' && s.slug === slug)
  if (!alreadyInCatalog) {
    catalog.squads.push({
      tournamentId: 'wc-2026',
      year: 2026,
      slug,
      country: countryName ?? slug,
      confederation: meta?.conf ?? 'UEFA',
      countryCode: meta?.code ?? slug.toUpperCase().slice(0, 3),
    })
  }
}
fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2))
console.log(`✓ catalog.json actualizado (${createdSlugs.length} entradas wc-2026 agregadas)`)
