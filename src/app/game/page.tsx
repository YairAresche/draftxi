'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/store/gameStore'
import { loadSquadCatalog, loadSquadBySlug, type SquadRef } from '@/lib/data/loader'
import { calculateChemistry } from '@/lib/engine/chemistry'
import { getCompatibility, compatibilityMultiplier, COMPATIBILITY_EMOJI } from '@/lib/utils/positions'
import type { Squad } from '@/types/tournament'
import type { Player, SquadPlayer, Position } from '@/types/player'
import type { FormationSlot, Formation, TeamChemistry } from '@/types/game'

/* ─── Constants ────────────────────────────────────── */
type SortKey = 'rating' | 'position' | 'name'

const POS_ORDER: Record<string, number> = {
  POR: 0, LD: 1, LI: 2, DFC: 3, MCD: 4, MC: 5, MCO: 6, MD: 7, MI: 8, EI: 9, ED: 10, DC: 11,
}

// Palette — matches CSS variables in globals.css
const C = {
  green: '#7ee787',
  amber: '#e3b341',
  blue:  '#79c0ff',
  red:   '#f47067',
  gold:  '#d4a72c',
  muted: '#7d8590',
  dim:   '#3d444d',
  text:  '#e6edf3',
  border:'#30363d',
  bg:    '#0d1117',
  surf:  '#161b22',
}

const TOP_NATION_SLUGS = new Set([
  'argentina', 'brazil', 'west-germany', 'germany',
  'italy', 'france', 'spain', 'netherlands',
  'england', 'portugal', 'uruguay', 'croatia', 'belgium',
])

function isPlayerUnplaceable(player: Player, formation: Formation | null, picks: SquadPlayer[]): boolean {
  if (!formation) return false
  const filledSlots = new Set(picks.map(p => p.slotId))
  return !formation.slots.some(slot => {
    if (filledSlots.has(slot.id)) return false
    return getCompatibility(player.position, player.altPositions, slot.position) !== 'forzado'
  })
}

export function leadership(player: Player): number {
  return Math.min(99, Math.round(
    player.rating * 0.75 +
    (player.isCaptain ? 14 : 0) +
    (player.goals ?? 0) * 1.5 +
    (player.assists ?? 0) * 0.8,
  ))
}

/* ─── Page ──────────────────────────────────────────── */
export default function GamePage() {
  const router = useRouter()
  const {
    phase, formation, picks, captainId, rerollsLeft, currentRoll,
    statsMode, difficultyMode, chemistryCap, draftMode,
    squadPool, yearFrom, yearTo,
    setRoll, pickPlayer, addPick, unplacePick, spendReroll, setCaptain, setChemistry, setPhase,
  } = useGameStore()

  const [squadCatalog, setSquadCatalog] = useState<SquadRef[]>([])
  const [loading, setLoading]       = useState(true)
  const [rolling, setRolling]       = useState(false)
  const [pendingPlayer, setPendingPlayer] = useState<Player | null>(null)
  const [movingPick, setMovingPick] = useState<SquadPlayer | null>(null)
  const [mousePos, setMousePos]     = useState({ x: -999, y: -999 })
  const [sortKey, setSortKey]       = useState<SortKey>('rating')
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('desc')
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const [hoveredPlayer, setHoveredPlayer] = useState<Player | null>(null)

  useEffect(() => {
    if (phase === 'config') { router.replace('/'); return }
    if (phase !== 'draft') return
    loadSquadCatalog().then(catalog => { setSquadCatalog(catalog); setLoading(false) })
  }, [phase, router])

  useEffect(() => {
    const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useEffect(() => {
    if (!movingPick) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { addPick(movingPick); setMovingPick(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [movingPick, addPick])

  const filteredCatalog = useMemo(() => {
    let c = squadCatalog
    if (yearFrom > 1930) c = c.filter(r => r.year >= yearFrom)
    if (yearTo < 2022)   c = c.filter(r => r.year <= yearTo)
    if (squadPool === 'top') c = c.filter(r => TOP_NATION_SLUGS.has(r.slug))
    return c.length > 0 ? c : squadCatalog
  }, [squadCatalog, squadPool, yearFrom, yearTo])

  const isDone = picks.length === (formation?.slots.length ?? 0)

  const doRoll = useCallback(async () => {
    if (filteredCatalog.length === 0 || rolling) return
    setRolling(true)
    const ref = filteredCatalog[Math.floor(Math.random() * filteredCatalog.length)]
    await new Promise<void>(resolve => setTimeout(resolve, 400))
    const squad = await loadSquadBySlug(ref.year, ref.slug)
    if (squad) setRoll({ squad, availablePlayers: squad.players })
    setRolling(false)
  }, [filteredCatalog, rolling, setRoll])

  useEffect(() => {
    if (!loading && !currentRoll && !rolling && !isDone) doRoll()
  }, [loading, currentRoll, rolling, doRoll, isDone])

  useEffect(() => {
    setChemistry(calculateChemistry(picks, chemistryCap))
  }, [picks, chemistryCap, setChemistry])

  /* ── Rerolls ── */
  async function rerollSameYear() {
    if (!currentRoll || rerollsLeft === 0 || rolling) return
    const { year, country } = currentRoll.squad
    const exact = filteredCatalog.filter(r => r.year === year && r.country !== country)
    const near  = exact.length ? exact : filteredCatalog.filter(r => Math.abs(r.year - year) <= 6 && r.country !== country)
    const any   = near.length  ? near  : filteredCatalog.filter(r => r.country !== country)
    const pool  = any.length   ? any   : filteredCatalog.filter(r => r.year !== year || r.country !== country)
    if (!pool.length) return
    const ref = pool[Math.floor(Math.random() * pool.length)]
    setRolling(true)
    const squad = await loadSquadBySlug(ref.year, ref.slug)
    if (squad) spendReroll({ squad, availablePlayers: squad.players })
    setRolling(false)
  }

  async function rerollSameCountry() {
    if (!currentRoll || rerollsLeft === 0 || rolling) return
    const { year, country } = currentRoll.squad
    const exact = filteredCatalog.filter(r => r.country === country && r.year !== year)
    const any   = exact.length ? exact : filteredCatalog.filter(r => r.year !== year || r.country !== country)
    if (!any.length) return
    const ref = any[Math.floor(Math.random() * any.length)]
    setRolling(true)
    const squad = await loadSquadBySlug(ref.year, ref.slug)
    if (squad) spendReroll({ squad, availablePlayers: squad.players })
    setRolling(false)
  }

  const hasOtherSquads = currentRoll
    ? filteredCatalog.some(r => r.year !== currentRoll.squad.year || r.country !== currentRoll.squad.country)
    : false
  const canSameYear    = hasOtherSquads
  const canSameCountry = hasOtherSquads

  /* ── Pick helpers ── */
  function commitPick(player: Player, slot: FormationSlot) {
    const compat = getCompatibility(player.position, player.altPositions, slot.position)
    pickPlayer({
      ...player,
      slotId: slot.id,
      slotPosition: slot.position,
      compatibility: compat,
      chemistryBonus: 0,
      tournamentRating: Math.round(player.rating * compatibilityMultiplier(compat)),
    })
    setPendingPlayer(null)
  }

  function handleSortClick(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'rating' ? 'desc' : 'asc') }
  }

  // Names of already-picked players (normalized) — same person can't be picked twice
  const pickedNames = useMemo(
    () => new Set(picks.map(p => p.name.toLowerCase().trim())),
    [picks],
  )

  function handlePlayerClick(player: Player) {
    if (pickedNames.has(player.name.toLowerCase().trim())) return
    if (isPlayerUnplaceable(player, formation ?? null, picks)) return
    setMovingPick(null)
    if (draftMode === 'ordenado') {
      const slot = formation?.slots.find(s => !picks.some(p => p.slotId === s.id))
      if (slot) commitPick(player, slot)
    } else {
      setPendingPlayer(p => p?.id === player.id ? null : player)
    }
  }

  const chemistry = calculateChemistry(picks, chemistryCap)
  const nextSlot  = draftMode === 'ordenado'
    ? (formation?.slots.find(s => !picks.some(p => p.slotId === s.id)) ?? null)
    : null

  const sortedPlayers = useMemo(() => {
    if (!currentRoll) return []
    return [...currentRoll.availablePlayers].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'rating')   cmp = a.rating - b.rating
      else if (sortKey === 'name')     cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'position') cmp = (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9)
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [currentRoll, sortKey, sortDir])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg }} className="flex items-center justify-center">
        <p style={{ color: C.muted }} className="animate-pulse text-sm">Cargando...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, cursor: movingPick ? 'grabbing' : undefined }} className="flex items-center justify-center">
    <div style={{
        borderColor: C.border,
        boxShadow: '0 0 0 1px #30363d, 0 24px 64px rgba(0,0,0,0.7)',
      }} className="w-full max-w-215 flex border rounded-xl overflow-hidden h-140">

      {/* ── LEFT: Campo ── */}
      <div style={{ borderColor: C.border }} className="w-85 shrink-0 flex flex-col border-r">

        {/* Top bar */}
        <div style={{ borderColor: C.border }} className="flex items-center justify-between px-3 py-2 border-b shrink-0">
          <button
            onClick={() => router.push('/')}
            style={{ color: C.muted }}
            className="text-xs transition-colors hover:text-white cursor-pointer"
          >
            ← salir
          </button>
          <span style={{ color: C.muted }} className="text-xs tabular-nums">
            {picks.length}/{formation?.slots.length}
            <span style={{ color: C.dim }} className="mx-2">·</span>
            rerolls: <span style={{ color: rerollsLeft === 0 ? C.red : C.text }}>{rerollsLeft}</span>
          </span>
          {chemistry.total > 0
            ? <span style={{ color: C.green }} className="text-xs font-semibold">+{Math.round(chemistry.total * 100)}%</span>
            : <span className="w-12" />
          }
        </div>

        {/* Field */}
        <div className="relative field-bg overflow-hidden flex-1" style={{ borderRadius: '0 0 0 0' }}>
          <FieldMarkings />
          <ChemistryLines picks={picks} formation={formation} />
          {formation?.slots.map((slot, i) => {
            const pick = picks.find(p => p.slotId === slot.id) ?? null
            const isNext = draftMode === 'ordenado' && pick === null
              && formation.slots.slice(0, i).every(s => picks.some(p => p.slotId === s.id))
            // forzado = prohibido: solo pueden colocar en posiciones compatibles
            const pendingCanPlay = pendingPlayer
              ? getCompatibility(pendingPlayer.position, pendingPlayer.altPositions, slot.position) !== 'forzado'
              : false
            const movingCanPlay = movingPick
              ? getCompatibility(movingPick.position, movingPick.altPositions, slot.position) !== 'forzado'
              : false
            // For swap: also check displaced player can go back to the moving pick's origin slot
            const movingOrigSlot = movingPick ? formation.slots.find(s => s.id === movingPick.slotId) : null
            const displacedCanGoToOrigin = pick && movingOrigSlot
              ? getCompatibility(pick.position, pick.altPositions, movingOrigSlot.position) !== 'forzado'
              : false
            const isPendingTarget = pendingPlayer !== null && pick === null && pendingCanPlay
            const isSwapTarget    = pick !== null && movingPick !== null && movingCanPlay && displacedCanGoToOrigin
            const isMovingTarget  = movingPick !== null && pick === null && movingCanPlay

            function handleSlotClick() {
              if (movingPick) {
                if (!movingCanPlay) return
                if (pick) {
                  // Swap only allowed if displaced player can also play in the origin slot
                  if (!movingOrigSlot || !displacedCanGoToOrigin) return
                  const displaced = pick
                  unplacePick(slot.id)
                  const compatA = getCompatibility(movingPick.position, movingPick.altPositions, slot.position)
                  addPick({ ...movingPick, slotId: slot.id, slotPosition: slot.position, compatibility: compatA,
                    tournamentRating: Math.round(movingPick.rating * compatibilityMultiplier(compatA)) })
                  const compatB = getCompatibility(displaced.position, displaced.altPositions, movingOrigSlot.position)
                  addPick({ ...displaced, slotId: movingOrigSlot.id, slotPosition: movingOrigSlot.position, compatibility: compatB,
                    tournamentRating: Math.round(displaced.rating * compatibilityMultiplier(compatB)) })
                } else {
                  const compat = getCompatibility(movingPick.position, movingPick.altPositions, slot.position)
                  addPick({ ...movingPick, slotId: slot.id, slotPosition: slot.position, compatibility: compat,
                    tournamentRating: Math.round(movingPick.rating * compatibilityMultiplier(compat)) })
                }
                setMovingPick(null)
              } else if (pendingPlayer && !pick && pendingCanPlay) {
                commitPick(pendingPlayer, slot)
              } else if (!pendingPlayer && !movingPick && pick) {
                unplacePick(slot.id)
                setMovingPick(pick)
                setPendingPlayer(null)
              }
            }

            return (
              <SlotDot
                key={slot.id}
                slot={slot}
                player={pick}
                isCaptain={captainId === pick?.id}
                isNext={isNext}
                isPendingTarget={isPendingTarget}
                isSwapTarget={isSwapTarget}
                isMovingTarget={isMovingTarget}
                movingPick={movingPick}
                pendingPlayer={pendingPlayer}
                difficultyMode={difficultyMode}
                onSlotClick={handleSlotClick}
              />
            )
          })}
        </div>

        {/* Bottom */}
        {isDone ? (
          <CaptainAndSimPanel
            picks={picks}
            captainId={captainId}
            chemistry={chemistry}
            onSetCaptain={setCaptain}
            onSimulate={() => { setPhase('simulacion'); router.push('/result') }}
          />
        ) : null}
      </div>

      {/* ── RIGHT: Draft panel ── */}
      <div ref={rightPanelRef} style={{ background: C.surf }} className="flex-1 flex flex-col min-w-0">

        {/* Roll header */}
        <div style={{ borderColor: C.border }} className="px-4 py-3 border-b shrink-0">
          <AnimatePresence mode="wait">
            {rolling ? (
              <motion.div key="rolling" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-14 flex items-center">
                <p style={{ color: C.muted }} className="text-sm animate-pulse">Sorteando...</p>
              </motion.div>
            ) : movingPick ? (
              <motion.div key={`moving-${movingPick.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-start justify-between gap-2">
                <div>
                  <p style={{ color: C.blue }} className="text-[10px] uppercase tracking-widest font-semibold mb-0.5">Mover a slot</p>
                  <p style={{ color: C.text }} className="text-xl font-black leading-tight">{movingPick.name}</p>
                  <p style={{ color: C.muted }} className="text-xs mt-0.5">{movingPick.position} · {movingPick.country} {movingPick.tournamentYear}</p>
                </div>
                <button onClick={() => { addPick(movingPick); setMovingPick(null) }}
                  style={{ color: C.muted }} className="text-[10px] hover:text-white mt-1 shrink-0 cursor-pointer">✕</button>
              </motion.div>
            ) : pendingPlayer ? (
              <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-start justify-between gap-2">
                <div>
                  <p style={{ color: C.amber }} className="text-[10px] uppercase tracking-widest font-semibold mb-0.5">Elegí el slot</p>
                  <p style={{ color: C.text }} className="text-xl font-black leading-tight">{pendingPlayer.name}</p>
                  <p style={{ color: C.muted }} className="text-xs mt-0.5">{pendingPlayer.position} · {pendingPlayer.country} {pendingPlayer.tournamentYear}</p>
                </div>
                <button onClick={() => setPendingPlayer(null)}
                  style={{ color: C.muted }} className="text-[10px] hover:text-white mt-1 shrink-0 cursor-pointer">✕</button>
              </motion.div>
            ) : currentRoll ? (
              <motion.div key={currentRoll.squad.tournamentId + currentRoll.squad.countryCode}
                initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-start justify-between gap-2">
                <div>
                  <p style={{ color: C.muted }} className="text-[10px] uppercase tracking-widest font-semibold mb-0.5">Selección</p>
                  <p style={{ color: C.text }} className="text-2xl font-black leading-none">{currentRoll.squad.country}</p>
                  <p style={{ color: C.muted }} className="text-sm mt-0.5">
                    {currentRoll.squad.year}
                    <span style={{ color: C.dim }} className="ml-2">{currentRoll.squad.players.length} jugadores</span>
                  </p>
                </div>
                {nextSlot && (
                  <div className="text-right shrink-0">
                    <p style={{ color: C.dim }} className="text-[10px] uppercase tracking-widest mb-0.5">Slot</p>
                    <p style={{ color: C.blue }} className="text-2xl font-black">{nextSlot.position}</p>
                  </div>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Sort header — column-aligned */}
        {!isDone && currentRoll && (
          <div style={{ borderColor: C.border, background: C.bg + 'cc' }}
            className="flex items-center gap-2 pl-2 pr-3 border-b shrink-0 h-7">
            <span className="w-5 shrink-0" />
            <span className="w-5 shrink-0" />
            {(['name', 'position'] as SortKey[]).map((key, ki) => (
              <button key={key} onClick={() => handleSortClick(key)}
                style={{ color: sortKey === key ? C.text : C.dim }}
                className={`text-[10px] font-semibold uppercase tracking-wide transition-colors hover:text-white cursor-pointer ${ki === 0 ? 'flex-1 text-left' : 'w-16 text-center'}`}>
                {key === 'name' ? 'Nombre' : 'Pos'}
                {sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            ))}
            {difficultyMode !== 'almanaque' && (
              <button onClick={() => handleSortClick('rating')}
                style={{ color: sortKey === 'rating' ? C.text : C.dim }}
                className="w-8 text-right text-[10px] font-semibold uppercase tracking-wide transition-colors hover:text-white cursor-pointer">
                OVR{sortKey === 'rating' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            )}
          </div>
        )}

        {/* Player list */}
        {!isDone && (
          <div className="flex-1 overflow-y-auto min-h-0">
            {sortedPlayers.map((player, idx) => {
              const isAlreadyPicked = pickedNames.has(player.name.toLowerCase().trim())
              const isUnplaceable = !isAlreadyPicked && isPlayerUnplaceable(player, formation ?? null, picks)
              return (
                <PlayerRow
                  key={player.id}
                  index={idx + 1}
                  player={player}
                  slotPosition={nextSlot?.position}
                  difficultyMode={difficultyMode}
                  isPending={pendingPlayer?.id === player.id}
                  isAlreadyPicked={isAlreadyPicked}
                  isUnplaceable={isUnplaceable}
                  onClick={() => handlePlayerClick(player)}
                  onHover={(p) => setHoveredPlayer(p)}
                  onHoverEnd={() => setHoveredPlayer(null)}
                />
              )
            })}
          </div>
        )}

        {/* Reroll buttons */}
        {!isDone && currentRoll && (
          <div style={{ borderColor: C.border, background: C.bg }} className="px-3 py-2.5 border-t shrink-0 flex gap-2">
            <button
              onClick={rerollSameYear}
              disabled={rerollsLeft === 0 || !canSameYear}
              style={{ borderColor: C.border, color: C.muted }}
              className="flex-1 py-1.5 border rounded text-xs hover:border-gray-500 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
            >
              Otra selección · {currentRoll.squad.year}
            </button>
            <button
              onClick={rerollSameCountry}
              disabled={rerollsLeft === 0 || !canSameCountry}
              style={{ borderColor: C.border, color: C.muted }}
              className="flex-1 py-1.5 border rounded text-xs hover:border-gray-500 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
            >
              {currentRoll.squad.country} · otro año
            </button>
            <span style={{ color: C.dim }} className="text-[10px] self-center shrink-0">({rerollsLeft})</span>
          </div>
        )}
      </div>
    </div>

    {/* Ghost: sigue al cursor mientras se reposiciona un jugador */}
    {movingPick && (
      <div
        className="fixed pointer-events-none z-50"
        style={{ left: mousePos.x, top: mousePos.y, transform: 'translate(-50%, calc(-100% - 14px))' }}
      >
        <div style={{
          background: C.surf,
          border: `1px solid ${C.blue}`,
          borderRadius: 7,
          padding: '6px 10px',
          boxShadow: `0 6px 24px rgba(0,0,0,0.75), 0 0 0 1px ${C.blue}25`,
          whiteSpace: 'nowrap',
          minWidth: 120,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>
              {movingPick.name.split(' ').at(-1)}
            </span>
            <span style={{ color: listRatingColor(movingPick.rating), fontSize: 13, fontWeight: 900 }}>
              {movingPick.rating}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{
              background: `${C.green}25`, color: C.green,
              fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
              border: `1px solid ${C.green}50`,
            }}>{movingPick.position}</span>
            {movingPick.altPositions.filter(a => a.compatibility !== 'forzado').map(a => (
              <span key={a.position} style={{
                background: `${a.compatibility === 'natural' ? C.green : C.amber}20`,
                color: a.compatibility === 'natural' ? C.green : C.amber,
                fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                border: `1px solid ${a.compatibility === 'natural' ? C.green : C.amber}40`,
              }}>{a.position}</span>
            ))}
          </div>
        </div>
        {/* triángulo apuntando hacia abajo (hacia el cursor) */}
        <div style={{
          width: 0, height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `5px solid ${C.blue}`,
          margin: '0 auto',
        }} />
      </div>
    )}
    {/* Hover card con stats del jugador */}
    {hoveredPlayer && !movingPick && (
      <PlayerStatCard
        player={hoveredPlayer}
        statsMode={statsMode}
        mousePos={mousePos}
      />
    )}
    </div>
  )
}

/* ─── Captain + Simulate panel ───────────────────── */
function CaptainAndSimPanel({ picks, captainId, chemistry, onSetCaptain, onSimulate }: {
  picks: SquadPlayer[]
  captainId: string | null
  chemistry: { total: number; bonuses: { label: string }[] }
  onSetCaptain: (id: string | null) => void
  onSimulate: () => void
}) {
  const captain = picks.find(p => p.id === captainId)
  const captainBoost = captain ? Math.round((leadership(captain) / 99) * 7) : 0

  return (
    <div style={{ borderColor: C.border }} className="px-3 py-3 border-t shrink-0 space-y-3">
      <div>
        <p style={{ color: C.dim }} className="text-[10px] uppercase tracking-widest mb-1.5">
          Capitán{captainId && <span style={{ color: C.amber }} className="normal-case tracking-normal ml-1">+{captainBoost}% liderazgo</span>}
        </p>
        <div className="flex flex-wrap gap-1">
          {picks.map(p => (
            <button
              key={p.id}
              onClick={() => onSetCaptain(captainId === p.id ? null : p.id)}
              title={p.name}
              style={captainId === p.id
                ? { background: C.amber, color: '#0d1117' }
                : { background: C.surf, color: C.muted, borderColor: C.border }}
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all hover:opacity-80 cursor-pointer border"
            >
              {p.name.split(' ').at(-1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span style={{ color: C.muted }}>
          Prom <span style={{ color: C.text }} className="font-bold">
            {Math.round(picks.reduce((s, p) => s + p.tournamentRating, 0) / picks.length)}
          </span>
        </span>
        {chemistry.total > 0 && (
          <span style={{ color: C.green }} className="font-semibold">⚗ +{Math.round(chemistry.total * 100)}%</span>
        )}
        {captainId && <span style={{ color: C.amber }} className="font-semibold">© +{captainBoost}%</span>}
      </div>

      <button
        onClick={onSimulate}
        disabled={!captainId}
        style={captainId
          ? { background: '#238636', color: '#fff' }
          : { background: C.border, color: C.dim }}
        className="w-full py-2 font-bold text-sm rounded-lg transition-colors hover:opacity-90 disabled:cursor-not-allowed cursor-pointer"
      >
        {captainId ? 'Simular torneo →' : 'Elegí un capitán primero'}
      </button>
    </div>
  )
}

/* ─── Chemistry lines SVG overlay ───────────────── */

// Grafo de adyacencia posicional: solo se dibujan líneas entre posiciones vecinas en el campo.
// Las entradas deben estar en orden alfabético (a < b) para que el lookup con .sort().join(':') funcione.
const ADJACENT_PAIRS = new Set<string>([
  // POR con defensas
  'DFC:POR', 'LD:POR', 'LI:POR',
  // Línea defensiva
  'DFC:DFC', 'DFC:LD', 'DFC:LI',
  // Lateral a mediocampista defensivo / volante por banda
  'LD:MCD', 'LD:MD', 'LI:MCD', 'LI:MI',
  // MCD
  'DFC:MCD', 'MC:MCD', 'MCD:MCD',
  // Mediocampo central
  'MC:MC', 'MC:MCO',
  // Volantes por banda a mediocampo central y laterales
  'MC:MD', 'MC:MI', 'MD:MD', 'MI:MI',
  // Extremos y sus vecinos directos
  'DC:ED', 'DC:EI',               // delantero con extremos
  'ED:LD', 'EI:LI',               // extremo con lateral de su banda
  'ED:MCO', 'EI:MCO',             // extremo con media punta
  'DC:MCO',                        // delantero con media punta
  'DC:DC',                         // dos delanteros
  // Volante por banda con extremo (4-4-2)
  'ED:MD', 'EI:MI',
])

const BOND_PRIORITY: Record<string, number> = {
  'mismo-pais-mundial': 3,
  'mismo-pais': 2,
  'confederacion': 1,
}
const BOND_COLOR: Record<string, string> = {
  'mismo-pais-mundial': '#7ee787',
  'mismo-pais': '#e3b341',
  'confederacion': '#8b9299',
}

function ChemistryLines({ picks, formation }: {
  picks: SquadPlayer[]
  formation: Formation | null
}) {
  if (!formation || picks.length < 2) return null

  // playerId → coordenadas del slot + slotPosition
  const playerData = new Map<string, { x: number; y: number; slotPos: string }>()
  for (const pick of picks) {
    const slot = formation.slots.find(s => s.id === pick.slotId)
    if (slot) playerData.set(pick.id, { x: slot.x, y: slot.y, slotPos: pick.slotPosition })
  }

  // Comparar todos los pares de picks directamente — independiente de chemistry.bonuses
  const lines: { x1: number; y1: number; x2: number; y2: number; color: string }[] = []
  for (let i = 0; i < picks.length; i++) {
    for (let j = i + 1; j < picks.length; j++) {
      const a = playerData.get(picks[i].id)
      const b = playerData.get(picks[j].id)
      if (!a || !b) continue

      // Solo posiciones adyacentes
      const adjKey = [a.slotPos, b.slotPos].sort().join(':')
      if (!ADJACENT_PAIRS.has(adjKey)) continue

      // Determinar tipo de vínculo
      let bondType: string | null = null
      if (picks[i].country === picks[j].country) {
        bondType = picks[i].tournamentYear === picks[j].tournamentYear
          ? 'mismo-pais-mundial'
          : 'mismo-pais'
      }
      if (!bondType) continue

      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: BOND_COLOR[bondType] })
    }
  }

  if (lines.length === 0) return null

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }} xmlns="http://www.w3.org/2000/svg">
      {lines.map((l, i) => (
        <g key={i}>
          <line x1={`${l.x1}%`} y1={`${l.y1}%`} x2={`${l.x2}%`} y2={`${l.y2}%`}
            stroke={l.color} strokeWidth="6" strokeOpacity="0.12" strokeLinecap="round" />
          <line x1={`${l.x1}%`} y1={`${l.y1}%`} x2={`${l.x2}%`} y2={`${l.y2}%`}
            stroke={l.color} strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  )
}

/* ─── Field markings + vignette ─────────────────── */
function FieldMarkings() {
  const lw = `rgba(255,255,255,0.22)`
  return (
    <>
      {/* Vignette — depth effect */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.5) 100%)',
      }} />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke={lw} strokeWidth="1" />
        <circle cx="50%" cy="50%" r="40" fill="none" stroke={lw} strokeWidth="1" />
        <circle cx="50%" cy="50%" r="2.5" fill={lw} />
        <rect x="20%" y="2%" width="60%" height="18%" rx="1" fill="none" stroke={lw} strokeWidth="1" />
        <rect x="35%" y="2%" width="30%" height="8%" rx="1" fill="none" stroke={lw} strokeWidth="1" />
        <rect x="20%" y="80%" width="60%" height="18%" rx="1" fill="none" stroke={lw} strokeWidth="1" />
        <rect x="35%" y="92%" width="30%" height="6%" rx="1" fill="none" stroke={lw} strokeWidth="1" />
      </svg>
    </>
  )
}

/* ─── Slot dot ───────────────────────────────────── */
function SlotDot({ slot, player, isCaptain, isNext, isPendingTarget, isSwapTarget, isMovingTarget,
  movingPick, pendingPlayer, difficultyMode, onSlotClick }: {
  slot: FormationSlot
  player: SquadPlayer | null
  isCaptain: boolean
  isNext: boolean
  isPendingTarget: boolean
  isSwapTarget: boolean
  isMovingTarget: boolean
  movingPick: SquadPlayer | null
  pendingPlayer: Player | null
  difficultyMode: 'normal' | 'almanaque'
  onSlotClick: () => void
}) {
  const activePending = movingPick ?? pendingPlayer
  const compat     = activePending ? getCompatibility(activePending.position, activePending.altPositions, slot.position) : null
  const compatColor = compat === 'natural' ? C.green : compat === 'puede' ? C.amber : compat === 'forzado' ? C.red : ''
  const isTargeted  = isPendingTarget || isMovingTarget
  const projectedRating = (isTargeted || isSwapTarget) && activePending && compat && compat !== 'forzado'
    ? Math.round(activePending.rating * compatibilityMultiplier(compat))
    : null
  const isClickable = isTargeted || isSwapTarget || (player !== null && !pendingPlayer && !movingPick)

  const filledBorderColor = (isSwapTarget || isMovingTarget)
    ? C.blue
    : player?.compatibility === 'natural' ? C.green
    : player?.compatibility === 'puede'   ? C.amber
    : C.red

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center ${isClickable ? 'cursor-pointer' : ''}`}
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
      onClick={onSlotClick}
    >
      <AnimatePresence mode="wait">
        {player ? (
          <motion.div key="filled" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            className="flex flex-col items-center gap-0.5">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-[9px] font-black ${isSwapTarget || isMovingTarget ? 'opacity-50' : ''}`}
              style={{
                background: 'rgba(13,17,23,0.92)',
                border: `2px solid ${filledBorderColor}`,
                color: filledBorderColor,
                boxShadow: `0 4px 14px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 1px rgba(0,0,0,0.5)`,
              }}
            >
              {isCaptain ? '©' : slot.position}
            </div>
            <div className="text-center leading-none">
              <div className="text-[9px] font-semibold max-w-13 truncate drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                style={{ color: C.text }}>
                {player.name.split(' ').at(-1)}
              </div>
              {difficultyMode === 'normal' && (
                <div className="text-[9px] font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                  style={{ color: slotRatingColor(player.tournamentRating) }}>
                  {player.tournamentRating}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${isNext ? 'animate-pulse' : ''}`}
                style={{
                  border: `2px dashed ${isNext ? C.blue : isTargeted && compat ? compatColor || 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.25)'}`,
                  color:  isNext ? C.blue : isTargeted && compat ? compatColor || 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.4)',
                  background: 'rgba(0,0,0,0.25)',
                  boxShadow: isNext ? `0 0 14px ${C.blue}55` : isTargeted ? `0 0 8px ${compatColor}44` : 'none',
                }}
              >
                {slot.position}
              </div>
              {projectedRating !== null && difficultyMode !== 'almanaque' && (
                <div
                  className="text-[9px] font-black drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                  style={{ color: compatColor }}
                >
                  {projectedRating}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Player row ─────────────────────────────────── */
function PlayerRow({ index, player, slotPosition, difficultyMode, isPending, isAlreadyPicked, isUnplaceable, onClick, onHover, onHoverEnd }: {
  index: number
  player: Player
  slotPosition: Position | undefined
  difficultyMode: 'normal' | 'almanaque'
  isPending: boolean
  isAlreadyPicked: boolean
  isUnplaceable: boolean
  onClick: () => void
  onHover?: (player: Player) => void
  onHoverEnd?: () => void
}) {
  const compat         = slotPosition ? getCompatibility(player.position, player.altPositions, slotPosition) : 'natural'
  const adjustedRating = Math.round(player.rating * compatibilityMultiplier(compat))
  const isAlmanaque    = difficultyMode === 'almanaque'
  const posDisplay     = [
    player.position,
    ...player.altPositions.filter(a => a.compatibility !== 'forzado').map(a => a.position).slice(0, 2),
  ].join('/')

  if (isAlreadyPicked) {
    return (
      <div
        className="w-full flex items-center gap-2 pl-2 pr-3 border-b select-none"
        style={{ height: 46, borderColor: C.border + '40', opacity: 0.28, cursor: 'not-allowed' }}
      >
        <span className="text-sm shrink-0 w-5 text-center" style={{ color: C.dim }}>✓</span>
        <span style={{ color: C.dim }} className="text-xs tabular-nums shrink-0 w-5 text-right">{index}</span>
        <span style={{ color: C.muted }} className="text-sm font-semibold truncate flex-1 line-through">{player.name}</span>
        <span style={{ color: C.dim }} className="text-xs shrink-0 w-16 text-center">{posDisplay}</span>
        {!isAlmanaque && (
          <span style={{ color: C.dim }} className="text-base font-black shrink-0 w-8 text-right tabular-nums">
            {adjustedRating}
          </span>
        )}
      </div>
    )
  }

  if (isUnplaceable) {
    return (
      <div
        className="w-full flex items-center gap-2 pl-2 pr-3 border-b select-none"
        style={{ height: 46, borderColor: C.border + '40', opacity: 0.22, cursor: 'not-allowed' }}
      >
        <span className="text-sm shrink-0 w-5 text-center" style={{ color: C.red }}>—</span>
        <span style={{ color: C.dim }} className="text-xs tabular-nums shrink-0 w-5 text-right">{index}</span>
        <span style={{ color: C.dim }} className="text-sm font-semibold truncate flex-1">{player.name}</span>
        <span style={{ color: C.dim }} className="text-xs shrink-0 w-16 text-center">{posDisplay}</span>
        {!isAlmanaque && (
          <span style={{ color: C.dim }} className="text-base font-black shrink-0 w-8 text-right tabular-nums">
            {adjustedRating}
          </span>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 pl-2 pr-3 border-b transition-colors text-left cursor-pointer"
      style={{
        height: 46,
        borderColor: isPending ? C.amber + '40' : C.border + '50',
        background: isPending ? C.amber + '10' : 'transparent',
        borderLeft: isPending ? `2px solid ${C.amber}` : undefined,
      }}
      onMouseEnter={e => {
        onHover?.(player)
        if (!isPending) e.currentTarget.style.background = '#ffffff07'
      }}
      onMouseLeave={e => {
        onHoverEnd?.()
        if (!isPending) e.currentTarget.style.background = 'transparent'
      }}
    >
      <span className="text-sm shrink-0 w-5 text-center">{COMPATIBILITY_EMOJI[compat]}</span>
      <span style={{ color: C.dim }} className="text-xs tabular-nums shrink-0 w-5 text-right">{index}</span>
      <span style={{ color: isPending ? C.amber : C.text }} className="text-sm font-semibold truncate flex-1">
        {player.name}
        {player.isCaptain && <span style={{ color: C.amber }} className="ml-1 text-[10px]">©</span>}
      </span>
      <span style={{ color: C.muted }} className="text-xs shrink-0 w-16 text-center">{posDisplay}</span>
      {!isAlmanaque && (
        <span style={{ color: listRatingColor(adjustedRating) }}
          className="text-base font-black shrink-0 w-8 text-right tabular-nums">
          {adjustedRating}
        </span>
      )}
    </button>
  )
}

/* ─── Helpers ────────────────────────────────────── */
function statColor(v: number): string {
  if (v >= 95) return C.gold
  if (v >= 90) return C.amber
  if (v >= 80) return C.green
  return C.muted
}

function slotRatingColor(r: number): string {
  if (r >= 95) return C.gold
  if (r >= 90) return '#d29922'
  if (r >= 80) return C.green
  return C.muted
}

function listRatingColor(r: number): string {
  if (r >= 95) return C.gold
  if (r >= 90) return C.amber
  if (r >= 80) return C.green
  if (r >= 70) return C.blue
  return C.muted
}

const STAT_LABELS: Record<string, string> = {
  reflejos: 'REF', manejo: 'MAN', salidas: 'SAL', penales: 'PEN', distribucion: 'DIS',
  defAerea: 'AER', intercepciones: 'INT', velocidad: 'VEL', pases: 'PAS', duelos: 'DUE',
  recuperacion: 'REC', posicionamiento: 'POS', vision: 'VIS', llegada: 'LLE', tecnica: 'TEC',
  paseFiltrado: 'FIL', regate: 'REG', disparo: 'TIR', definicion: 'DEF', fisico: 'FIS',
  cabezazo: 'CAB', pressing: 'PRE', centro: 'CEN', desmarque: 'DES', resistencia: 'RES',
}

const KEY_STATS_BY_POS: Record<string, string[]> = {
  POR: ['reflejos', 'manejo', 'salidas'],
  LD:  ['velocidad', 'intercepciones', 'pases'],
  LI:  ['velocidad', 'intercepciones', 'pases'],
  DFC: ['defAerea', 'duelos', 'intercepciones'],
  MCD: ['recuperacion', 'posicionamiento', 'duelos'],
  MC:  ['pases', 'vision', 'llegada'],
  MCO: ['vision', 'paseFiltrado', 'regate'],
  MD:  ['velocidad', 'regate', 'centro'],
  MI:  ['velocidad', 'regate', 'centro'],
  EI:  ['velocidad', 'regate', 'disparo'],
  ED:  ['velocidad', 'regate', 'disparo'],
  DC:  ['definicion', 'velocidad', 'cabezazo'],
}

function getStatsForDisplay(player: Player, mode: 'simple' | 'medio' | 'completo'): [string, number][] {
  if (mode === 'simple') return []
  const allEntries = Object.entries(player.stats).filter(([, v]) => v !== undefined) as [string, number][]
  if (mode === 'completo') return allEntries
  const keyKeys = KEY_STATS_BY_POS[player.position] ?? allEntries.slice(0, 3).map(([k]) => k)
  return keyKeys
    .map(k => [k, (player.stats as Record<string, number>)[k]] as [string, number])
    .filter(([, v]) => v !== undefined)
}

/* ─── Player stat hover card ─────────────────────── */
function PlayerStatCard({ player, statsMode, mousePos }: {
  player: Player
  statsMode: 'simple' | 'medio' | 'completo'
  mousePos: { x: number; y: number }
}) {
  const CARD_WIDTH = 196
  const stats = getStatsForDisplay(player, statsMode)
  const CARD_HEIGHT = stats.length > 0 ? 58 + stats.length * 16 : 46

  const posDisplay = [
    player.position,
    ...player.altPositions.filter(a => a.compatibility !== 'forzado').map(a => a.position),
  ].join(' / ')

  const x = mousePos.x
  const y = mousePos.y
  const cardTop = typeof window !== 'undefined'
    ? Math.max(8, y - CARD_HEIGHT - 12)
    : y - CARD_HEIGHT - 12
  const cardLeft = typeof window !== 'undefined'
    ? Math.max(8, Math.min(x - CARD_WIDTH / 2, window.innerWidth - CARD_WIDTH - 8))
    : x - CARD_WIDTH / 2

  return (
    <div
      className="fixed pointer-events-none z-40"
      style={{
        top: cardTop,
        left: cardLeft,
        width: CARD_WIDTH,
        background: 'rgba(13,17,23,0.97)',
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '10px 12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      <div className="font-bold text-sm truncate" style={{ color: C.text }}>{player.name}</div>
      <div className="text-[10px]" style={{ color: C.muted, marginBottom: stats.length > 0 ? 8 : 0 }}>{posDisplay}</div>
      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {stats.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-1">
              <span className="text-[10px]" style={{ color: C.dim }}>{STAT_LABELS[k]}</span>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: statColor(v) }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
