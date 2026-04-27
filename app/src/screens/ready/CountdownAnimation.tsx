// src/screens/ready/CountdownAnimation.tsx
import React from 'react'

export const CountdownDigit = ({ number, onComplete }) => {
  return (
    <div
      className='relative w-32 h-32 flex items-center justify-center'
      onAnimationEnd={onComplete}
    >
      <span
        className='absolute inset-0 flex items-center justify-center
                   text-8xl font-bold text-primary
                   animate-[countdownPulse_1s_ease-out]
                   [text-shadow:var(--text-shadow-accent-glow)]'
      >
        {number}
      </span>
      <span
        className='absolute inset-0 flex items-center justify-center
                   text-8xl font-bold text-transparent
                   animate-[countdownExpand_1s_ease-out]
                   [text-shadow:var(--text-shadow-accent-glow)]'
      >
        {number}
      </span>
    </div>
  )
}

export const ReadyGoText = ({ text, onComplete }) => {
  return (
    <div
      className='text-6xl font-bold text-primary
                 animate-[readyGoPulse_0.5s_ease-out]
                 [text-shadow:var(--text-shadow-accent-glow)]'
      onAnimationEnd={onComplete}
    >
      {text}
    </div>
  )
}
