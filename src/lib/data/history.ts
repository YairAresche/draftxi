import type { SavedGame } from '@/types/game'

const STORAGE_KEY = 'draftxi_history'
const MAX_GAMES = 20

export function saveGame(game: SavedGame): void {
  try {
    const existing = loadHistory()
    const updated = [game, ...existing].slice(0, MAX_GAMES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // localStorage puede estar deshabilitado
  }
}

export function loadHistory(): SavedGame[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SavedGame[]
  } catch {
    return []
  }
}

export function getGame(id: string): SavedGame | null {
  const history = loadHistory()
  return history.find(g => g.id === id) ?? null
}

export function generateGameId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
