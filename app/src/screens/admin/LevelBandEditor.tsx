import React, { useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import {
  buildProgressionPreview,
  DEFAULT_PROGRESSION_BANDS,
  type BudgetDistribution,
  type LevelBandPolicy,
} from '../../../../shared/game/progression'

const MAX_PREVIEW_LEVEL = 30

interface Props {
  bands: LevelBandPolicy[]
  onChange: (bands: LevelBandPolicy[]) => void
  pillsPerTier: number[]
  astrdsPerPill: number[]
  onSave: () => void
  saving: boolean
  apiKey: string
  onApiKeyChange: (value: string) => void
  status: string
}

function cloneBands(bands: LevelBandPolicy[]): LevelBandPolicy[] {
  return JSON.parse(JSON.stringify(bands?.length ? bands : DEFAULT_PROGRESSION_BANDS)) as LevelBandPolicy[]
}

const LevelBandEditor: React.FC<Props> = ({ bands, onChange, pillsPerTier, astrdsPerPill, onSave, saving, apiKey, onApiKeyChange, status }) => {
  const activeDeposits = useQuery(api.spaceDeposits.getAllActiveSpaceDeposits) ?? []
  const [selectedId, setSelectedId] = useState((bands[0] ?? DEFAULT_PROGRESSION_BANDS[0]).id)
  const [previewMode, setPreviewMode] = useState<'chart' | 'table'>('chart')
  const sorted = useMemo(() => cloneBands(bands).sort((a, b) => a.fromLevel - b.fromLevel), [bands])
  const selected = sorted.find((band) => band.id === selectedId) ?? sorted[0]
  const previewLevelMax = useMemo(() => Math.min(100, Math.max(MAX_PREVIEW_LEVEL, ...sorted.map(b => b.toLevel))), [sorted])
  const preview = useMemo(() => buildProgressionPreview(sorted, previewLevelMax), [sorted, previewLevelMax])

  const setBands = (next: LevelBandPolicy[]) => onChange(next.sort((a, b) => a.fromLevel - b.fromLevel))
  const updateSelected = (patch: Partial<LevelBandPolicy>) => {
    setBands(sorted.map((band) => band.id === selected.id ? { ...band, ...patch } : band))
  }
  const updateSelectedPath = <K extends keyof LevelBandPolicy>(key: K, patch: Partial<LevelBandPolicy[K]>) => {
    updateSelected({ [key]: { ...(selected[key] as object), ...patch } } as Partial<LevelBandPolicy>)
  }

  const splitBand = () => {
    if (selected.toLevel <= selected.fromLevel) return
    const splitAt = Math.floor((selected.fromLevel + selected.toLevel) / 2) + 1
    const left = { ...selected, toLevel: splitAt - 1 }
    const right: LevelBandPolicy = {
      ...cloneBands([selected])[0],
      id: `band-${Date.now().toString(36)}`,
      fromLevel: splitAt,
      toLevel: selected.toLevel,
    }
    setSelectedId(right.id)
    setBands(sorted.map((band) => band.id === selected.id ? left : band).concat(right))
  }

  const addBandAfter = () => {
    const next: LevelBandPolicy = {
      ...cloneBands([selected])[0],
      id: `band-${Date.now().toString(36)}`,
      fromLevel: selected.toLevel + 1,
      toLevel: selected.toLevel + 10,
    }
    setSelectedId(next.id)
    setBands([...sorted, next])
  }

  const removeBand = () => {
    if (sorted.length <= 1) return
    const next = sorted.filter((band) => band.id !== selected.id)
    setSelectedId(next[0].id)
    setBands(next)
  }

  return (
    <div className='space-y-4 font-mono text-xs'>
      <div className='border border-primary/30 bg-primary/5 px-3 py-2 text-[10px] text-muted-foreground'>
        <span className='text-primary'>LIVE:</span> these persisted bands are consumed by the game server. Ship/powerup budgets are distributed by level; Space Token ranges below are read-only depositor-authored overlays.
      </div>

      <div className='grid gap-3 md:grid-cols-[220px_1fr]'>
        <div className='border border-border'>
          <div className='px-3 py-2 border-b border-border text-[9px] uppercase tracking-widest text-muted-foreground'>Bands</div>
          {sorted.map((band) => (
            <button
              key={band.id}
              onClick={() => setSelectedId(band.id)}
              className={`block w-full text-left px-3 py-2 border-b border-edge-subtle text-[10px] ${band.id === selected.id ? 'bg-primary/10 text-primary' : 'text-tx-secondary hover:text-foreground'}`}
            >
              L{band.fromLevel}–{band.toLevel} · ships {band.shipPickups.count} · powerups {band.powerups.count}
            </button>
          ))}
          <div className='p-2 flex gap-2'>
            <button onClick={splitBand} className='px-2 py-1 border border-edge-subtle text-[10px] hover:text-primary'>Split</button>
            <button onClick={addBandAfter} className='px-2 py-1 border border-edge-subtle text-[10px] hover:text-primary'>Add after</button>
            <button onClick={removeBand} className='px-2 py-1 border border-edge-subtle text-[10px] hover:text-destructive disabled:opacity-40' disabled={sorted.length <= 1}>Remove</button>
          </div>
        </div>

        <div className='border border-border p-3 space-y-3'>
          <div className='grid grid-cols-2 gap-2'>
            <NumberInput label='From level' value={selected.fromLevel} min={1} max={99} step={1} onChange={v => updateSelected({ fromLevel: v })} />
            <NumberInput label='To level' value={selected.toLevel} min={selected.fromLevel} max={200} step={1} onChange={v => updateSelected({ toLevel: v })} />
          </div>

          <Section title='Asteroid count (step/classic)'>
            <NumberInput label='Start' value={selected.asteroidCount.mode === 'step' ? selected.asteroidCount.start : 2} min={0} max={50} step={1} onChange={v => updateSelected({ asteroidCount: { mode: 'step', start: v, increment: selected.asteroidCount.mode === 'step' ? selected.asteroidCount.increment : 1, cap: selected.asteroidCount.mode === 'step' ? selected.asteroidCount.cap : 10 } })} />
            <NumberInput label='Increment / level' value={selected.asteroidCount.mode === 'step' ? selected.asteroidCount.increment : 1} min={0} max={10} step={1} onChange={v => updateSelected({ asteroidCount: { mode: 'step', start: selected.asteroidCount.mode === 'step' ? selected.asteroidCount.start : 2, increment: v, cap: selected.asteroidCount.mode === 'step' ? selected.asteroidCount.cap : 10 } })} />
            <NumberInput label='Cap' value={selected.asteroidCount.mode === 'step' ? selected.asteroidCount.cap ?? 10 : 10} min={1} max={100} step={1} onChange={v => updateSelectedPath('asteroidCount', { cap: v } as never)} />
          </Section>

          <Section title='Asteroid speed curve'>
            <NumberInput label='From multiplier' value={selected.asteroidSpeed.mode === 'linear' ? selected.asteroidSpeed.from : 1} min={0.1} max={5} step={0.05} onChange={v => updateSelected({ asteroidSpeed: { mode: 'linear', from: v, to: selected.asteroidSpeed.mode === 'linear' ? selected.asteroidSpeed.to : 1.5 } })} />
            <NumberInput label='To multiplier' value={selected.asteroidSpeed.mode === 'linear' ? selected.asteroidSpeed.to : 1.5} min={0.1} max={8} step={0.05} onChange={v => updateSelected({ asteroidSpeed: { mode: 'linear', from: selected.asteroidSpeed.mode === 'linear' ? selected.asteroidSpeed.from : 1, to: v } })} />
          </Section>

          <Section title='Budgets'>
            <NumberInput label='Ship pickups in range' value={selected.shipPickups.count} min={0} max={selected.toLevel - selected.fromLevel + 1} step={1} onChange={v => updateSelectedPath('shipPickups', { count: v })} />
            <SelectInput label='Ship distribution' value={selected.shipPickups.distribution} onChange={v => updateSelectedPath('shipPickups', { distribution: v })} />
            <NumberInput label='Powerups in range' value={selected.powerups.count} min={0} max={selected.toLevel - selected.fromLevel + 1} step={1} onChange={v => updateSelectedPath('powerups', { count: v })} />
            <SelectInput label='Powerup distribution' value={selected.powerups.distribution} onChange={v => updateSelectedPath('powerups', { distribution: v })} />
          </Section>

          <Section title='Max lives'>
            <NumberInput label='Fixed cap' value={selected.maxLives.mode === 'fixed' ? selected.maxLives.value : 5} min={1} max={10} step={1} onChange={v => updateSelected({ maxLives: { mode: 'fixed', value: v } })} />
          </Section>
        </div>
      </div>

      <div className='flex items-center gap-3 border-t border-border pt-3'>
        <input
          type='password'
          value={apiKey}
          onChange={e => onApiKeyChange(e.target.value)}
          placeholder='ADMIN_API_KEY'
          className='w-56 bg-transparent border border-border text-[10px] font-mono px-2 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60'
        />
        <button
          onClick={onSave}
          disabled={saving || !apiKey}
          className='bg-primary/20 border border-primary/40 text-primary px-6 py-2 hover:bg-primary/30 transition-colors disabled:opacity-40 text-[10px] uppercase tracking-widest'
        >
          {saving ? 'Saving…' : 'Save progression'}
        </button>
        {!apiKey && <span className='text-[10px] text-muted-foreground'>Enter ADMIN_API_KEY to save level bands.</span>}
        {status && <span className={`text-[10px] ${status.startsWith('Error') ? 'text-destructive' : 'text-tx-success'}`}>{status}</span>}
      </div>

      <div className='border border-border overflow-hidden'>
        <div className='flex items-center border-b border-border'>
          <div className='px-3 py-2 text-[9px] uppercase tracking-widest text-muted-foreground'>Generated per-level preview</div>
          <div className='ml-auto flex'>
            {(['chart', 'table'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setPreviewMode(mode)}
                className={`px-3 py-2 border-l border-border text-[9px] uppercase tracking-widest ${previewMode === mode ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        {previewMode === 'chart' ? (
          <ProgressionChart preview={preview} deposits={activeDeposits} bands={sorted} maxLevel={previewLevelMax} />
        ) : (
          <div className='overflow-x-auto'>
          <table className='w-full text-[10px]'>
          <thead className='text-muted-foreground'>
            <tr className='border-b border-border'>
              <th className='text-left p-2'>Level</th><th className='text-right p-2'>Large asteroids</th><th className='text-right p-2'>Speed</th><th className='text-right p-2'>Ships</th><th className='text-right p-2'>Powerups</th><th className='text-right p-2'>Max lives</th><th className='text-left p-2'>ASTRDS tiers</th><th className='text-left p-2'>Space Tokens</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((row) => {
              const tokens = activeDeposits.filter(d => d.minLevel <= row.level && d.maxLevel >= row.level && d.remainingAmount >= d.tokensPerPill)
              return (
                <tr key={row.level} className='border-b border-edge-subtle last:border-0'>
                  <td className='p-2 text-foreground'>{row.level}</td>
                  <td className='p-2 text-right'>{row.asteroidCount}</td>
                  <td className='p-2 text-right'>{row.asteroidSpeedMultiplier.toFixed(2)}x</td>
                  <td className='p-2 text-right'>{row.shipPickupAllowed ? 1 : 0}</td>
                  <td className='p-2 text-right'>{row.powerupBudget}</td>
                  <td className='p-2 text-right'>{row.maxLives}</td>
                  <td className='p-2'>T1–T5: {pillsPerTier.map((p, i) => `${p}×${astrdsPerPill[i]}`).join(' · ')}</td>
                  <td className='p-2'>{tokens.length ? tokens.map(t => `${t.symbol} (${Math.floor(t.remainingAmount / Math.max(1, t.tokensPerPill))} left)`).join(', ') : '—'}</td>
                </tr>
              )
            })}
          </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}

type PreviewRow = ReturnType<typeof buildProgressionPreview>[number]
type ActiveDeposit = NonNullable<ReturnType<typeof useQuery<typeof api.spaceDeposits.getAllActiveSpaceDeposits>>>[number]

const CHART_W = 920
const CHART_H = 340
const PAD = { left: 36, right: 18, top: 24, bottom: 104 }

function chartX(level: number, maxLevel: number): number {
  const plotW = CHART_W - PAD.left - PAD.right
  return PAD.left + ((level - 1) / Math.max(1, maxLevel - 1)) * plotW
}

function chartY(value: number, min: number, max: number): number {
  const plotH = CHART_H - PAD.top - PAD.bottom
  const norm = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)))
  return PAD.top + (1 - norm) * plotH
}

function points(rows: PreviewRow[], pick: (row: PreviewRow) => number, min: number, max: number, maxLevel: number): string {
  return rows.map(row => `${chartX(row.level, maxLevel)},${chartY(pick(row), min, max)}`).join(' ')
}

const ProgressionChart: React.FC<{
  preview: PreviewRow[]
  deposits: ActiveDeposit[]
  bands: LevelBandPolicy[]
  maxLevel: number
}> = ({ preview, deposits, bands, maxLevel }) => {
  const maxAsteroids = Math.max(1, ...preview.map(row => row.asteroidCount))
  const maxSpeed = Math.max(1, ...preview.map(row => row.asteroidSpeedMultiplier))
  const maxLives = Math.max(1, ...preview.map(row => row.maxLives))
  const activeDeposits = deposits.filter(d => d.remainingAmount >= d.tokensPerPill).slice(0, 6)

  return (
    <div className='p-3 space-y-3'>
      <div className='flex flex-wrap gap-3 text-[9px] uppercase tracking-widest text-muted-foreground'>
        <span className='text-primary'>● Asteroids</span>
        <span className='text-tx-warning'>● Speed</span>
        <span className='text-tx-success'>■ Ship budget</span>
        <span className='text-entity-shield'>■ Powerup budget</span>
        <span className='text-destructive'>● Max lives</span>
      </div>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className='w-full h-auto border border-edge-subtle bg-background'>
        {bands.map((band, idx) => {
          const x1 = chartX(Math.max(1, band.fromLevel), maxLevel)
          const x2 = chartX(Math.min(maxLevel, band.toLevel), maxLevel)
          return (
            <g key={band.id}>
              <rect x={x1} y={PAD.top} width={Math.max(1, x2 - x1)} height={CHART_H - PAD.top - PAD.bottom} fill='var(--primary)' opacity={idx % 2 === 0 ? 0.035 : 0.07} />
              <text x={(x1 + x2) / 2} y={PAD.top + 12} fill='var(--text-dim)' fontSize='9' textAnchor='middle' fontFamily='monospace'>L{band.fromLevel}–{band.toLevel}</text>
            </g>
          )
        })}

        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1={PAD.left} x2={CHART_W - PAD.right} y1={PAD.top + t * (CHART_H - PAD.top - PAD.bottom)} y2={PAD.top + t * (CHART_H - PAD.top - PAD.bottom)} stroke='var(--border-subtle)' strokeDasharray='3 4' />
        ))}
        {Array.from(new Set([1, 5, 10, 15, 20, 25, 30, maxLevel].filter(level => level <= maxLevel))).map(level => (
          <g key={level}>
            <line x1={chartX(level, maxLevel)} x2={chartX(level, maxLevel)} y1={PAD.top} y2={CHART_H - PAD.bottom} stroke='var(--border-subtle)' opacity='0.45' />
            <text x={chartX(level, maxLevel)} y={CHART_H - 8} fill='var(--text-dim)' fontSize='9' textAnchor='middle' fontFamily='monospace'>{level}</text>
          </g>
        ))}

        <polyline points={points(preview, row => row.asteroidCount, 0, maxAsteroids, maxLevel)} fill='none' stroke='var(--primary)' strokeWidth='2' />
        <polyline points={points(preview, row => row.asteroidSpeedMultiplier, 0, maxSpeed, maxLevel)} fill='none' stroke='var(--text-warning)' strokeWidth='2' />
        <polyline points={points(preview, row => row.maxLives, 0, maxLives, maxLevel)} fill='none' stroke='var(--destructive)' strokeWidth='1.5' strokeDasharray='5 4' />

        {preview.map(row => {
          const x = chartX(row.level, maxLevel)
          const baseY = CHART_H - PAD.bottom + 18
          return (
            <g key={row.level}>
              {row.shipPickupAllowed && <rect x={x - 4} y={baseY} width='8' height='16' fill='var(--text-success)' opacity='0.9' />}
              {row.powerupBudget > 0 && <rect x={x - 4} y={baseY + 22} width='8' height={Math.max(6, row.powerupBudget * 10)} fill='var(--entity-shield)' opacity='0.85' />}
            </g>
          )
        })}
        <text x={PAD.left} y={CHART_H - PAD.bottom + 12} fill='var(--text-dim)' fontSize='9' fontFamily='monospace'>ships</text>
        <text x={PAD.left} y={CHART_H - PAD.bottom + 44} fill='var(--text-dim)' fontSize='9' fontFamily='monospace'>powerups</text>

        {activeDeposits.map((deposit, idx) => {
          const y = CHART_H - PAD.bottom + 58 + idx * 12
          const start = Math.max(1, deposit.minLevel)
          const end = Math.min(maxLevel, deposit.maxLevel)
          if (end < 1 || start > maxLevel) return null
          return (
            <g key={deposit._id}>
              <text x={PAD.left} y={y + 8} fill='var(--text-dim)' fontSize='8' fontFamily='monospace'>{deposit.symbol}</text>
              <rect x={chartX(start, maxLevel)} y={y} width={Math.max(2, chartX(end, maxLevel) - chartX(start, maxLevel))} height='8' rx='2' fill='var(--primary)' opacity={0.25 + (idx % 3) * 0.15} />
            </g>
          )
        })}
      </svg>
      <div className='text-[9px] text-muted-foreground'>Chart view reads left-to-right by level. Lines show normalized difficulty/life curves; blocks show budgeted pickup opportunities; lower bars show depositor-controlled Space Token availability.</div>
    </div>
  )
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div className='text-muted-foreground text-[9px] uppercase tracking-widest mb-2'>{title}</div>
    <div className='grid gap-2 md:grid-cols-2'>{children}</div>
  </div>
)

const NumberInput: React.FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }> = ({ label, value, min, max, step, onChange }) => (
  <label className='flex items-center gap-2 border border-edge-subtle px-2 py-1.5'>
    <span className='flex-1 text-[10px] text-tx-secondary'>{label}</span>
    <button type='button' onClick={() => onChange(Math.max(min, parseFloat((value - step).toFixed(6))))} className='w-5 h-5 border border-edge-subtle'>−</button>
    <span className='w-14 text-center text-foreground'>{value}</span>
    <button type='button' onClick={() => onChange(Math.min(max, parseFloat((value + step).toFixed(6))))} className='w-5 h-5 border border-edge-subtle'>+</button>
  </label>
)

const SelectInput: React.FC<{ label: string; value: BudgetDistribution; onChange: (value: BudgetDistribution) => void }> = ({ label, value, onChange }) => (
  <label className='flex items-center gap-2 border border-edge-subtle px-2 py-1.5'>
    <span className='flex-1 text-[10px] text-tx-secondary'>{label}</span>
    <select value={value} onChange={e => onChange(e.target.value as BudgetDistribution)} className='bg-background border border-edge-subtle px-2 py-1 text-[10px] text-foreground'>
      {['even', 'random', 'early', 'late', 'manual'].map(option => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
)

export default LevelBandEditor
