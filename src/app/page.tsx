'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/lib/store/gameStore'
import { FORMATIONS } from '@/lib/data/formations'
import type { StatsDisplayMode, DifficultyMode, DraftMode, SquadPool } from '@/types/game'

const WC_YEARS = [1930,1934,1938,1950,1954,1958,1962,1966,1970,1974,1978,1982,1986,1990,1994,1998,2002,2006,2010,2014,2018,2022]

export default function Home() {
  const router = useRouter()
  const startGame = useGameStore(s => s.startGame)

  const [formationId, setFormationId] = useState('4-3-3')
  const [statsMode, setStatsMode] = useState<StatsDisplayMode>('medio')
  const [difficultyMode, setDifficultyMode] = useState<DifficultyMode>('normal')
  const [draftMode, setDraftMode] = useState<DraftMode>('libre')
  const [injuriesEnabled, setInjuriesEnabled] = useState(false)
  const [chemistryCap, setChemistryCap] = useState(true)
  const [squadPool, setSquadPool] = useState<SquadPool>('all')
  const [yearFrom, setYearFrom] = useState(1930)
  const [yearTo, setYearTo] = useState(2022)

  function handleStart() {
    const formation = FORMATIONS.find(f => f.id === formationId)!
    startGame(formation, { statsMode, difficultyMode, simMode: 'relato', injuriesEnabled, chemistryCap, draftMode, squadPool, yearFrom, yearTo })
    router.push('/game')
  }

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">

        <div className="text-center space-y-2">
          <div className="text-5xl font-black tracking-tight text-white">
            Draft<span className="text-blue-400">XI</span>
          </div>
          <p className="text-gray-400 text-sm">
            Armá tu selección histórica ideal y llevala al campeonato.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">

          <Section label="Formación">
            <div className="grid grid-cols-3 gap-2">
              {FORMATIONS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFormationId(f.id)}
                  className={`py-2 rounded-lg text-sm font-semibold border transition-all ${
                    formationId === f.id
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </Section>

          <Section label="Modo de stats">
            <div className="grid grid-cols-3 gap-2">
              {([
                ['simple', 'Simple', 'Solo promedio'] as const,
                ['medio', 'Medio', '3 stats clave'] as const,
                ['completo', 'Completo', '5–6 stats'] as const,
              ]).map(([val, label, desc]) => (
                <button
                  key={val}
                  onClick={() => setStatsMode(val)}
                  className={`py-2 px-3 rounded-lg text-left border transition-all ${
                    statsMode === val
                      ? 'bg-blue-600 border-blue-500'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="text-xs font-semibold">{label}</div>
                  <div className="text-xs opacity-60">{desc}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section label="Dificultad">
            <div className="grid grid-cols-2 gap-2">
              {([
                ['normal', 'Clásico', 'bg-blue-600 border-blue-500'] as const,
                ['almanaque', 'Almanaque 🧠', 'bg-purple-600 border-purple-500'] as const,
              ]).map(([val, label, activeClass]) => (
                <button
                  key={val}
                  onClick={() => setDifficultyMode(val)}
                  className={`py-2 rounded-lg text-sm font-semibold border transition-all ${
                    difficultyMode === val
                      ? `${activeClass} text-white`
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {difficultyMode === 'almanaque' && (
              <p className="text-xs text-purple-400 mt-1">
                Ratings y stats ocultos. Solo ves los nombres.
              </p>
            )}
          </Section>

          <Section label="Draft">
            <div className="grid grid-cols-2 gap-2">
              {([
                ['libre', 'Libre', 'Elegís el slot vos'] as const,
                ['ordenado', 'Ordenado', 'POR → DC automático'] as const,
              ]).map(([val, label, desc]) => (
                <button
                  key={val}
                  onClick={() => setDraftMode(val)}
                  className={`py-2 px-3 rounded-lg text-left border transition-all ${
                    draftMode === val
                      ? 'bg-blue-600 border-blue-500'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="text-xs font-semibold">{label}</div>
                  <div className="text-xs opacity-60">{desc}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section label="Selecciones">
            <div className="grid grid-cols-2 gap-2">
              {([
                ['all', 'Todas', 'Todos los países'] as const,
                ['top', 'Top naciones', 'ARG, BRA, ALE, ITA...'] as const,
              ]).map(([val, label, desc]) => (
                <button
                  key={val}
                  onClick={() => setSquadPool(val)}
                  className={`py-2 px-3 rounded-lg text-left border transition-all ${
                    squadPool === val
                      ? 'bg-blue-600 border-blue-500'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="text-xs font-semibold">{label}</div>
                  <div className="text-xs opacity-60">{desc}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section label="Período">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Desde</p>
                <YearSelect
                  value={yearFrom}
                  years={WC_YEARS.filter(y => y <= yearTo)}
                  onChange={y => setYearFrom(y)}
                />
              </div>
              <div className="pt-5 text-gray-600">—</div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Hasta</p>
                <YearSelect
                  value={yearTo}
                  years={WC_YEARS.filter(y => y >= yearFrom)}
                  onChange={y => setYearTo(y)}
                />
              </div>
            </div>
          </Section>

          <Section label="Opciones">
            <div className="space-y-3">
              <Toggle
                label="Lesiones"
                description="Jugadores pueden lesionarse durante la simulación"
                checked={injuriesEnabled}
                onChange={setInjuriesEnabled}
              />
              <Toggle
                label="Cap de química (20%)"
                description="Limita el bonus máximo de química"
                checked={chemistryCap}
                onChange={setChemistryCap}
              />
            </div>
          </Section>
        </div>

        <button
          onClick={handleStart}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-lg rounded-xl transition-colors"
        >
          Empezar draft →
        </button>

        <p className="text-center text-xs text-gray-600">
          Selecciones históricas · Copa del Mundo
        </p>
      </div>
    </main>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      {children}
    </div>
  )
}

function Toggle({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <button onClick={() => onChange(!checked)} className="w-full flex items-center justify-between gap-4 text-left">
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <div className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-blue-600' : 'bg-gray-700'}`}>
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
      </div>
    </button>
  )
}

function YearSelect({ value, years, onChange }: {
  value: number; years: number[]; onChange: (y: number) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white flex items-center justify-between hover:border-gray-600 transition-colors focus:outline-none"
      >
        <span>{value}</span>
        <span className="text-gray-500 text-xs ml-2">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          <div className="overflow-y-auto" style={{ maxHeight: 160 }}>
            {years.map(y => (
              <button
                key={y}
                type="button"
                onClick={() => { onChange(y); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-gray-700 ${y === value ? 'text-blue-400 font-semibold bg-gray-750' : 'text-gray-200'}`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
