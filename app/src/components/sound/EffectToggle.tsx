// src/components/sound/EffectToggle.tsx
import React from 'react'

const EffectToggle = ({
  value,
  onChange,
  label,
  effectType,
  className = '',
}) => {
  // Define the states and their properties
  const states = {
    off: {
      label: 'Off',
      color: 'text-gray-400',
      bgColor: 'bg-black/50',
      borderColor: 'border-gray-600',
    },
    quiet: {
      label: 'Quiet',
      color: 'text-game-blue',
      bgColor: 'bg-game-blue/20',
      borderColor: 'border-game-blue/50',
    },
    normal: {
      label: 'Normal',
      color: 'text-game-blue',
      bgColor: 'bg-game-blue/30',
      borderColor: 'border-game-blue',
    },
  }

  // Function to get next state
  const getNextState = (currentState) => {
    const sequence = ['off', 'quiet', 'normal']
    const currentIndex = sequence.indexOf(currentState)
    return sequence[(currentIndex + 1) % sequence.length]
  }

  const currentState = states[value]

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <span className='text-sm text-white/80'>{label}</span>

      <button
        onClick={() => onChange(effectType, getNextState(value))}
        className={`px-4 py-1 rounded text-xs font-medium
                   border transition-all duration-200
                   ${currentState.color}
                   ${currentState.bgColor}
                   ${currentState.borderColor}
                   hover:border-white hover:text-white`}
      >
        {currentState.label}
      </button>
    </div>
  )
}

export default EffectToggle
