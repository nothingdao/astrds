// src/components/icons/GameIcons.tsx
import React from 'react'

export const ShipIcon = ({ className = '' }) => (
  <svg
    viewBox='0 0 24 24'
    className={className}
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
  >
    {/* Matches ship design from Ship.js render method */}
    <path
      d='M12 4 L22 19 L17 16 L12 16 L7 16 L2 19 Z'
      strokeLinejoin='round'
    />
  </svg>
)

export const TokenIcon = ({ className = '' }) => (
  <svg
    viewBox='0 0 24 24'
    className={className}
  >
    {/* Matches Token.js render method */}
    <circle
      cx='12'
      cy='12'
      r='10'
      stroke='currentColor'
      fill='none'
      strokeWidth='2'
    />
    <circle
      cx='12'
      cy='12'
      r='6'
      stroke='currentColor'
      fill='none'
      strokeWidth='2'
      className='animate-pulse'
    />
  </svg>
)

export const PillIcon = ({ className = '' }) => (
  <svg
    viewBox='0 0 24 24'
    className={className}
  >
    {/* Matches Pill.js render method design */}
    <circle
      cx='12'
      cy='12'
      r='8'
      stroke='currentColor'
      fill='none'
      strokeWidth='2'
      className='animate-pulse'
    />
    <circle
      cx='12'
      cy='12'
      r='4'
      fill='currentColor'
      className='animate-pulse'
    />
  </svg>
)
