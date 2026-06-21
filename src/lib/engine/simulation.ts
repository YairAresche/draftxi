import type { SquadPlayer } from '@/types/player'
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

function teamRating(picks: SquadPlayer[], chemistry: TeamChemistry): number {
  if (picks.length === 0) return 50
  const avg = picks.reduce((s, p) => s + p.rating, 0) / picks.length
  return avg * (1 + chemistry.total)
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
  'semis': 'Semifinal',
  'final': 'Gran Final',
}

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

  const scorers = picks.filter(p =>
    ['DC', 'MCO', 'EI', 'ED', 'MC'].includes(p.slotPosition)
  )
  const keepers = picks.filter(p => p.slotPosition === 'POR')
  const defenders = picks.filter(p =>
    ['DFC', 'LD', 'LI', 'MCD'].includes(p.slotPosition)
  )

  const cpuScorers = cpuSquad.players
    .filter(p => ['DC', 'MCO', 'EI', 'ED'].includes(p.position))
    .slice(0, 3)

  // Goals for
  for (let i = 0; i < goalsFor; i++) {
    const scorer = scorers[Math.floor(rand() * scorers.length)]
    const minute = uniqueMinute(5, 90)
    const isVar = rand() < 0.08
    if (isVar) {
      events.push({ minute, type: 'gol-anulado', playerId: scorer?.id, playerName: scorer?.name, team: 'tuyo', description: `¡Gol anulado por VAR! ${scorer?.name ?? 'Tu jugador'} festejó de más.` })
    } else {
      events.push({ minute, type: 'gol', playerId: scorer?.id, playerName: scorer?.name, team: 'tuyo', description: `⚽ ¡GOL! ${scorer?.name ?? 'Tu jugador'} anota en el minuto ${minute}.` })
    }
  }

  // Goals against
  for (let i = 0; i < goalsAgainst; i++) {
    const scorer = cpuScorers[Math.floor(rand() * cpuScorers.length)]
    const minute = uniqueMinute(5, 90)
    events.push({ minute, type: 'gol', playerName: scorer?.name, team: 'rival', description: `⚽ Gol del rival. ${scorer?.name ?? 'Jugador rival'} marca en el minuto ${minute}.` })
  }

  // Key saves
  const saveCount = goalsAgainst === 0 ? Math.floor(rand() * 2) + 1 : 0
  for (let i = 0; i < saveCount; i++) {
    const keeper = keepers[0]
    const minute = uniqueMinute(10, 88)
    events.push({ minute, type: 'atajada', playerId: keeper?.id, playerName: keeper?.name, team: 'tuyo', description: `🧤 ¡Atajada clave de ${keeper?.name ?? 'tu arquero'}!` })
  }

  // Yellow cards
  if (rand() < 0.4) {
    const card = defenders[Math.floor(rand() * defenders.length)]
    const minute = uniqueMinute(20, 85)
    events.push({ minute, type: 'amarilla', playerId: card?.id, playerName: card?.name, team: 'tuyo', description: `🟨 Tarjeta amarilla para ${card?.name ?? 'un defensor'}.` })
  }

  // Red card (rare)
  if (rand() < 0.06) {
    const card = picks[Math.floor(rand() * picks.length)]
    const minute = uniqueMinute(40, 88)
    events.push({ minute, type: 'roja', playerId: card?.id, playerName: card?.name, team: 'tuyo', description: `🟥 ¡Expulsión! ${card?.name ?? 'Un jugador'} ve la roja.` })
  }

  // Injury
  if (injuriesEnabled && rand() < 0.15) {
    const injured = picks[Math.floor(rand() * picks.length)]
    const minute = uniqueMinute(30, 75)
    events.push({ minute, type: 'lesion', playerId: injured?.id, playerName: injured?.name, team: 'tuyo', description: `🚑 Lesión de ${injured?.name ?? 'un jugador'}. Sale del campo.` })
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
  const baseGoalsFor = Math.floor(rand() * 4)
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
  const rand = mulberry32(seed)
  const myRating = teamRating(picks, chemistry)
  const squads = cpuSquads.length > 0 ? cpuSquads : [fallbackSquad()]

  const matches: MatchResult[] = []
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
    const phase = PHASES[i]
    const rival = squads[i % squads.length]
    const rivalRat = cpuRating(rival)
    const { goalsFor, goalsAgainst } = simulateMatch(myRating, rivalRat, rand)
    const won = goalsFor > goalsAgainst
    const events = generateEvents(picks, rival, goalsFor, goalsAgainst, rand, injuriesEnabled)

    // Accumulate stats from events
    for (const ev of events) {
      if (ev.team === 'tuyo' && ev.playerId) {
        const stat = playerStats.get(ev.playerId)
        if (!stat) continue
        if (ev.type === 'gol') stat.goals++
        if (ev.type === 'atajada') stat.keySaves++
      }
    }
    // Clean sheet
    if (goalsAgainst === 0) {
      for (const p of picks.filter(p => ['POR', 'DFC', 'LD', 'LI'].includes(p.slotPosition))) {
        const stat = playerStats.get(p.id)
        if (stat) stat.cleanSheets++
      }
    }

    const isKnockout = ['octavos', 'cuartos', 'semis', 'final'].includes(phase)
    eliminated = isKnockout && !won

    matches.push({ rivalSquad: rival, goalsFor, goalsAgainst, phase, events, won, eliminated })
  }

  const stats = Array.from(playerStats.values())
  // Adjust ratings based on performance
  for (const s of stats) {
    s.rating = Math.round(s.rating + s.goals * 2 + s.assists * 1.5 + s.keySaves * 1.5 + s.cleanSheets * 1)
  }

  const sortBy = (key: keyof PlayerTournamentStats) =>
    [...stats].sort((a, b) => (b[key] as number) - (a[key] as number))[0] ?? null

  const topScorer = sortBy('goals')
  const topAssist = sortBy('assists')
  const bestKeeper = stats.filter(s => s.position === 'POR').sort((a, b) => b.keySaves - a.keySaves)[0] ?? null
  const mvp = sortBy('rating')

  const lastMatch = matches[matches.length - 1]
  const won = lastMatch?.won ?? false
  const finalResult: TournamentSummary['finalResult'] = won
    ? 'campeon'
    : lastMatch?.phase === 'final' ? 'finalista'
    : lastMatch?.phase === 'semis' ? 'semifinalista'
    : lastMatch?.phase === 'cuartos' ? 'cuartos'
    : lastMatch?.phase === 'octavos' ? 'octavos'
    : 'grupos'

  return { matches, playerStats: stats, topScorer, topAssist, bestKeeper, mvp, won, finalResult }
}
