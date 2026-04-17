// src/components/sound/VolumeControl.tsx
import React, { useRef } from 'react'
import { useAudio } from '@/hooks/useAudio'

const BLOCKS = [1, 2, 3, 4, 5]

const BLOCK_COLORS = [
  'bg-green-400',
  'bg-green-400',
  'bg-yellow-400',
  'bg-orange-400',
  'bg-red-400',
]

const VolumeControl = () => {
  const { volumes, setVolume } = useAudio()
  const savedMusicVolume = useRef(volumes.music > 0 ? volumes.music : 0.5)

  // Which block is active: ceil(master * 5), so 0.2→1, 0.4→2 … 1.0→5
  const activeBlocks = Math.round(volumes.master * 5)
  const musicOn = volumes.music > 0

  const handleBlockClick = (n: number) => {
    setVolume('master', n / 5)
  }

  const handleMusicToggle = () => {
    if (musicOn) {
      savedMusicVolume.current = volumes.music
      setVolume('music', 0)
    } else {
      setVolume('music', savedMusicVolume.current)
    }
  }

  return (
    <div className='space-y-3 font-mono text-xs'>
      {/* Master volume */}
      <div className='flex items-center gap-3'>
        <span className='text-white/40 w-8'>VOL</span>
        <div className='flex gap-1'>
          {BLOCKS.map((n) => (
            <button
              key={n}
              onClick={() => handleBlockClick(n)}
              className={`w-6 h-4 border transition-colors ${
                n <= activeBlocks
                  ? `${BLOCK_COLORS[n - 1]} border-transparent`
                  : 'bg-white/10 border-white/20 hover:bg-white/20'
              }`}
              title={`Volume ${n * 20}%`}
            />
          ))}
        </div>
        <span className='text-white/30'>[1–5]</span>
      </div>

      {/* Music toggle */}
      <div className='flex items-center gap-3'>
        <span className='text-white/40 w-8'>MUS</span>
        <button
          onClick={handleMusicToggle}
          className={`px-3 h-4 border text-xs transition-colors leading-none ${
            musicOn
              ? 'bg-game-blue/80 border-game-blue text-black'
              : 'bg-white/10 border-white/20 text-white/40 hover:bg-white/20'
          }`}
        >
          {musicOn ? 'ON' : 'OFF'}
        </button>
        <span className='text-white/30'>[M]</span>
      </div>
    </div>
  )
}

export default VolumeControl
