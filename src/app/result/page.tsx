'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/lib/store/gameStore'
import { loadSquadCatalog, loadSquadBySlug, pickRandomRefs } from '@/lib/data/loader'
import type { Squad } from '@/types/tournament'
import { runTournament } from '@/lib/engine/simulation'
import { saveGame, generateGameId } from '@/lib/data/history'
import type { MatchResult, PlayerTournamentStats } from '@/types/game'

const PHASE_LABELS: Record<string, string> = {
  'grupo-1': 'Jornada 1', 'grupo-2': 'Jornada 2', 'grupo-3': 'Jornada 3',
  octavos: 'Octavos', cuartos: 'Cuartos', semis: 'Semifinal', final: 'Gran Final',
}

const RESULT_LABELS: Record<string, string> = {
  campeon: '🏆 ¡Campeón!',
  finalista: '🥈 Finalista',
  semifinalista: '🥉 Semifinalista',
  cuartos: 'Cuartos de final',
  octavos: 'Octavos de final',
  grupos: 'Eliminado en grupos',
}

export default function ResultPage() {
  const router = useRouter()
  const { phase, picks, chemistry, simMode, injuriesEnabled, summary, setSummary, reset } = useGameStore()
  const computed = useRef(false)

  // ── Animation ─────────────────────────────────────────
  const [animIndex, setAnimIndex] = useState(1)

  type Frame = { matchIndex: number; eventIndex: number | null }
  const frames = useMemo((): Frame[] => {
    if (!summary) return []
    if (simMode !== 'relato') {
      return summary.matches.map((_, i) => ({ matchIndex: i, eventIndex: null }))
    }
    const list: Frame[] = []
    summary.matches.forEach((match, mi) => {
      list.push({ matchIndex: mi, eventIndex: null })
      match.events.forEach((_, ei) => list.push({ matchIndex: mi, eventIndex: ei }))
    })
    return list
  }, [summary, simMode])

  const animDone = animIndex >= frames.length && frames.length > 0

  useEffect(() => {
    if (animDone || frames.length === 0) return
    const ms = simMode === 'relato' ? 420 : 850
    const t = setTimeout(() => setAnimIndex(i => i + 1), ms)
    return () => clearTimeout(t)
  }, [animIndex, animDone, frames.length, simMode])

  const visibleFrames = frames.slice(0, animIndex)
  const visibleMatchSet = new Set(visibleFrames.map(f => f.matchIndex))
  function eventsShown(matchIndex: number): number {
    return visibleFrames.filter(f => f.matchIndex === matchIndex && f.eventIndex !== null).length
  }
  // ─────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'simulacion') { router.replace('/'); return }
    if (computed.current || summary) return
    computed.current = true

    loadSquadCatalog()
      .then(catalog => {
        const refs = pickRandomRefs(catalog, 7, Date.now())
        return Promise.all(refs.map(r => loadSquadBySlug(r.year, r.slug)))
      })
      .then(squads => {
        const cpuSquads = squads.filter(Boolean) as Squad[]
        const seed = Date.now()
        const result = runTournament(
          picks,
          chemistry ?? { total: 0, bonuses: [], capped: false },
          cpuSquads,
          injuriesEnabled,
          seed
        )
        setSummary(result)
        const { formation, statsMode, difficultyMode } = useGameStore.getState()
        if (formation) {
          saveGame({
            id: generateGameId(),
            createdAt: new Date().toISOString(),
            formation,
            squad: picks,
            chemistry: chemistry ?? { total: 0, bonuses: [], capped: false },
            summary: result,
            statsMode,
            difficultyMode,
            injuriesEnabled,
          })
        }
      })
  }, [phase, picks, chemistry, injuriesEnabled, summary, setSummary, router])

  function handlePlayAgain() {
    reset()
    router.push('/')
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-spin">⚽</div>
          <p className="text-gray-400">Simulando torneo...</p>
        </div>
      </div>
    )
  }

  const avgRating = picks.length
    ? Math.round(picks.reduce((s, p) => s + p.tournamentRating, 0) / picks.length)
    : 0

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center justify-between z-10">
        <button onClick={handlePlayAgain} className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Nuevo draft
        </button>
        <span className="font-bold text-white">{animDone ? 'Resultado' : '🔴 En vivo'}</span>
        {!animDone
          ? <button onClick={() => setAnimIndex(frames.length)} className="text-xs text-gray-500 hover:text-white transition-colors">⏩ Saltar</button>
          : <div className="w-20" />
        }
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">

        {/* Final result banner — only after animation */}
        {animDone && (
          <div className={`rounded-2xl p-6 text-center ${summary.won ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-gray-900 border border-gray-800'}`}>
            <div className="text-4xl mb-2">
              {summary.won ? '🏆' : summary.finalResult === 'finalista' ? '🥈' : '⚽'}
            </div>
            <div className="text-2xl font-black text-white">{RESULT_LABELS[summary.finalResult]}</div>
            <div className="text-gray-400 text-sm mt-1">Promedio del equipo: <span className="text-white font-bold">{avgRating}</span></div>
          </div>
        )}

        {/* Matches — progressive */}
        {simMode === 'relato' ? (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Partidos</h2>
            {summary.matches.filter((_, i) => visibleMatchSet.has(i)).map((match, i) => (
              <MatchCard key={i} match={match} visibleEvents={animDone ? undefined : eventsShown(i)} />
            ))}
          </section>
        ) : (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Resultados</h2>
            {summary.matches.filter((_, i) => visibleMatchSet.has(i)).map((match, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 animate-fadeIn">
                <span className="text-sm text-gray-400">{PHASE_LABELS[match.phase]}</span>
                <span className="text-sm text-gray-400">vs {match.rivalSquad.country} {match.rivalSquad.year}</span>
                <span className={`font-bold ${match.won ? 'text-emerald-400' : match.goalsFor === match.goalsAgainst ? 'text-yellow-400' : 'text-red-400'}`}>
                  {match.goalsFor}–{match.goalsAgainst}
                </span>
              </div>
            ))}
          </section>
        )}

        {/* Awards — only after animation */}
        {animDone && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Premios del torneo</h2>
            <div className="grid grid-cols-2 gap-3">
              {summary.mvp && <AwardCard icon="⭐" label="MVP" stat={summary.mvp} />}
              {summary.topScorer && <AwardCard icon="⚽" label="Goleador" stat={summary.topScorer} extra={`${summary.topScorer.goals} gols`} />}
              {summary.topAssist && <AwardCard icon="🎯" label="Asistidor" stat={summary.topAssist} extra={`${summary.topAssist.assists} asist.`} />}
              {summary.bestKeeper && <AwardCard icon="🧤" label="Mejor Portero" stat={summary.bestKeeper} extra={`${summary.bestKeeper.keySaves} atajadas`} />}
            </div>
          </section>
        )}

        {/* Player stats — only after animation */}
        {animDone && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Stats individuales</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-2 text-gray-500 font-medium">Jugador</th>
                    <th className="px-3 py-2 text-gray-500 font-medium text-center">⚽</th>
                    <th className="px-3 py-2 text-gray-500 font-medium text-center">🎯</th>
                    <th className="px-3 py-2 text-gray-500 font-medium text-center">🛡️</th>
                    <th className="px-3 py-2 text-gray-500 font-medium text-right">Puntaje</th>
                  </tr>
                </thead>
                <tbody>
                  {[...summary.playerStats]
                    .sort((a, b) => b.rating - a.rating)
                    .map(stat => (
                      <tr key={stat.playerId} className="border-b border-gray-800/50 last:border-0">
                        <td className="px-4 py-2">
                          <div className="font-medium text-white truncate max-w-32">{stat.playerName}</div>
                          <div className="text-xs text-gray-500">{stat.position}</div>
                        </td>
                        <td className="px-3 py-2 text-center text-white">{stat.goals || '—'}</td>
                        <td className="px-3 py-2 text-center text-white">{stat.assists || '—'}</td>
                        <td className="px-3 py-2 text-center text-white">
                          {stat.cleanSheets > 0 ? stat.cleanSheets : stat.keySaves > 0 ? stat.keySaves : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`font-bold ${ratingColor(stat.rating)}`}>{stat.rating}</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Actions */}
        {animDone && (
          <div className="space-y-3">
            <button
              onClick={handlePlayAgain}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-xl transition-colors"
            >
              Nuevo draft →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function MatchCard({ match, visibleEvents }: { match: MatchResult; visibleEvents?: number }) {
  const events = visibleEvents !== undefined ? match.events.slice(0, visibleEvents) : match.events
  const resultColor = match.won
    ? 'text-emerald-400'
    : match.goalsFor === match.goalsAgainst
    ? 'text-yellow-400'
    : 'text-red-400'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{PHASE_LABELS[match.phase]}</span>
        <span className="text-xs text-gray-500">vs {match.rivalSquad.country} {match.rivalSquad.year}</span>
        <span className={`font-black text-lg ${resultColor}`}>
          {match.goalsFor}–{match.goalsAgainst}
        </span>
      </div>
      {events.length > 0 && (
        <div className="px-4 py-3 space-y-1.5 max-h-48 overflow-y-auto">
          {events.map((ev, i) => (
            <div key={i} className={`text-xs flex items-start gap-2 ${ev.team === 'rival' ? 'opacity-60' : ''}`}>
              <span className="text-gray-500 shrink-0 w-8 text-right">{ev.minute}&apos;</span>
              <span className="text-gray-300">{ev.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AwardCard({ icon, label, stat, extra }: {
  icon: string; label: string; stat: PlayerTournamentStats; extra?: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-1">
      <div className="text-lg">{icon}</div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-bold text-white truncate">{stat.playerName}</div>
      {extra && <div className="text-xs text-blue-400">{extra}</div>}
    </div>
  )
}

function ratingColor(r: number): string {
  if (r >= 95) return 'text-yellow-400'
  if (r >= 85) return 'text-emerald-400'
  if (r >= 75) return 'text-blue-400'
  return 'text-gray-400'
}
