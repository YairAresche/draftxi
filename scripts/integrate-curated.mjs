/**
 * integrate-curated.mjs
 * Integra datos curados (de scripts/curated/*.json) al overrides.json.
 * Matchea jugadores por nombre, regenera stats desde rating + posición.
 *
 * Uso:
 *   node scripts/integrate-curated.mjs           → procesa todos
 *   node scripts/integrate-curated.mjs 2022-spain → procesa solo ese archivo
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR   = path.join(__dirname, '../public/data/tournaments/world-cup')
const OVERRIDES  = path.join(__dirname, '../public/data/overrides.json')
const CURATED    = path.join(__dirname, 'curated')

// Stats por posición (coincide con game types)
const POSITION_STATS = {
  POR: ['reflejos', 'manejo', 'salidas', 'penales', 'distribucion'],
  LD:  ['defAerea', 'intercepciones', 'velocidad', 'pases', 'duelos'],
  LI:  ['defAerea', 'intercepciones', 'velocidad', 'pases', 'duelos'],
  DFC: ['defAerea', 'intercepciones', 'velocidad', 'pases', 'duelos'],
  MCD: ['recuperacion', 'pases', 'posicionamiento', 'duelos', 'resistencia'],
  MC:  ['pases', 'vision', 'llegada', 'recuperacion', 'tecnica'],
  MCO: ['vision', 'paseFiltrado', 'llegada', 'regate', 'disparo'],
  MD:  ['velocidad', 'regate', 'centro', 'disparo', 'pases'],
  MI:  ['velocidad', 'regate', 'centro', 'disparo', 'pases'],
  EI:  ['velocidad', 'regate', 'centro', 'disparo', 'desmarque'],
  ED:  ['velocidad', 'regate', 'centro', 'disparo', 'desmarque'],
  DC:  ['definicion', 'fisico', 'velocidad', 'cabezazo', 'pressing', 'desmarque'],
}

// Genera stats con variación determinista: primer stat = punta fuerte, último = más bajo
function generateStats(position, rating) {
  const keys = POSITION_STATS[position] ?? POSITION_STATS['MC']
  const n = keys.length
  // Offsets que suman 0, el jugador es más fuerte en su stat principal
  const offsets5 = [3, 2, 0, -2, -3]
  const offsets6 = [3, 2, 1, -1, -2, -3]
  const offsets  = n === 6 ? offsets6 : offsets5
  const stats = {}
  keys.forEach((k, i) => {
    stats[k] = Math.min(99, Math.max(50, rating + (offsets[i] ?? 0)))
  })
  return stats
}

// Normaliza nombre: minúsculas, sin tildes
function norm(name) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// Busca el jugador del squad que mejor matchee el nombre curado
function findMatch(curatedName, players) {
  const cn = norm(curatedName)
  // 1. Exacto
  let p = players.find(p => norm(p.name) === cn)
  if (p) return p
  // 2. El nombre curado contiene o está contenido en el nombre del squad
  p = players.find(p => { const pn = norm(p.name); return pn.includes(cn) || cn.includes(pn) })
  if (p) return p
  // 3. Último apellido coincide
  const lastName = cn.split(' ').pop()
  p = players.find(p => norm(p.name).split(' ').pop() === lastName)
  return p ?? null
}

// ── Main ──────────────────────────────────────────────────────────────────────
const filter = process.argv[2] ?? null

const curatedFiles = fs.readdirSync(CURATED)
  .filter(f => f.endsWith('.json') && (!filter || f.startsWith(filter)))

if (curatedFiles.length === 0) {
  console.error(`No se encontraron archivos curados${filter ? ` para "${filter}"` : ''} en scripts/curated/`)
  process.exit(1)
}

const overrides = fs.existsSync(OVERRIDES)
  ? JSON.parse(fs.readFileSync(OVERRIDES, 'utf8'))
  : {}

let totalUpdated = 0

for (const file of curatedFiles) {
  const m = file.match(/^(\d{4})-(.+)\.json$/)
  if (!m) continue
  const [, yearStr, slug] = m

  const curated = JSON.parse(fs.readFileSync(path.join(CURATED, file), 'utf8'))
  const sourceFile = path.join(DATA_DIR, `${yearStr}-${slug}.json`)

  if (!fs.existsSync(sourceFile)) {
    console.warn(`⚠  Archivo fuente no encontrado: ${yearStr}-${slug}.json`)
    continue
  }

  const squad   = JSON.parse(fs.readFileSync(sourceFile, 'utf8'))
  const unmatched = []
  let matched = 0

  for (const cp of curated.players) {
    const sp = findMatch(cp.name, squad.players)
    if (!sp) { unmatched.push(cp.name); continue }

    overrides[sp.id] = {
      rating:      cp.rating,
      position:    cp.position,
      altPositions: cp.altPositions ?? [],
      stats:       generateStats(cp.position, cp.rating),
    }
    matched++
  }

  const tag = `${yearStr} ${slug}`
  if (unmatched.length > 0) {
    console.log(`✓ ${tag}: ${matched} ok — sin match: ${unmatched.join(', ')}`)
  } else {
    console.log(`✓ ${tag}: ${matched} jugadores actualizados`)
  }
  totalUpdated += matched
}

fs.writeFileSync(OVERRIDES, JSON.stringify(overrides, null, 2))
console.log(`\n✓ overrides.json actualizado — ${totalUpdated} jugadores curados en total`)
