import type { Squad } from '@/types/tournament'

const BASE = '/data/tournaments/world-cup'

export interface SquadRef {
  tournamentId: string
  year: number
  slug: string
  country: string
  confederation: string
  countryCode: string
}

let catalogPromise: Promise<SquadRef[]> | null = null
const squadCache = new Map<string, Squad>()

export async function loadSquadCatalog(): Promise<SquadRef[]> {
  if (!catalogPromise) {
    catalogPromise = fetch(`${BASE}/catalog.json`)
      .then(r => r.json() as Promise<{ squads: SquadRef[] }>)
      .then(d => d.squads)
  }
  return catalogPromise
}

export async function loadSquadBySlug(year: number, slug: string): Promise<Squad | null> {
  const key = `${year}-${slug}`
  if (squadCache.has(key)) return squadCache.get(key)!
  try {
    const res = await fetch(`${BASE}/${key}.json`)
    if (!res.ok) return null
    const data: Squad = await res.json()
    squadCache.set(key, data)
    return data
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
