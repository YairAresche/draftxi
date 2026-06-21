/**
 * normalize-ratings.mjs
 * Recalibra ratings de todos los jugadores usando resultados históricos de mundiales.
 * Escribe public/data/overrides.json sin modificar los JSONs originales.
 *
 * Uso: node scripts/normalize-ratings.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR   = path.join(__dirname, '../public/data/tournaments/world-cup')
const OUTPUT     = path.join(__dirname, '../public/data/overrides.json')

// ── Resultados históricos (clave: "año-slug") ─────────────────────────────────
const WC_RESULTS = {
  // 1930
  '1930-uruguay': 'champion', '1930-argentina': 'finalist',
  '1930-usa': 'third', '1930-yugoslavia': 'third',
  // 1934
  '1934-italy': 'champion', '1934-czechoslovakia': 'finalist',
  '1934-germany': 'third', '1934-austria': 'third',
  // 1938
  '1938-italy': 'champion', '1938-hungary': 'finalist',
  '1938-brazil': 'third', '1938-sweden': 'third',
  // 1950
  '1950-uruguay': 'champion', '1950-brazil': 'finalist',
  '1950-sweden': 'third', '1950-spain': 'third',
  // 1954
  '1954-west-germany': 'champion', '1954-hungary': 'finalist',
  '1954-austria': 'third', '1954-uruguay': 'third',
  // 1958
  '1958-brazil': 'champion', '1958-sweden': 'finalist',
  '1958-france': 'third', '1958-west-germany': 'third',
  // 1962
  '1962-brazil': 'champion', '1962-czechoslovakia': 'finalist',
  '1962-chile': 'third', '1962-yugoslavia': 'third',
  // 1966
  '1966-england': 'champion', '1966-west-germany': 'finalist',
  '1966-portugal': 'third', '1966-soviet-union': 'third',
  // 1970
  '1970-brazil': 'champion', '1970-italy': 'finalist',
  '1970-west-germany': 'third', '1970-uruguay': 'third',
  // 1974
  '1974-west-germany': 'champion', '1974-netherlands': 'finalist',
  '1974-poland': 'third', '1974-brazil': 'third',
  // 1978
  '1978-argentina': 'champion', '1978-netherlands': 'finalist',
  '1978-brazil': 'third', '1978-italy': 'third',
  // 1982
  '1982-italy': 'champion', '1982-west-germany': 'finalist',
  '1982-poland': 'third', '1982-france': 'third',
  // 1986
  '1986-argentina': 'champion', '1986-west-germany': 'finalist',
  '1986-france': 'third', '1986-belgium': 'third',
  // 1990
  '1990-west-germany': 'champion', '1990-argentina': 'finalist',
  '1990-italy': 'third', '1990-england': 'third',
  // 1994
  '1994-brazil': 'champion', '1994-italy': 'finalist',
  '1994-sweden': 'third', '1994-bulgaria': 'third',
  // 1998
  '1998-france': 'champion', '1998-brazil': 'finalist',
  '1998-croatia': 'third', '1998-netherlands': 'third',
  // 2002
  '2002-brazil': 'champion', '2002-germany': 'finalist',
  '2002-turkey': 'third', '2002-south-korea': 'third',
  // 2006
  '2006-italy': 'champion', '2006-france': 'finalist',
  '2006-germany': 'third', '2006-portugal': 'third',
  // 2010
  '2010-spain': 'champion', '2010-netherlands': 'finalist',
  '2010-germany': 'third', '2010-uruguay': 'third',
  // 2014
  '2014-germany': 'champion', '2014-argentina': 'finalist',
  '2014-netherlands': 'third', '2014-brazil': 'third',
  // 2018
  '2018-france': 'champion', '2018-croatia': 'finalist',
  '2018-belgium': 'third', '2018-england': 'third',
  // 2022
  '2022-argentina': 'champion', '2022-france': 'finalist',
  '2022-croatia': 'third', '2022-morocco': 'third',
}

// Strength mínima garantizada por nación histórica (evita que una caída en grupos las arruine)
const NATION_FLOOR = {
  'brazil':        0.74,
  'argentina':     0.72,
  'west-germany':  0.74,
  'germany':       0.72,
  'italy':         0.71,
  'france':        0.68,
  'netherlands':   0.68,
  'spain':         0.66,
  'england':       0.64,
  'portugal':      0.63,
  'uruguay':       0.65,
  'hungary':       0.61,
  'soviet-union':  0.61,
  'yugoslavia':    0.59,
  'poland':        0.59,
  'croatia':       0.61,
  'belgium':       0.61,
  'sweden':        0.59,
  'czechoslovakia':0.59,
  'czech-republic':0.58,
  'denmark':       0.57,
  'mexico':        0.54,
  'united-states': 0.52,
  'senegal':       0.52,
  'turkey':        0.52,
  'south-korea':   0.52,
}

// Strength por resultado en el torneo
const RESULT_STRENGTH = {
  champion: 1.00,
  finalist: 0.93,
  third:    0.86,
  quarter:  0.78,
  r16:      0.70,
}

// Baseline por confederación para equipos sin resultado conocido
const CONF_BASELINE = {
  UEFA:      0.58,
  CONMEBOL:  0.60,
  CONCACAF:  0.44,
  CAF:       0.44,
  AFC:       0.43,
  OFC:       0.40,
}

function getStrength(year, slug, confederation) {
  const key = `${year}-${slug}`
  const result = WC_RESULTS[key]
  if (result) return RESULT_STRENGTH[result]
  const floor   = NATION_FLOOR[slug] ?? 0
  const base    = CONF_BASELINE[confederation] ?? 0.50
  return Math.max(floor, base)
}

// Grupos de posición con rangos objetivo propios
const POS_GROUPS = [
  { name: 'GK',  positions: new Set(['POR']),
    topBase: 60, topMult: 27, spreadBase: 10, spreadMult: 6,  cap: 89 },
  { name: 'DEF', positions: new Set(['DFC','LD','LI']),
    topBase: 60, topMult: 29, spreadBase: 14, spreadMult: 8,  cap: 91 },
  { name: 'MID', positions: new Set(['MCD','MC','MCO','MI','MD']),
    topBase: 60, topMult: 31, spreadBase: 14, spreadMult: 10, cap: 93 },
  { name: 'FWD', positions: new Set(['DC','EI','ED']),
    topBase: 62, topMult: 34, spreadBase: 15, spreadMult: 11, cap: 97 },
]

function applyGroup(players, strength, group) {
  if (players.length === 0) return {}
  const sorted = [...players].sort((a, b) => b.rating - a.rating)
  const n      = sorted.length
  const topRating    = Math.min(group.cap, Math.round(group.topBase + strength * group.topMult))
  const spread       = Math.round(group.spreadBase + strength * group.spreadMult)
  const bottomRating = Math.max(58, topRating - spread)

  const overrides = {}
  sorted.forEach((player, i) => {
    // Curva sqrt: mayor separación en el top, más compresión en la base
    const rankFrac     = n > 1 ? i / (n - 1) : 0
    const curved       = Math.sqrt(rankFrac)
    const targetRating = Math.round(topRating - (topRating - bottomRating) * curved)

    const scale = player.rating > 0 ? targetRating / player.rating : 1
    const newStats = {}
    for (const [k, v] of Object.entries(player.stats)) {
      newStats[k] = Math.min(99, Math.max(40, Math.round(v * scale)))
    }
    overrides[player.id] = { rating: targetRating, stats: newStats }
  })
  return overrides
}

function normalizeSquad(squad, year, slug) {
  const strength = getStrength(year, slug, squad.confederation)
  const overrides = {}

  for (const group of POS_GROUPS) {
    const groupPlayers = squad.players.filter(p => group.positions.has(p.position))
    Object.assign(overrides, applyGroup(groupPlayers, strength, group))
  }

  // Jugadores con posición no mapeada → normalización global residual
  const mapped = new Set(POS_GROUPS.flatMap(g => [...g.positions]))
  const rest   = squad.players.filter(p => !mapped.has(p.position))
  if (rest.length > 0) {
    const fallbackGroup = { topBase: 60, topMult: 30, spreadBase: 14, spreadMult: 9, cap: 91 }
    Object.assign(overrides, applyGroup(rest, strength, fallbackGroup))
  }

  return overrides
}

// ── Main ──────────────────────────────────────────────────────────────────────
const files = fs.readdirSync(DATA_DIR)
  .filter(f => f.endsWith('.json') && !['catalog.json', 'index.json'].includes(f))

const allOverrides = {}
let squadCount = 0

for (const file of files) {
  const match = file.match(/^(\d{4})-(.+)\.json$/)
  if (!match) continue
  const year = parseInt(match[1])
  const slug = match[2]

  const squad = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'))
  const ovs = normalizeSquad(squad, year, slug)
  Object.assign(allOverrides, ovs)
  squadCount++
}

fs.writeFileSync(OUTPUT, JSON.stringify(allOverrides, null, 2))
console.log(`✓ ${Object.keys(allOverrides).length} jugadores normalizados en ${squadCount} selecciones`)
console.log(`  → ${OUTPUT}`)

// Muestra ejemplos para validación rápida
const EXAMPLES = ['fra22lloris', 'fra22mbappe', 'fra22griezmann', 'fra22varane', 'fra22benzema']
console.log('\nEjemplos Francia 2022:')
for (const id of EXAMPLES) {
  const ov = allOverrides[id]
  if (ov) console.log(`  ${id.padEnd(20)} rating: ${ov.rating}`)
}
