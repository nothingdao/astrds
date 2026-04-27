import React, { useCallback, useRef, useState } from 'react'

export interface LevelBand {
  id: string
  fromLevel: number
  asteroidSpeedMultiplier: number
  asteroidCountIncrement: number
  powerupSpawnDelaySec: number
  shipPickupSpawnDelaySec: number
  maxLives: number
}

const BAND_COLORS = [
  'var(--primary)',
  'var(--entity-shield)',
  'var(--text-warning)',
  'var(--text-success)',
  'var(--destructive)',
  'var(--canvas-ship-pickup-fill)',
]

const DEFAULT_BANDS: LevelBand[] = [
  { id: 'a', fromLevel: 1,  asteroidSpeedMultiplier: 1.0, asteroidCountIncrement: 1, powerupSpawnDelaySec: 15, shipPickupSpawnDelaySec: 20, maxLives: 5 },
  { id: 'b', fromLevel: 6,  asteroidSpeedMultiplier: 1.4, asteroidCountIncrement: 1, powerupSpawnDelaySec: 12, shipPickupSpawnDelaySec: 18, maxLives: 5 },
  { id: 'c', fromLevel: 16, asteroidSpeedMultiplier: 1.9, asteroidCountIncrement: 1, powerupSpawnDelaySec:  9, shipPickupSpawnDelaySec: 15, maxLives: 3 },
]

const MAX_LEVELS = 30
const ASTEROID_INITIAL = 2
const ASTEROID_MAX = 10

const CHART_H = 160
const PAD = { top: 12, right: 12, bottom: 22, left: 32 }

function getBandForLevel(bands: LevelBand[], level: number): LevelBand {
  const sorted = [...bands].sort((a, b) => a.fromLevel - b.fromLevel)
  let current = sorted[0]
  for (const b of sorted) {
    if (b.fromLevel <= level) current = b
    else break
  }
  return current
}

function toX(level: number, width: number): number {
  const plotW = width - PAD.left - PAD.right
  return PAD.left + ((level - 1) / (MAX_LEVELS - 1)) * plotW
}

function toY(norm: number): number {
  const plotH = CHART_H - PAD.top - PAD.bottom
  return PAD.top + (1 - norm) * plotH
}

function normalize(val: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (val - min) / (max - min)))
}

interface Point { level: number; speed: number; count: number; powerup: number; ship: number; lives: number }

function computePoints(bands: LevelBand[]): Point[] {
  let count = ASTEROID_INITIAL
  return Array.from({ length: MAX_LEVELS }, (_, i) => {
    const level = i + 1
    if (level > 1) count = Math.min(ASTEROID_MAX, count + getBandForLevel(bands, level).asteroidCountIncrement)
    const band = getBandForLevel(bands, level)
    return {
      level,
      speed: normalize(band.asteroidSpeedMultiplier, 0.5, 3.5),
      count: normalize(count, ASTEROID_INITIAL, ASTEROID_MAX),
      powerup: normalize(1 / band.powerupSpawnDelaySec, 1 / 30, 1 / 5),
      ship: normalize(1 / band.shipPickupSpawnDelaySec, 1 / 60, 1 / 10),
      lives: normalize(band.maxLives ?? 5, 1, 10),
    }
  })
}

function pointsToPolyline(pts: Point[], key: keyof Omit<Point, 'level'>, width: number): string {
  return pts.map(p => `${toX(p.level, width)},${toY(p[key])}`).join(' ')
}

function createId() {
  return Math.random().toString(36).slice(2, 8)
}

const SERIES = [
  { key: 'speed' as const,   label: 'Asteroid speed',    color: 'var(--primary)' },
  { key: 'count' as const,   label: 'Asteroid count',    color: 'var(--text-warning)' },
  { key: 'powerup' as const, label: 'Powerup frequency', color: 'var(--entity-shield)' },
  { key: 'ship' as const,    label: 'Ship pickup freq',  color: 'var(--text-success)' },
  { key: 'lives' as const,   label: 'Max lives',         color: 'var(--destructive)' },
]

const LevelBandEditor: React.FC = () => {
  const [bands, setBands] = useState<LevelBand[]>(DEFAULT_BANDS)
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_BANDS[0].id)
  const svgRef = useRef<SVGSVGElement>(null)
  const [svgWidth, setSvgWidth] = useState(600)
  const resizeObserver = useRef<ResizeObserver | null>(null)

  const svgCallbackRef = useCallback((el: SVGSVGElement | null) => {
    if (resizeObserver.current) resizeObserver.current.disconnect()
    if (!el) return
    ;(svgRef as React.MutableRefObject<SVGSVGElement | null>).current = el
    resizeObserver.current = new ResizeObserver(() => {
      setSvgWidth(el.getBoundingClientRect().width)
    })
    resizeObserver.current.observe(el)
    setSvgWidth(el.getBoundingClientRect().width)
  }, [])

  const sorted = [...bands].sort((a, b) => a.fromLevel - b.fromLevel)
  const points = computePoints(sorted)
  const selected = bands.find(b => b.id === selectedId) ?? sorted[0]

  const updateSelected = (patch: Partial<LevelBand>) => {
    setBands(prev => prev.map(b => b.id === selectedId ? { ...b, ...patch } : b))
  }

  const splitBand = (band: LevelBand) => {
    const idx = sorted.findIndex(b => b.id === band.id)
    const nextFrom = idx < sorted.length - 1 ? sorted[idx + 1].fromLevel : MAX_LEVELS + 1
    const mid = Math.floor((band.fromLevel + nextFrom) / 2)
    if (mid <= band.fromLevel) return
    const newBand: LevelBand = { ...band, id: createId(), fromLevel: mid }
    setBands(prev => [...prev, newBand])
    setSelectedId(newBand.id)
  }

  const removeBand = (id: string) => {
    if (sorted.length <= 1) return
    setBands(prev => prev.filter(b => b.id !== id))
    setSelectedId(sorted.find(b => b.id !== id)?.id ?? sorted[0].id)
  }

  const nudgeBoundary = (band: LevelBand, delta: number) => {
    const newFrom = Math.max(2, band.fromLevel + delta)
    const prevBand = sorted[sorted.findIndex(b => b.id === band.id) - 1]
    if (prevBand && newFrom <= prevBand.fromLevel) return
    const nextBand = sorted[sorted.findIndex(b => b.id === band.id) + 1]
    if (nextBand && newFrom >= nextBand.fromLevel) return
    setBands(prev => prev.map(b => b.id === band.id ? { ...b, fromLevel: newFrom } : b))
  }

  const bandToLevel = (band: LevelBand, idx: number): number => {
    return idx < sorted.length - 1 ? sorted[idx + 1].fromLevel - 1 : MAX_LEVELS
  }

  return (
    <div className='space-y-4'>
      <div className='font-mono text-[9px] text-muted-foreground uppercase tracking-widest'>Level Progression — mock / local only</div>

      {/* Chart */}
      <div className='border border-border bg-background'>
        <svg
          ref={svgCallbackRef}
          width='100%'
          height={CHART_H}
          className='block'
        >
          {/* Band backgrounds */}
          {sorted.map((band, idx) => {
            const x1 = toX(band.fromLevel, svgWidth)
            const x2 = idx < sorted.length - 1
              ? toX(sorted[idx + 1].fromLevel, svgWidth)
              : toX(MAX_LEVELS, svgWidth) + 2
            const color = BAND_COLORS[idx % BAND_COLORS.length]
            const isSelected = band.id === selectedId
            return (
              <rect
                key={band.id}
                x={x1} y={PAD.top}
                width={x2 - x1}
                height={CHART_H - PAD.top - PAD.bottom}
                fill={color}
                fillOpacity={isSelected ? 0.08 : 0.03}
                className='cursor-pointer'
                onClick={() => setSelectedId(band.id)}
              />
            )
          })}

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(v => (
            <line
              key={v}
              x1={PAD.left} y1={toY(v)}
              x2={svgWidth - PAD.right} y2={toY(v)}
              stroke='var(--border-subtle)' strokeOpacity={1} strokeDasharray='2 3'
            />
          ))}

          {/* Y axis labels */}
          {[0, 0.5, 1].map(v => (
            <text
              key={v}
              x={PAD.left - 4} y={toY(v) + 3}
              fill='var(--text-dim)'
              fontSize={8}
              textAnchor='end'
              fontFamily='monospace'
            >
              {v === 0 ? 'lo' : v === 1 ? 'hi' : ''}
            </text>
          ))}

          {/* Band boundary lines */}
          {sorted.slice(1).map(band => (
            <line
              key={band.id}
              x1={toX(band.fromLevel, svgWidth)} y1={PAD.top}
              x2={toX(band.fromLevel, svgWidth)} y2={CHART_H - PAD.bottom}
              stroke='var(--border-medium)' strokeOpacity={1} strokeDasharray='3 3'
            />
          ))}

          {/* Series polylines */}
          {SERIES.map(s => (
            <polyline
              key={s.key}
              points={pointsToPolyline(points, s.key, svgWidth)}
              fill='none'
              stroke={s.color}
              strokeWidth={1.5}
              strokeOpacity={0.8}
            />
          ))}

          {/* X axis labels */}
          {[1, 5, 10, 15, 20, 25, 30].map(l => (
            <text
              key={l}
              x={toX(l, svgWidth)} y={CHART_H - 4}
              fill='var(--text-dim)'
              fontSize={8}
              textAnchor='middle'
              fontFamily='monospace'
            >
              {l}
            </text>
          ))}

          {/* Band labels on chart */}
          {sorted.map((band, idx) => {
            const x1 = toX(band.fromLevel, svgWidth)
            const x2 = idx < sorted.length - 1
              ? toX(sorted[idx + 1].fromLevel, svgWidth)
              : toX(MAX_LEVELS, svgWidth)
            const cx = (x1 + x2) / 2
            return (
              <text
                key={band.id}
                x={cx} y={PAD.top + 10}
                fill={BAND_COLORS[idx % BAND_COLORS.length]}
                fillOpacity={0.5}
                fontSize={8}
                textAnchor='middle'
                fontFamily='monospace'
              >
                {`L${band.fromLevel}–${bandToLevel(band, idx) >= MAX_LEVELS ? '∞' : bandToLevel(band, idx)}`}
              </text>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className='flex flex-wrap gap-4'>
        {SERIES.map(s => (
          <div key={s.key} className='flex items-center gap-1.5'>
            <div className='w-6 h-px' style={{ backgroundColor: s.color, opacity: 0.8 }} />
            <span className='font-mono text-[9px]' style={{ color: s.color, opacity: 0.7 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Band strip */}
      <div className='flex gap-px'>
        {sorted.map((band, idx) => {
          const span = bandToLevel(band, idx) - band.fromLevel + 1
          const isSelected = band.id === selectedId
          const color = BAND_COLORS[idx % BAND_COLORS.length]
          return (
            <button
              key={band.id}
              onClick={() => setSelectedId(band.id)}
              style={{ flex: span, borderColor: isSelected ? color : 'transparent' }}
              className={`relative py-1.5 px-1 border-b-2 transition-colors text-center ${isSelected ? 'bg-surface-subtle' : 'bg-surface-subtle hover:bg-surface-subtle'}`}
            >
              <span className='font-mono text-[9px]' style={{ color }}>
                L{band.fromLevel}–{bandToLevel(band, idx) >= MAX_LEVELS ? '∞' : bandToLevel(band, idx)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Selected band editor */}
      {selected && (() => {
        const idx = sorted.findIndex(b => b.id === selected.id)
        const color = BAND_COLORS[idx % BAND_COLORS.length]
        return (
          <div className='border border-border p-4 space-y-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <div className='w-2 h-2 rounded-full' style={{ backgroundColor: color }} />
                <span className='font-mono text-[10px] text-foreground uppercase tracking-widest'>
                  Level {selected.fromLevel}–{bandToLevel(selected, idx) >= MAX_LEVELS ? '∞' : bandToLevel(selected, idx)}
                </span>
              </div>
              <div className='flex gap-2'>
                {idx > 0 && (
                  <div className='flex items-center gap-1'>
                    <span className='font-mono text-[9px] text-muted-foreground'>starts at L</span>
                    <button onClick={() => nudgeBoundary(selected, -1)} className='w-4 h-4 flex items-center justify-center border border-edge-subtle text-muted-foreground hover:text-foreground text-[9px]'>−</button>
                    <span className='font-mono text-[9px] text-foreground w-4 text-center'>{selected.fromLevel}</span>
                    <button onClick={() => nudgeBoundary(selected, 1)} className='w-4 h-4 flex items-center justify-center border border-edge-subtle text-muted-foreground hover:text-foreground text-[9px]'>+</button>
                  </div>
                )}
                <button
                  onClick={() => splitBand(selected)}
                  className='font-mono text-[9px] text-muted-foreground hover:text-tx-secondary border border-border px-2 py-0.5 transition-colors'
                >
                  split
                </button>
                {sorted.length > 1 && (
                  <button
                    onClick={() => removeBand(selected.id)}
                    className='font-mono text-[9px] text-destructive/50 hover:text-destructive border border-destructive/20 px-2 py-0.5 transition-colors'
                  >
                    remove
                  </button>
                )}
              </div>
            </div>

            <div className='grid grid-cols-2 gap-2'>
              <BandField
                label='Asteroid speed'
                value={selected.asteroidSpeedMultiplier}
                min={0.5} max={4.0} step={0.1}
                display={v => `${v.toFixed(1)}×`}
                onChange={v => updateSelected({ asteroidSpeedMultiplier: v })}
              />
              <BandField
                label='Asteroids +/level'
                value={selected.asteroidCountIncrement}
                min={0} max={3} step={1}
                display={v => `+${v}`}
                onChange={v => updateSelected({ asteroidCountIncrement: v })}
              />
              <BandField
                label='Powerup every'
                value={selected.powerupSpawnDelaySec}
                min={5} max={60} step={1}
                display={v => `${v}s`}
                onChange={v => updateSelected({ powerupSpawnDelaySec: v })}
              />
              <BandField
                label='Ship pickup every'
                value={selected.shipPickupSpawnDelaySec}
                min={10} max={120} step={5}
                display={v => `${v}s`}
                onChange={v => updateSelected({ shipPickupSpawnDelaySec: v })}
              />
              <BandField
                label='Max lives'
                value={selected.maxLives ?? 5}
                min={1} max={10} step={1}
                display={v => `${v}`}
                onChange={v => updateSelected({ maxLives: v })}
              />
            </div>
          </div>
        )
      })()}
    </div>
  )
}

interface BandFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: (v: number) => string
  onChange: (v: number) => void
}

const BandField: React.FC<BandFieldProps> = ({ label, value, min, max, step, display, onChange }) => (
  <div className='flex items-center justify-between border border-border px-2 py-1.5 gap-2'>
    <span className='font-mono text-[9px] text-muted-foreground flex-1 leading-tight'>{label}</span>
    <div className='flex items-center gap-1 shrink-0'>
      <button
        onClick={() => onChange(Math.max(min, parseFloat((value - step).toFixed(10))))}
        className='w-5 h-5 flex items-center justify-center border border-edge-subtle text-muted-foreground hover:text-foreground transition-colors text-[10px]'
      >−</button>
      <span className='font-mono text-[10px] text-foreground w-12 text-center'>{display(value)}</span>
      <button
        onClick={() => onChange(Math.min(max, parseFloat((value + step).toFixed(10))))}
        className='w-5 h-5 flex items-center justify-center border border-edge-subtle text-muted-foreground hover:text-foreground transition-colors text-[10px]'
      >+</button>
    </div>
  </div>
)

export default LevelBandEditor
