export type Position =
  | 'POR'
  | 'LD'
  | 'LI'
  | 'DFC'
  | 'MCD'
  | 'MC'
  | 'MCO'
  | 'MD'   // Mediocampista Derecho (4-4-2 wide right)
  | 'MI'   // Mediocampista Izquierdo (4-4-2 wide left)
  | 'EI'
  | 'ED'
  | 'DC'

export type PositionCompatibility = 'natural' | 'puede' | 'forzado'

export type PositionZone = 'arquero' | 'defensa' | 'medio' | 'ataque'

export interface AltPosition {
  position: Position
  compatibility: PositionCompatibility
}

export interface PlayerStats {
  // POR
  reflejos?: number
  manejo?: number
  salidas?: number
  penales?: number
  distribucion?: number
  // DEF (DFC, LD, LI)
  defAerea?: number
  intercepciones?: number
  duelos?: number
  // MEDIO (MCD, MC, MCO)
  recuperacion?: number
  vision?: number
  pases?: number
  llegada?: number
  paseFiltrado?: number
  // ATAQUE (EI, ED, DC)
  velocidad?: number
  regate?: number
  centro?: number
  definicion?: number
  fisico?: number
  cabezazo?: number
  pressing?: number
  desmarque?: number
  disparo?: number
  // Compartida
  tecnica?: number
  posicionamiento?: number
  resistencia?: number
}

export interface Player {
  id: string
  name: string
  position: Position
  altPositions: AltPosition[]
  stats: PlayerStats
  rating: number
  country: string
  tournamentYear: number
  tournamentId: string
  club?: string
  goals?: number
  assists?: number
  isCaptain?: boolean
}

export interface SquadPlayer extends Player {
  slotId: string
  slotPosition: Position
  compatibility: PositionCompatibility
  chemistryBonus: number
  tournamentRating: number
  isInjured?: boolean
}
