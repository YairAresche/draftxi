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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
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

// ── OVR derivado por posición ──────────────────────────────────────────────

const STAT_WEIGHTS: Record<string, Record<string, number>> = {
  POR: { reflejos: 0.30, manejo: 0.25, salidas: 0.20, penales: 0.10, distribucion: 0.10, comunicacion: 0.05 },
  LD:  { defAerea: 0.20, intercepciones: 0.20, duelos: 0.20, centro: 0.15, velocidad: 0.15, comunicacion: 0.10 },
  LI:  { defAerea: 0.20, intercepciones: 0.20, duelos: 0.20, centro: 0.15, velocidad: 0.15, comunicacion: 0.10 },
  DFC: { defAerea: 0.25, intercepciones: 0.25, duelos: 0.20, cabezazo: 0.15, posicionamiento: 0.10, comunicacion: 0.05 },
  MCD: { recuperacion: 0.25, duelos: 0.25, posicionamiento: 0.20, pases: 0.15, llegada: 0.10, tirosLejanos: 0.05 },
  MC:  { vision: 0.20, pases: 0.20, llegada: 0.20, tirosLejanos: 0.15, recuperacion: 0.15, regate: 0.10 },
  MCO: { vision: 0.20, paseFiltrado: 0.20, llegada: 0.20, regate: 0.15, tirosLejanos: 0.15, definicion: 0.10 },
  EI:  { velocidad: 0.20, regate: 0.20, centro: 0.15, tirosLejanos: 0.15, desmarque: 0.15, definicion: 0.15 },
  ED:  { velocidad: 0.20, regate: 0.20, centro: 0.15, tirosLejanos: 0.15, desmarque: 0.15, definicion: 0.15 },
  MI:  { velocidad: 0.20, pases: 0.20, regate: 0.20, centro: 0.15, duelos: 0.15, tirosLejanos: 0.10 },
  MD:  { velocidad: 0.20, pases: 0.20, regate: 0.20, centro: 0.15, duelos: 0.15, tirosLejanos: 0.10 },
  DC:  { definicion: 0.35, cabezazo: 0.15, fisico: 0.15, desmarque: 0.15, velocidad: 0.10, pases: 0.10 },
}

export function computeOvr(player: { position: string; stats?: Partial<Record<string, number>>; rating: number }): number {
  const weights = STAT_WEIGHTS[player.position]
  if (!weights || !player.stats) return player.rating
  const computed = Object.entries(weights).reduce((sum, [key, w]) => {
    return sum + (player.stats![key] ?? player.rating) * w
  }, 0)
  return Math.round(computed)
}

// ── Layer 1: Zone-based rating ─────────────────────────────────────────────

function computeServiceMult(picks: SquadPlayer[]): number {
  const wingers  = picks.filter(p => ['EI', 'ED'].includes(p.slotPosition))
  const fullbacks = picks.filter(p => ['LD', 'LI'].includes(p.slotPosition))
  const hasService = wingers.length > 0 || fullbacks.length > 0
  if (!hasService) return 1 + clamp((75 - 75) / 200, -0.08, 0.12)
  const wingerCentro  = wingers.length > 0  ? avg(wingers.map(p => p.stats?.centro ?? p.rating))   : 75
  const fbCentro      = fullbacks.length > 0 ? avg(fullbacks.map(p => p.stats?.centro ?? p.rating)) : 75
  const serviceScore  = wingerCentro * 0.70 + fbCentro * 0.30
  return 1 + clamp((serviceScore - 75) / 200, -0.08, 0.12)
}

function computeZoneScores(picks: SquadPlayer[]): { attack: number; defense: number } {
  const attackers = picks.filter(p => ['DC', 'EI', 'ED', 'MCO'].includes(p.slotPosition))
  const wingers   = picks.filter(p => ['EI', 'ED'].includes(p.slotPosition))
  const lateral   = picks.filter(p => ['MI', 'MD'].includes(p.slotPosition))
  const defenders = picks.filter(p => ['DFC', 'LD', 'LI'].includes(p.slotPosition))
  const midfield  = picks.filter(p => ['MCD', 'MC', 'MI', 'MD'].includes(p.slotPosition))
  const mcds      = picks.filter(p => p.slotPosition === 'MCD')
  const mcs       = picks.filter(p => p.slotPosition === 'MC')
  const keeper    = picks.find(p => p.slotPosition === 'POR')

  const serviceMult = computeServiceMult(picks)

  const attackScore = (() => {
    const scores = attackers.map(p => {
      if (p.slotPosition === 'DC') {
        const base = statOrRating(p, 'definicion', 'fisico', 'desmarque')
        return base * serviceMult
      }
      if (['EI', 'ED'].includes(p.slotPosition)) {
        return avg([
          p.stats?.velocidad ?? p.rating,
          p.stats?.regate    ?? p.rating,
          p.stats?.tirosLejanos ?? p.rating,
          (p.stats?.definicion ?? p.rating) * 0.7,
        ])
      }
      if (p.slotPosition === 'MCO') {
        return avg([
          p.stats?.vision    ?? p.rating,
          p.stats?.llegada   ?? p.rating,
          (p.stats?.tirosLejanos ?? p.rating) * 0.6,
          (p.stats?.definicion   ?? p.rating) * 0.4,
        ])
      }
      return p.rating
    })

    const lateralScores = lateral.map(p =>
      avg([p.stats?.velocidad ?? p.rating, p.stats?.regate ?? p.rating, p.stats?.centro ?? p.rating]) * 0.85
    )

    const allOffensiveScores = [...scores, ...lateralScores]
    return allOffensiveScores.length > 0 ? avg(allOffensiveScores) : avg(picks.map(p => p.rating))
  })()

  const keeperScore = keeper ? statOrRating(keeper, 'reflejos', 'manejo', 'salidas') : 70

  const defenseScoresRaw: number[] = [
    ...defenders.map(p => statOrRating(p, 'defAerea', 'intercepciones', 'duelos')),
    ...mcds.map(p => {
      let score = statOrRating(p, 'recuperacion', 'posicionamiento', 'duelos')
      const pases = p.stats?.pases ?? 72
      if (pases < 72) score *= (1 - (72 - pases) * 0.004)
      return score
    }),
    keeperScore,
  ]
  const rawDefenseScore = avg(defenseScoresRaw.length > 0 ? defenseScoresRaw : picks.map(p => p.rating))

  // Defensive mult via comunicacion
  const comPlayers = [...defenders, ...(keeper ? [keeper] : [])]
  const avgComunicacion = comPlayers.length > 0
    ? avg(comPlayers.map(p => p.stats?.comunicacion ?? 72))
    : 72
  const defensiveMult = 1 + clamp((avgComunicacion - 72) / 150, -0.04, 0.08)
  const defenseScore = rawDefenseScore * defensiveMult

  // Midfield multiplier — MC: pases+vision+regate*0.3; MCD: pases*0.6+vision*0.4
  const mcAvg  = mcs.length > 0
    ? avg(mcs.map(p => {
        const pases  = p.stats?.pases  ?? p.rating
        const vision = p.stats?.vision ?? p.rating
        const regate = p.stats?.regate ?? p.rating
        return (pases + vision + regate * 0.3) / 2.3
      }))
    : null
  const mcdAvg = mcds.length > 0
    ? avg(mcds.map(p => {
        const pases  = p.stats?.pases  ?? p.rating
        const vision = p.stats?.vision ?? p.rating
        return pases * 0.6 + vision * 0.4
      }))
    : null

  const midfieldVals = [mcAvg, mcdAvg].filter((v): v is number => v !== null)
  const midfieldAvg  = midfieldVals.length > 0 ? avg(midfieldVals) : 75
  const midfieldMult = 1 + clamp((midfieldAvg - 70) / 100, -0.05, 0.10)

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

function cpuRating(squad: Squad, phase: MatchResult['phase']): number {
  if (!squad.players.length) return 72
  const base = squad.players.reduce((s, p) => s + p.rating, 0) / squad.players.length
  const phaseBonus = ['grupo-1', 'grupo-2', 'grupo-3'].includes(phase)
    ? 0.12
    : ['octavos', 'cuartos'].includes(phase)
    ? 0.15
    : 0.18  // semis, final
  return base * (1 + phaseBonus)
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

function generateEvents(
  picks: SquadPlayer[],
  cpuSquad: Squad,
  goalsFor: number,
  goalsAgainst: number,
  rand: () => number,
  injuriesEnabled: boolean,
  serviceMult: number,
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

  const scorers   = picks.filter(p => ['DC', 'MCO', 'EI', 'ED', 'MC', 'MCD'].includes(p.slotPosition))
  const assisters = picks.filter(p =>
    ['MCO', 'MC', 'MCD', 'EI', 'ED', 'MI', 'MD', 'DC', 'LD', 'LI'].includes(p.slotPosition))
  const keepers   = picks.filter(p => p.slotPosition === 'POR')
  const defenders = picks.filter(p => ['DFC', 'LD', 'LI', 'MCD'].includes(p.slotPosition))

  const scorerWeights = scorers.map(p => {
    if (p.slotPosition === 'DC') {
      const base = (p.stats?.definicion ?? p.rating) * 1.3 + (p.stats?.cabezazo ?? p.rating) * 0.4
      return base * serviceMult
    }
    if (['EI', 'ED'].includes(p.slotPosition))
      return (p.stats?.velocidad    ?? p.rating) * 0.35
           + (p.stats?.tirosLejanos ?? p.rating) * 0.75
           + (p.stats?.regate       ?? p.rating) * 0.35
           + (p.stats?.definicion   ?? p.rating) * 0.40
    if (p.slotPosition === 'MCO')
      return (p.stats?.llegada      ?? p.rating) * 0.6
           + (p.stats?.tirosLejanos ?? p.rating) * 0.5
           + (p.stats?.definicion   ?? p.rating) * 0.35
    if (p.slotPosition === 'MC')
      return (p.stats?.llegada      ?? p.rating) * 0.5
           + (p.stats?.tirosLejanos ?? p.rating) * 0.55
           + (p.stats?.regate       ?? p.rating) * 0.2
    if (p.slotPosition === 'MCD')
      return (p.stats?.llegada      ?? p.rating * 0.5) * 0.25
           + (p.stats?.tirosLejanos ?? p.rating * 0.4) * 0.20
    return p.rating
  })

  const assisterWeights = assisters.map(p =>
    (p.stats?.vision ?? p.rating) * 0.6
    + (p.stats?.paseFiltrado ?? p.stats?.pases ?? p.rating) * 0.4
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

  // Key saves — count scales with keeper reflejos + comunicacion
  const keeperReflejos     = keepers[0]?.stats?.reflejos     ?? keepers[0]?.rating ?? 75
  const keeperComunicacion = keepers[0]?.stats?.comunicacion ?? 70
  let saveCount = goalsAgainst === 0
    ? (keeperReflejos >= 88 ? Math.floor(rand() * 2) + 2 : Math.floor(rand() * 2) + 1)
    : (goalsAgainst <= 1 && keeperReflejos >= 87 && rand() < (keeperReflejos - 82) / 20 ? 1 : 0)
  if (keeperComunicacion > 80) saveCount += 1

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
  myAttack: number,
  myDefense: number,
  rand: () => number,
): { goalsFor: number; goalsAgainst: number } {
  const ratingDiff = myRating - rivalRating
  const winProb    = 0.5 + ratingDiff * 0.006
  const clamped    = Math.max(0.1, Math.min(0.9, winProb))

  const attackBias  = clamp((myAttack  - 78) / 120, -0.15, 0.20)
  const defenseBias = clamp((myDefense - 78) / 120, -0.15, 0.20)

  const roll             = rand()
  const baseGoalsFor     = Math.floor(rand() * 4)
  const baseGoalsAgainst = Math.floor(rand() * 3)

  if (roll < clamped) {
    let gf = Math.max(1, baseGoalsFor)
    if (rand() < attackBias)  gf = Math.min(4, gf + 1)
    let ga = Math.max(0, Math.min(gf - 1, baseGoalsAgainst))
    if (rand() < defenseBias) ga = Math.max(0, ga - 1)
    return { goalsFor: gf, goalsAgainst: ga }
  } else if (roll < clamped + 0.15) {
    const g = Math.floor(rand() * 3)
    return { goalsFor: g, goalsAgainst: g }
  } else {
    let ga = Math.max(1, baseGoalsAgainst + 1)
    if (rand() < defenseBias) ga = Math.max(1, ga - 1)
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
  const zones    = computeZoneScores(picks)
  const myRating = picks.length === 0 ? 50 : ((zones.attack + zones.defense) / 2) * (1 + chemistry.total)
  const serviceMult = computeServiceMult(picks)
  const squads   = cpuSquads.length > 0 ? cpuSquads : [fallbackSquad()]

  const matches: MatchResult[]      = []
  const playerStats = new Map<string, PlayerTournamentStats>()

  for (const p of picks) {
    playerStats.set(p.id, {
      playerId:   p.id,
      playerName: p.name,
      position:   p.slotPosition,
      goals:       0,
      assists:     0,
      cleanSheets: 0,
      keySaves:    0,
      rating:      p.rating,
    })
  }

  let eliminated = false

  for (let i = 0; i < PHASES.length; i++) {
    if (eliminated) break
    const phase    = PHASES[i]
    const rival    = squads[i % squads.length]
    const rivalRat = cpuRating(rival, phase)
    const { goalsFor, goalsAgainst } = simulateMatch(myRating, rivalRat, zones.attack, zones.defense, rand)
    const won      = goalsFor > goalsAgainst
    const events   = generateEvents(picks, rival, goalsFor, goalsAgainst, rand, injuriesEnabled, serviceMult)

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

  const lastMatch = matches[matches.length - 1]
  const wonTournament = lastMatch?.won ?? false
  const finalResult: TournamentSummary['finalResult'] = wonTournament
    ? 'campeon'
    : lastMatch?.phase === 'final'   ? 'finalista'
    : lastMatch?.phase === 'semis'   ? 'semifinalista'
    : lastMatch?.phase === 'cuartos' ? 'cuartos'
    : lastMatch?.phase === 'octavos' ? 'octavos'
    : 'grupos'

  return { matches, playerStats: stats, topScorer, topAssist, bestKeeper, mvp, won: wonTournament, finalResult }
}
