// src/components/common/GameTitle.tsx

import React from 'react'
import { GameTitleProps } from '@/types/components/menu'

const GameTitle: React.FC<GameTitleProps> = ({
  subtitle,
  animate = true,
  className = ''
}) => {
  const titleClass = `
    text-4xl md:text-5xl mb-5 uppercase text-center leading-tight
    text-foreground
    ${animate ? 'animate-[glow_1.5s_ease-in-out_infinite_alternate]' : ''}
    [text-shadow:var(--text-shadow-accent-glow)]
    ${className}
  `

  return (
    <>
      <h1 className={titleClass}>ASTRDS</h1>
      {subtitle && (
        <h2 className='text-md md:text-lg mb-5 uppercase text-center leading-tight
                      text-foreground animate-[glow_1.5s_ease-in-out_infinite_alternate]
                      [text-shadow:var(--text-shadow-accent-glow)]'>
          {subtitle}
        </h2>
      )}
    </>
  )
}

export default GameTitle
