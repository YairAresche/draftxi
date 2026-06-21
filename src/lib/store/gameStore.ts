import { create } from 'zustand'
import type { GameState, DraftRoll, Formation, SimMode, StatsDisplayMode, DifficultyMode, TeamChemistry, TournamentSummary, SquadPool } from '@/types/game'
import type { SquadPlayer } from '@/types/player'

interface GameActions {
  addPick: (player: SquadPlayer) => void
  startGame: (formation: Formation, opts: {
    statsMode: StatsDisplayMode
    difficultyMode: DifficultyMode
    simMode: SimMode
    injuriesEnabled: boolean
    chemistryCap: boolean
    draftMode: 'ordenado' | 'libre'
    squadPool: SquadPool
    yearFrom: number
    yearTo: number
  }) => void
  setRoll: (roll: DraftRoll) => void
  pickPlayer: (player: SquadPlayer) => void
  unplacePick: (slotId: string) => void
  spendReroll: (roll: DraftRoll) => void
  setCaptain: (playerId: string | null) => void
  setChemistry: (chemistry: TeamChemistry) => void
  setSummary: (summary: TournamentSummary) => void
  setPhase: (phase: GameState['phase']) => void
  reset: () => void
}

const INITIAL_STATE: GameState = {
  mode: 'mundial',
  phase: 'config',
  formation: null,
  statsMode: 'medio',
  difficultyMode: 'normal',
  simMode: 'relato',
  injuriesEnabled: false,
  chemistryCap: true,
  draftMode: 'ordenado',
  squadPool: 'all',
  yearFrom: 1930,
  yearTo: 2022,
  picks: [],
  captainId: null,
  rerollsLeft: 3,
  currentRoll: null,
  rollIndex: 0,
  chemistry: null,
  summary: null,
}

export const useGameStore = create<GameState & GameActions>((set) => ({
  ...INITIAL_STATE,

  startGame: (formation, opts) =>
    set({
      ...INITIAL_STATE,
      phase: 'draft',
      formation,
      ...opts,
    }),

  addPick: (player) =>
    set((state) => ({
      picks: [...state.picks, player],
    })),

  setRoll: (roll) => set({ currentRoll: roll }),

  pickPlayer: (player) =>
    set((state) => ({
      picks: [...state.picks, player],
      currentRoll: null,
      rollIndex: state.rollIndex + 1,
    })),

  unplacePick: (slotId) =>
    set((state) => ({
      picks: state.picks.filter(p => p.slotId !== slotId),
    })),

  spendReroll: (roll) =>
    set((state) => ({
      rerollsLeft: state.rerollsLeft - 1,
      currentRoll: roll,
    })),

  setCaptain: (playerId) => set({ captainId: playerId }),

  setChemistry: (chemistry) => set({ chemistry }),

  setSummary: (summary) => set({ summary }),

  setPhase: (phase) => set({ phase }),

  reset: () => set(INITIAL_STATE),
}))
