import type { Squad } from '@/types/tournament'
import type { Position, AltPosition } from '@/types/player'

const BASE = '/data/tournaments/world-cup'

export interface SquadRef {
  tournamentId: string
  year: number
  slug: string
  country: string
  confederation: string
  countryCode: string
}

type PlayerOverride = {
  rating: number
  stats: Record<string, number>
  position?: Position
  altPositions?: AltPosition[]
}
type OverridesMap = Record<string, PlayerOverride>

let catalogPromise: Promise<SquadRef[]> | null = null
let overridesPromise: Promise<OverridesMap> | null = null
const squadCache = new Map<string, Squad>()

export async function loadSquadCatalog(): Promise<SquadRef[]> {
  if (!catalogPromise) {
    catalogPromise = fetch(`${BASE}/catalog.json`)
      .then(r => r.json() as Promise<{ squads: SquadRef[] }>)
      .then(d => d.squads)
  }
  return catalogPromise
}

function loadOverrides(): Promise<OverridesMap> {
  if (!overridesPromise) {
    overridesPromise = fetch('/data/overrides.json')
      .then(r => r.ok ? r.json() as Promise<OverridesMap> : {})
      .catch(() => ({}))
  }
  return overridesPromise
}

export async function loadSquadBySlug(year: number, slug: string): Promise<Squad | null> {
  const key = `${year}-${slug}`
  if (squadCache.has(key)) return squadCache.get(key)!
  try {
    const [data, overrides]: [Squad, OverridesMap] = await Promise.all([
      fetch(`${BASE}/${key}.json`).then(r => { if (!r.ok) throw new Error(); return r.json() }),
      loadOverrides(),
    ])
    const patched: Squad = {
      ...data,
      players: data.players.map(p => {
        const ov = overrides[p.id]
        if (!ov) return p
        return {
          ...p,
          rating: ov.rating,
          stats: ov.stats,
          ...(ov.position    ? { position: ov.position }       : {}),
          ...(ov.altPositions ? { altPositions: ov.altPositions } : {}),
        }
      }),
    }
    squadCache.set(key, patched)
    return patched
  } catch {
    return null
  }
}

export function pickRandomRefs(refs: SquadRef[], count: number, seed: number): SquadRef[] {
  const arr = [...refs]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.abs((seed * (i + 1)) % (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, count)
}
