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
                   text-8xl font-bold text-game-blue
                   animate-[countdownPulse_1s_ease-out]
                   [text-shadow:0_0_10px_#4dc1f9,0_0_20px_#4dc1f9]'
      >
        {number}
      </span>
      <span
        className='absolute inset-0 flex items-center justify-center
                   text-8xl font-bold text-transparent
                   animate-[countdownExpand_1s_ease-out]
                   [text-shadow:0_0_30px_#4dc1f9]'
      >
        {number}
      </span>
    </div>
  )
}

export const ReadyGoText = ({ text, onComplete }) => {
  return (
    <div
      className='text-6xl font-bold text-game-blue
                 animate-[readyGoPulse_0.5s_ease-out]
                 [text-shadow:0_0_10px_#4dc1f9,0_0_20px_#4dc1f9,0_0_30px_#4dc1f9]'
      onAnimationEnd={onComplete}
    >
      {text}
    </div>
  )
}
