import type { Player } from './player'

export type TournamentType = 'world-cup'

export interface Squad {
  country: string
  countryCode: string
  confederation: Confederation
  year: number
  tournamentId: string
  players: Player[]
}

export type Confederation = 'CONMEBOL' | 'UEFA' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC'

export interface TournamentMeta {
  id: string
  type: TournamentType
  year: number
  host: string
  winner: string
  squads: string[]
}

export interface TournamentIndex {
  tournaments: TournamentMeta[]
}
