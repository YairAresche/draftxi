import type { Position, Player, SquadPlayer } from './player'
import type { Squad } from './tournament'

export type GameMode = 'mundial'
export type SimMode = 'relato' | 'directo'
export type StatsDisplayMode = 'simple' | 'medio' | 'completo'
export type DifficultyMode = 'normal' | 'almanaque'
export type DraftMode = 'ordenado' | 'libre'
export type SquadPool = 'all' | 'top'

export interface Formation {
  id: string
  name: string
  slots: FormationSlot[]
}

export interface FormationSlot {
  id: string
  position: Position
  x: number
  y: number
}

export interface DraftRoll {
  squad: Squad
  availablePlayers: Player[]
}

export interface ChemistryBonus {
  type: 'mismo-pais-mundial' | 'mismo-pais' | 'confederacion' | 'rol-complementario'
  playerIds: string[]
  bonus: number
  label: string
}

export interface TeamChemistry {
  total: number
  bonuses: ChemistryBonus[]
  capped: boolean
}

export interface MatchEvent {
  minute: number
  type: 'gol' | 'gol-anulado' | 'atajada' | 'palo' | 'amarilla' | 'roja' | 'penal' | 'lesion'
  playerId?: string
  playerName?: string
  assistId?: string
  assistName?: string
  team: 'tuyo' | 'rival'
  description: string
}

export interface MatchResult {
  rivalSquad: Squad
  goalsFor: number
  goalsAgainst: number
  phase: 'grupo-1' | 'grupo-2' | 'grupo-3' | 'octavos' | 'cuartos' | 'semis' | 'final'
  events: MatchEvent[]
  won: boolean
  eliminated: boolean
  penalties?: boolean  // knockout draw resolved by penalties
}

export interface PlayerTournamentStats {
  playerId: string
  playerName: string
  position: Position
  goals: number
  assists: number
  cleanSheets: number
  keySaves: number
  rating: number
}

export interface TournamentSummary {
  matches: MatchResult[]
  playerStats: PlayerTournamentStats[]
  topScorer: PlayerTournamentStats | null
  topAssist: PlayerTournamentStats | null
  bestKeeper: PlayerTournamentStats | null
  mvp: PlayerTournamentStats | null
  won: boolean
  finalResult: 'campeon' | 'finalista' | 'semifinalista' | 'cuartos' | 'octavos' | 'grupos'
}

export interface SavedGame {
  id: string
  createdAt: string
  formation: Formation
  squad: SquadPlayer[]
  chemistry: TeamChemistry
  summary: TournamentSummary
  statsMode: StatsDisplayMode
  difficultyMode: DifficultyMode
  injuriesEnabled: boolean
}

export interface GameState {
  mode: GameMode
  phase: 'config' | 'draft' | 'transferencias' | 'simulacion' | 'resultado'
  formation: Formation | null
  statsMode: StatsDisplayMode
  difficultyMode: DifficultyMode
  simMode: SimMode
  injuriesEnabled: boolean
  chemistryCap: boolean
  draftMode: DraftMode

  squadPool: SquadPool
  yearFrom: number
  yearTo: number

  picks: SquadPlayer[]
  captainId: string | null
  rerollsLeft: number
  currentRoll: DraftRoll | null
  rollIndex: number

  chemistry: TeamChemistry | null
  summary: TournamentSummary | null
}
