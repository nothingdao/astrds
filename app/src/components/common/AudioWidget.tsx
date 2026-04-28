// src/components/common/AudioWidget.tsx
// Track name, real-time frequency visualizer, and volume blocks.
// Reads from the Web Audio AnalyserNode wired inside AudioService.
import React, { useEffect, useRef } from 'react'
import { useAudio } from '@/hooks/useAudio'
import { audioService } from '@/services/audio/AudioService'
import { getCanvasTokens } from '@/lib/designTokens'

const TRACK_NAMES: Record<string, string> = {
  titleMusic:    'ARCIS',
  readyMusic:    'READY',
  gameMusic:     'WARRIOR TRAVEL',
  gameOverMusic: 'ARCIS',
}

const BLOCK_COLORS = [
  'bg-[var(--text-success)]',
  'bg-[var(--text-success)]',
  'bg-[var(--text-warning)]',
  'bg-[var(--entity-particle)]',
  'bg-[var(--text-danger)]',
]

const BAR_COUNT = 20

interface AudioWidgetProps {
  /** compact = shorter bars, smaller text (for GameHUD) */
  compact?: boolean
}

const AudioWidget: React.FC<AudioWidgetProps> = ({ compact = false }) => {
  const { currentMusic, volumes, setVolume } = useAudio()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>()

  const trackName = currentMusic ? (TRACK_NAMES[String(currentMusic)] ?? String(currentMusic).toUpperCase()) : null
  const activeBlocks = Math.round(volumes.master * 5)
  const barH = compact ? 16 : 24

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const data = audioService.getFrequencyData()

      for (let i = 0; i < BAR_COUNT; i++) {
        // Sample evenly across the lower half of the spectrum (bass/mid are most visible)
        const binIndex = data
          ? Math.floor((i / BAR_COUNT) * (data.length * 0.6))
          : 0
        const raw = data ? data[binIndex] / 255 : 0

        // Minimum 2px bar so it's always visible
        const height = Math.max(2, raw * canvas.height)
        const x = i * (canvas.width / BAR_COUNT)
        const w = canvas.width / BAR_COUNT - 1
        const alpha = 0.3 + raw * 0.7

        ctx.globalAlpha = alpha
        ctx.fillStyle = getCanvasTokens().pill
        ctx.fillRect(x, canvas.height - height, w, height)
        ctx.globalAlpha = 1
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  return (
    <div className='flex items-center gap-3'>
      {/* Track name */}
      {trackName && (
        <span className={`font-mono uppercase tracking-wider text-muted-foreground ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          {trackName}
        </span>
      )}

      {/* Visualizer */}
      <canvas
        ref={canvasRef}
        width={compact ? 60 : 80}
        height={barH}
        className='opacity-70'
      />

      {/* Volume blocks */}
      <div className='flex items-end gap-px'>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setVolume('master', n / 5)}
            title={`Volume ${n * 20}%`}
            className={`transition-colors pointer-events-auto ${compact ? 'w-2' : 'w-2.5'} ${
              n <= activeBlocks
                ? `${BLOCK_COLORS[n - 1]}`
                : 'bg-surface-subtle hover:bg-surface-medium'
            }`}
            style={{ height: compact ? `${6 + n * 2}px` : `${8 + n * 2.5}px` }}
          />
        ))}
      </div>
    </div>
  )
}

export default AudioWidget
