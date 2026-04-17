// src/components/sound/VolumeSlider.tsx
import React from 'react'
import { Volume2, VolumeX } from 'lucide-react'

const VolumeSlider = ({
  value,
  onChange,
  label,
  channel = 'master',
  showLabel = true,
  showIcon = true,
  className = '',
}) => {
  // Convert decimal to percentage for display
  const percentage = Math.round(value * 100)

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showIcon && (
        <button
          onClick={() => onChange(value > 0 ? 0 : 0.5)}
          className='text-game-blue hover:text-white transition-colors'
          title={value > 0 ? 'Mute' : 'Unmute'}
        >
          {value > 0 ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      )}

      <div className='flex-1'>
        {showLabel && (
          <div className='flex justify-between items-center mb-1'>
            <label
              htmlFor={`volume-${channel}`}
              className='text-xs text-game-blue'
            >
              {label || channel.charAt(0).toUpperCase() + channel.slice(1)}
            </label>
            <span className='text-xs text-white/50'>{percentage}%</span>
          </div>
        )}

        <div className='relative group'>
          <input
            id={`volume-${channel}`}
            type='range'
            min='0'
            max='1'
            step='0.01'
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className='w-full h-2 bg-black/50 rounded-lg appearance-none cursor-pointer
                     border border-game-blue/30
                     hover:border-game-blue
                     focus:outline-none focus:border-game-blue
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-4
                     [&::-webkit-slider-thumb]:h-4
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-game-blue
                     [&::-webkit-slider-thumb]:hover:bg-white
                     [&::-webkit-slider-thumb]:transition-colors
                     [&::-moz-range-thumb]:w-4
                     [&::-moz-range-thumb]:h-4
                     [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-game-blue
                     [&::-moz-range-thumb]:hover:bg-white
                     [&::-moz-range-thumb]:transition-colors
                     [&::-moz-range-thumb]:border-0'
          />

          {/* Volume level indicator */}
          <div
            className='absolute top-0 left-0 h-2 bg-game-blue/30 rounded-l-lg pointer-events-none'
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default VolumeSlider
