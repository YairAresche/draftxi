import type { SquadPlayer, PlayerStats } from '@/types/player'
import type {
  MatchResult, MatchEvent, TournamentSummary, PlayerTournamentStats,
} from '@/types/game'
import type { Squad } from '@/types/tournament'
import type { TeamChemistry } from '@/types/game'

// Seeded PRNG so same inputs = same output
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

function statOrRating(p: SquadPlayer, ...keys: (keyof PlayerStats)[]): number {
  const vals = keys
    .map(k => p.stats?.[k])
    .filter((v): v is number => typeof v === 'number')
  return vals.length > 0 ? avg(vals) : p.rating
}

function weightedRandom<T>(items: T[], weights: number[], rand: () => number): T {
  const total = weights.reduce((s, w) => s + w, 0)
  if (total === 0 || items.length === 0) return items[Math.floor(rand() * items.length)]
  let r = rand() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

// ── Layer 1: Zone-based rating ─────────────────────────────────────────────
// Replaces flat avg(rating). Each zone uses the relevant stats; falls back
// to player.rating if a stat is missing (older/uncurated players).

function computeZoneScores(picks: SquadPlayer[]): { attack: number; defense: number } {
  const attackers = picks.filter(p => ['DC', 'EI', 'ED', 'MCO'].includes(p.slotPosition))
  const defenders = picks.filter(p => ['DFC', 'LD', 'LI'].includes(p.slotPosition))
  const midfield  = picks.filter(p => ['MCD', 'MC', 'MI', 'MD'].includes(p.slotPosition))
  const keeper    = picks.find(p => p.slotPosition === 'POR')

  const attackScore = (() => {
    const scores = attackers.map(p => {
      if (p.slotPosition === 'DC')
        return statOrRating(p, 'definicion', 'fisico', 'desmarque')
      if (['EI', 'ED'].includes(p.slotPosition))
        return statOrRating(p, 'velocidad', 'regate', 'disparo')
      return statOrRating(p, 'vision', 'llegada', 'paseFiltrado')  // MCO
    })
    return scores.length > 0 ? avg(scores) : avg(picks.map(p => p.rating))
  })()

  const keeperScore = keeper ? statOrRating(keeper, 'reflejos', 'manejo', 'salidas') : 70

  const defenseScores = [
    ...defenders.map(p => statOrRating(p, 'defAerea', 'intercepciones', 'duelos')),
    ...midfield.filter(p => p.slotPosition === 'MCD').map(p =>
      statOrRating(p, 'recuperacion', 'posicionamiento', 'duelos')),
    keeperScore,
  ]
  const defenseScore = avg(defenseScores.length > 0 ? defenseScores : picks.map(p => p.rating))

  // Midfield multiplier: good passers/vision add up to +10%, bad ones up to -5%
  const midfieldAvg = midfield.length > 0 ? avg(midfield.map(p => statOrRating(p, 'pases', 'vision'))) : 75
  const midfieldMult = 1 + Math.min(Math.max((midfieldAvg - 70) / 100, -0.05), 0.10)

  return {
    attack:  attackScore  * midfieldMult,
    defense: defenseScore * midfieldMult,
  }
}

function teamRating(picks: SquadPlayer[], chemistry: TeamChemistry): number {
  if (picks.length === 0) return 50
  const zones = computeZoneScores(picks)
  return ((zones.attack + zones.defense) / 2) * (1 + chemistry.total)
}

function cpuRating(squad: Squad): number {
  if (!squad.players.length) return 72
  return squad.players.reduce((s, p) => s + p.rating, 0) / squad.players.length
}

const PHASES: MatchResult['phase'][] = [
  'grupo-1', 'grupo-2', 'grupo-3', 'octavos', 'cuartos', 'semis', 'final',
]

const PHASE_LABELS: Record<MatchResult['phase'], string> = {
  'grupo-1': 'Fase de grupos — Jornada 1',
  'grupo-2': 'Fase de grupos — Jornada 2',
  'grupo-3': 'Fase de grupos — Jornada 3',
  'octavos': 'Octavos de final',
  'cuartos': 'Cuartos de final',
  'semis':   'Semifinal',
  'final':   'Gran Final',
}

// ── Layer 2: Weighted event narrative ─────────────────────────────────────
// Scorer and assister are picked by position-specific stats, not uniformly.

function generateEvents(
  picks: SquadPlayer[],
  cpuSquad: Squad,
  goalsFor: number,
  goalsAgainst: number,
  rand: () => number,
  injuriesEnabled: boolean
): MatchEvent[] {
  const events: MatchEvent[] = []
  const usedMinutes = new Set<number>()

  function uniqueMinute(min: number, max: number): number {
    let m = Math.floor(rand() * (max - min + 1)) + min
    let tries = 0
    while (usedMinutes.has(m) && tries < 20) { m = (m % (max - min) + min); tries++ }
    usedMinutes.add(m)
    return m
  }

  const scorers   = picks.filter(p => ['DC', 'MCO', 'EI', 'ED', 'MC'].includes(p.slotPosition))
  const assisters = picks.filter(p =>
    ['MCO', 'MC', 'MCD', 'EI', 'ED', 'MI', 'MD', 'DC', 'LD', 'LI'].includes(p.slotPosition))
  const keepers   = picks.filter(p => p.slotPosition === 'POR')
  const defenders = picks.filter(p => ['DFC', 'LD', 'LI', 'MCD'].includes(p.slotPosition))

  // Scorer weights: DC = definicion+cabezazo, EI/ED = velocidad+disparo+regate, MCO/MC = rating
  const scorerWeights = scorers.map(p => {
    if (p.slotPosition === 'DC')
      return (p.stats?.definicion ?? p.rating) * 1.3 + (p.stats?.cabezazo ?? p.rating) * 0.4
    if (['EI', 'ED'].includes(p.slotPosition))
      return (p.stats?.velocidad ?? p.rating) * 0.4 + (p.stats?.disparo ?? p.rating) * 0.9 + (p.stats?.regate ?? p.rating) * 0.4
    return p.rating  // MCO, MC — baseline
  })

  // Assister weights: vision + paseFiltrado/pases
  const assisterWeights = assisters.map(p =>
    (p.stats?.vision ?? p.rating) * 0.6 + (p.stats?.paseFiltrado ?? p.stats?.pases ?? p.rating) * 0.4
  )

  const cpuScorers = cpuSquad.players
    .filter(p => ['DC', 'MCO', 'EI', 'ED'].includes(p.position))
    .slice(0, 3)

  // Goals for
  for (let i = 0; i < goalsFor; i++) {
    const scorer = scorers.length > 0
      ? weightedRandom(scorers, scorerWeights, rand)
      : picks[Math.floor(rand() * picks.length)]
    const minute = uniqueMinute(5, 90)
    const eligibleAssisters = assisters.filter(a => a.id !== scorer?.id)
    const eligibleWeights   = eligibleAssisters.map(p =>
      (p.stats?.vision ?? p.rating) * 0.6 + (p.stats?.paseFiltrado ?? p.stats?.pases ?? p.rating) * 0.4
    )
    const assister = eligibleAssisters.length > 0 && rand() < 0.65
      ? weightedRandom(eligibleAssisters, eligibleWeights, rand)
      : null
    const desc = assister
      ? `⚽ ¡GOL! ${scorer?.name ?? 'Tu jugador'} anota asistido por ${assister.name} en el min. ${minute}.`
      : `⚽ ¡GOL! ${scorer?.name ?? 'Tu jugador'} anota en el minuto ${minute}.`
    events.push({ minute, type: 'gol', playerId: scorer?.id, playerName: scorer?.name, assistId: assister?.id, assistName: assister?.name, team: 'tuyo', description: desc })
  }

  // VAR drama — annulled goal
  if (goalsFor > 0 && rand() < 0.15) {
    const scorer = scorers.length > 0 ? scorers[Math.floor(rand() * scorers.length)] : picks[0]
    const minute = uniqueMinute(5, 90)
    events.push({ minute, type: 'gol-anulado', playerId: scorer?.id, playerName: scorer?.name, team: 'tuyo', description: `🚫 ¡Gol anulado por VAR! ${scorer?.name ?? 'Tu jugador'} festejó de más.` })
  }

  // Goals against
  for (let i = 0; i < goalsAgainst; i++) {
    const scorer = cpuScorers.length > 0 ? cpuScorers[Math.floor(rand() * cpuScorers.length)] : null
    const minute = uniqueMinute(5, 90)
    events.push({ minute, type: 'gol', playerName: scorer?.name, team: 'rival', description: `⚽ Gol del rival. ${scorer?.name ?? 'Jugador rival'} marca en el minuto ${minute}.` })
  }

  // Key saves — count scales with keeper reflejos
  const keeperReflejos = keepers[0]?.stats?.reflejos ?? keepers[0]?.rating ?? 75
  const saveCount = goalsAgainst === 0
    ? (keeperReflejos >= 88 ? Math.floor(rand() * 2) + 2 : Math.floor(rand() * 2) + 1)
    : (goalsAgainst <= 1 && keeperReflejos >= 87 && rand() < (keeperReflejos - 82) / 20 ? 1 : 0)
  for (let i = 0; i < saveCount; i++) {
    const keeper = keepers[0]
    const minute = uniqueMinute(10, 88)
    events.push({ minute, type: 'atajada', playerId: keeper?.id, playerName: keeper?.name, team: 'tuyo', description: `🧤 ¡Atajada clave de ${keeper?.name ?? 'tu arquero'}!` })
  }

  // Yellow card — weighted by duelos (hard tacklers foul more)
  if (defenders.length > 0 && rand() < 0.4) {
    const duelosWeights = defenders.map(p => p.stats?.duelos ?? p.rating)
    const card = weightedRandom(defenders, duelosWeights, rand)
    const minute = uniqueMinute(20, 85)
    events.push({ minute, type: 'amarilla', playerId: card?.id, playerName: card?.name, team: 'tuyo', description: `🟨 Tarjeta amarilla para ${card?.name ?? 'un defensor'}.` })
  }

  // Red card (rare)
  if (rand() < 0.06) {
    const card = picks[Math.floor(rand() * picks.length)]
    const minute = uniqueMinute(40, 88)
    events.push({ minute, type: 'roja', playerId: card?.id, playerName: card?.name, team: 'tuyo', description: `🟥 ¡Expulsión! ${card?.name ?? 'Un jugador'} ve la roja.` })
  }

  return events.sort((a, b) => a.minute - b.minute)
}

function simulateMatch(
  myRating: number,
  rivalRating: number,
  rand: () => number
): { goalsFor: number; goalsAgainst: number } {
  const ratingDiff = myRating - rivalRating
  const winProb = 0.5 + ratingDiff * 0.006
  const clamped = Math.max(0.1, Math.min(0.9, winProb))

  const roll = rand()
  const baseGoalsFor     = Math.floor(rand() * 4)
  const baseGoalsAgainst = Math.floor(rand() * 3)

  if (roll < clamped) {
    const gf = Math.max(1, baseGoalsFor)
    const ga = Math.max(0, Math.min(gf - 1, baseGoalsAgainst))
    return { goalsFor: gf, goalsAgainst: ga }
  } else if (roll < clamped + 0.15) {
    const g = Math.floor(rand() * 3)
    return { goalsFor: g, goalsAgainst: g }
  } else {
    const ga = Math.max(1, baseGoalsAgainst + 1)
    const gf = Math.max(0, Math.min(ga - 1, baseGoalsFor))
    return { goalsFor: gf, goalsAgainst: ga }
  }
}

function fallbackSquad(): Squad {
  return { tournamentId: 'cpu', year: 1970, country: 'CPU', confederation: 'UEFA', countryCode: 'CPU', players: [] }
}

export function runTournament(
  picks: SquadPlayer[],
  chemistry: TeamChemistry,
  cpuSquads: Squad[],
  injuriesEnabled: boolean,
  seed: number
): TournamentSummary {
  const rand     = mulberry32(seed)
  const myRating = teamRating(picks, chemistry)
  const squads   = cpuSquads.length > 0 ? cpuSquads : [fallbackSquad()]

  const matches: MatchResult[]                        = []
  const playerStats = new Map<string, PlayerTournamentStats>()

  for (const p of picks) {
    playerStats.set(p.id, {
      playerId: p.id,
      playerName: p.name,
      position: p.slotPosition,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      keySaves: 0,
      rating: p.rating,
    })
  }

  let eliminated = false

  for (let i = 0; i < PHASES.length; i++) {
    if (eliminated) break
    const phase      = PHASES[i]
    const rival      = squads[i % squads.length]
    const rivalRat   = cpuRating(rival)
    const { goalsFor, goalsAgainst } = simulateMatch(myRating, rivalRat, rand)
    const won        = goalsFor > goalsAgainst
    const events     = generateEvents(picks, rival, goalsFor, goalsAgainst, rand, injuriesEnabled)

    for (const ev of events) {
      if (ev.team === 'tuyo' && ev.playerId) {
        const stat = playerStats.get(ev.playerId)
        if (stat) {
          if (ev.type === 'gol')     stat.goals++
          if (ev.type === 'atajada') stat.keySaves++
        }
      }
      if (ev.type === 'gol' && ev.team === 'tuyo' && ev.assistId) {
        const assistStat = playerStats.get(ev.assistId)
        if (assistStat) assistStat.assists++
      }
    }
    if (goalsAgainst === 0) {
      for (const p of picks.filter(p => ['POR', 'DFC', 'LD', 'LI'].includes(p.slotPosition))) {
        const stat = playerStats.get(p.id)
        if (stat) stat.cleanSheets++
      }
    }

    const isKnockout = ['octavos', 'cuartos', 'semis', 'final'].includes(phase)
    let wonMatch  = won
    let penalties = false

    if (isKnockout && goalsFor === goalsAgainst) {
      wonMatch  = rand() > 0.5
      penalties = true
    }

    eliminated = isKnockout && !wonMatch

    matches.push({ rivalSquad: rival, goalsFor, goalsAgainst, phase, events, won: wonMatch, eliminated, ...(penalties ? { penalties: true } : {}) })
  }

  const stats = Array.from(playerStats.values())
  for (const s of stats) {
    s.rating = Math.round(s.rating + s.goals * 2 + s.assists * 1.5 + s.keySaves * 1.5 + s.cleanSheets * 1)
  }

  const sortBy = (key: keyof PlayerTournamentStats) =>
    [...stats].sort((a, b) => (b[key] as number) - (a[key] as number))[0] ?? null

  const topScorer  = sortBy('goals')
  const topAssist  = sortBy('assists')
  const bestKeeper = stats.filter(s => s.position === 'POR').sort((a, b) => b.keySaves - a.keySaves)[0] ?? null
  const mvp        = sortBy('rating')

  const lastMatch     = matches[matches.length - 1]
  const won           = lastMatch?.won ?? false
  const finalResult: TournamentSummary['finalResult'] = won
    ? 'campeon'
    : lastMatch?.phase === 'final'   ? 'finalista'
    : lastMatch?.phase === 'semis'   ? 'semifinalista'
    : lastMatch?.phase === 'cuartos' ? 'cuartos'
    : lastMatch?.phase === 'octavos' ? 'octavos'
    : 'grupos'

  return { matches, playerStats: stats, topScorer, topAssist, bestKeeper, mvp, won, finalResult }
}
