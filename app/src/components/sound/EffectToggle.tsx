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
      color: 'text-muted-foreground',
      bgColor: 'bg-surface-overlay',
      borderColor: 'border-border',
    },
    quiet: {
      label: 'Quiet',
      color: 'text-primary',
      bgColor: 'bg-primary/20',
      borderColor: 'border-primary/50',
    },
    normal: {
      label: 'Normal',
      color: 'text-primary',
      bgColor: 'bg-primary/30',
      borderColor: 'border-primary',
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
      <span className='text-sm text-tx-primary'>{label}</span>

      <button
        onClick={() => onChange(effectType, getNextState(value))}
        className={`px-4 py-1 rounded text-xs font-medium
                   border transition-all duration-200
                   ${currentState.color}
                   ${currentState.bgColor}
                   ${currentState.borderColor}
                   hover:border-border hover:text-foreground`}
      >
        {currentState.label}
      </button>
    </div>
  )
}

export default EffectToggle
