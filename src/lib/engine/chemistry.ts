import type { SquadPlayer } from '@/types/player'
import type { TeamChemistry, ChemistryBonus } from '@/types/game'

const CHEMISTRY_CAP = 0.20

const BONUS_VALUES = {
  'mismo-pais-mundial': 0.08,
  'mismo-pais': 0.04,
  'confederacion': 0.015,
  'rol-complementario': 0.03,
}

const COMPLEMENTARY_PAIRS: [string, string][] = [
  ['MCD', 'MC'], ['MCD', 'DFC'], ['MC', 'MCO'], ['MCO', 'DC'],
  ['LD', 'ED'], ['LI', 'EI'], ['DFC', 'DFC'],
]

function groupKey(player: SquadPlayer) {
  return `${player.country}-${player.tournamentYear}`
}

export function calculateChemistry(
  picks: SquadPlayer[],
  applyCap: boolean
): TeamChemistry {
  if (picks.length === 0) return { total: 0, bonuses: [], capped: false }

  const bonuses: ChemistryBonus[] = []

  // Mismo país + mismo mundial
  const byGroup = new Map<string, SquadPlayer[]>()
  for (const p of picks) {
    const key = groupKey(p)
    if (!byGroup.has(key)) byGroup.set(key, [])
    byGroup.get(key)!.push(p)
  }
  for (const [key, group] of byGroup) {
    if (group.length >= 2) {
      const [country, year] = key.split('-')
      bonuses.push({
        type: 'mismo-pais-mundial',
        playerIds: group.map(p => p.id),
        bonus: BONUS_VALUES['mismo-pais-mundial'] * group.length,
        label: `${group.length} jugadores de ${country} ${year}`,
      })
    }
  }

  // Mismo país, distintos mundiales
  const byCountry = new Map<string, SquadPlayer[]>()
  for (const p of picks) {
    if (!byCountry.has(p.country)) byCountry.set(p.country, [])
    byCountry.get(p.country)!.push(p)
  }
  for (const [country, group] of byCountry) {
    const crossEra = group.filter(p => {
      const key = groupKey(p)
      const sameEraCount = byGroup.get(key)?.length ?? 0
      return sameEraCount < 2
    })
    if (crossEra.length >= 2) {
      bonuses.push({
        type: 'mismo-pais',
        playerIds: crossEra.map(p => p.id),
        bonus: BONUS_VALUES['mismo-pais'] * crossEra.length,
        label: `${crossEra.length} jugadores de ${country} (distintas eras)`,
      })
    }
  }

  // Misma confederación (distintos países)
  const byConf = new Map<string, SquadPlayer[]>()
  for (const p of picks) {
    if (!byConf.has(p.country)) {
      // We'll use country as a proxy; confederation is on Squad, not Player
      // For now, store by country and let the UI pass confederation if needed
    }
  }

  // Roles complementarios del mismo equipo
  for (const [posA, posB] of COMPLEMENTARY_PAIRS) {
    const groupAs = picks.filter(p => p.position === posA || p.slotPosition === posA)
    const groupBs = picks.filter(p => p.position === posB || p.slotPosition === posB)
    for (const a of groupAs) {
      for (const b of groupBs) {
        if (groupKey(a) === groupKey(b)) {
          bonuses.push({
            type: 'rol-complementario',
            playerIds: [a.id, b.id],
            bonus: BONUS_VALUES['rol-complementario'],
            label: `${a.name} (${posA}) + ${b.name} (${posB})`,
          })
        }
      }
    }
  }

  let total = bonuses.reduce((sum, b) => sum + b.bonus, 0)
  const capped = applyCap && total > CHEMISTRY_CAP

  if (applyCap) total = Math.min(total, CHEMISTRY_CAP)

  return { total: Math.round(total * 1000) / 1000, bonuses, capped }
}

export function applyChemistryToRating(baseRating: number, chemistry: TeamChemistry): number {
  return Math.round(baseRating * (1 + chemistry.total))
}
