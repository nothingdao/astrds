// src/components/common/ScreenContainer.tsx
import React from 'react'
// Import all background images
// Don't reference 'public' directory - just start with /assets
// @ts-ignore
import joiGif from '/assets/wojak.png'
// @ts-ignore
import wojakPng from '/assets/dying.gif'

// Background configurations for different screens
export const SCREEN_BACKGROUNDS = {
  INITIAL: {
    image: joiGif,
    overlay: 'bg-black/75', // Customize overlay opacity per screen
  },
  READY_TO_PLAY: {
    image: wojakPng,
    overlay: 'bg-black/60',
  },
  GAME_OVER: {
    image: wojakPng,
    overlay: 'bg-black/80',
  },
  LEADERBOARD: {
    image: joiGif,
    overlay: 'bg-black/75',
  },
}

const ScreenContainer = ({
  children,
  className = '',
  screenType = 'INITIAL',
}) => {
  const background =
    SCREEN_BACKGROUNDS[screenType] || SCREEN_BACKGROUNDS.INITIAL

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-40 ${className}`}
      style={{
        backgroundImage: `url(${background.image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div
        className={`${background.overlay} border border-game-blue p-8 max-w-2xl w-full mx-4`}
      >
        {children}
      </div>
    </div>
  )
}

export default ScreenContainer
