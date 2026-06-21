import type { Position, PositionCompatibility } from '@/types/player'

export const POSITION_LABELS: Record<Position, string> = {
  POR: 'POR', LD: 'LD', LI: 'LI', DFC: 'DFC',
  MCD: 'MCD', MC: 'MC', MCO: 'MCO', MD: 'MD', MI: 'MI',
  EI: 'EI', ED: 'ED', DC: 'DC',
}

export const POSITION_ZONE: Record<Position, string> = {
  POR: 'Portero', LD: 'Defensa', LI: 'Defensa', DFC: 'Defensa',
  MCD: 'Mediocampo', MC: 'Mediocampo', MCO: 'Mediocampo', MD: 'Mediocampo', MI: 'Mediocampo',
  EI: 'Ataque', ED: 'Ataque', DC: 'Ataque',
}

export const COMPATIBILITY_COLORS: Record<PositionCompatibility, string> = {
  natural: 'text-emerald-400 border-emerald-400',
  puede: 'text-yellow-400 border-yellow-400',
  forzado: 'text-red-400 border-red-400',
}

export const COMPATIBILITY_BG: Record<PositionCompatibility, string> = {
  natural: 'bg-emerald-500/20',
  puede: 'bg-yellow-500/20',
  forzado: 'bg-red-500/20',
}

export const COMPATIBILITY_EMOJI: Record<PositionCompatibility, string> = {
  natural: '🟢',
  puede: '🟡',
  forzado: '🔴',
}

// Cross-position defaults: aplican cuando el jugador no tiene la posición explícita en altPositions
const CROSS_COMPAT: Partial<Record<Position, Partial<Record<Position, PositionCompatibility>>>> = {
  ED:  { MD: 'puede', EI: 'puede' },
  EI:  { MI: 'puede', ED: 'puede' },
  MD:  { ED: 'puede' },
  MI:  { EI: 'puede' },
  MCO: { MC: 'puede' },
  MC:  { MCO: 'puede', MCD: 'puede' },
  MCD: { MC: 'puede' },
}

export function getCompatibility(
  playerPosition: Position,
  altPositions: { position: Position; compatibility: PositionCompatibility }[],
  slotPosition: Position
): PositionCompatibility {
  if (playerPosition === slotPosition) return 'natural'
  const alt = altPositions.find(a => a.position === slotPosition)
  if (alt) return alt.compatibility
  const cross = CROSS_COMPAT[playerPosition]?.[slotPosition]
  if (cross) return cross
  return 'forzado'
}

export function compatibilityMultiplier(c: PositionCompatibility): number {
  return c === 'natural' ? 1 : c === 'puede' ? 0.95 : 0.65
}

export const CONFEDERATION_COLORS: Record<string, string> = {
  CONMEBOL: 'bg-blue-600',
  UEFA: 'bg-amber-600',
  CONCACAF: 'bg-emerald-600',
  CAF: 'bg-red-600',
  AFC: 'bg-purple-600',
  OFC: 'bg-teal-600',
}
