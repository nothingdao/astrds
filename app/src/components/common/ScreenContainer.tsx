// src/components/common/ScreenContainer.tsx
import React from 'react'
// Import all background images
// Don't reference 'public' directory - just start with /assets
// @ts-ignore
import titleDarkPng from '/assets/title-dark.png'
// @ts-ignore
import titleLightPng from '/assets/title-light.png'
// @ts-ignore
import readyDarkPng from '/assets/ready-dark.png'
// @ts-ignore
import readyLightPng from '/assets/ready-light.png'
// @ts-ignore
import endGameDarkPng from '/assets/end-game-dark.png'
// @ts-ignore
import endGameLightPng from '/assets/end-game-light.png'
import { useThemeStore } from '@/stores/themeStore'

// Background configurations for different screens
export const SCREEN_BACKGROUNDS = {
  INITIAL: {
    image: {
      dark: titleDarkPng,
      light: titleLightPng,
    },
    // TitleScreen owns its own gradient/scanline overlays.
    overlay: 'bg-transparent',
  },
  READY_TO_PLAY: {
    image: {
      dark: readyDarkPng,
      light: readyLightPng,
    },
    overlay: 'bg-surface-overlay',
  },
  GAME_OVER: {
    image: {
      dark: endGameDarkPng,
      light: endGameLightPng,
    },
    // Keep end-screen art visible; GameOverScreen has its own content panel.
    overlay: 'bg-transparent',
  },
} as const

type ScreenType = keyof typeof SCREEN_BACKGROUNDS

type ScreenContainerProps = {
  children: React.ReactNode
  className?: string
  screenType?: ScreenType
  mode?: 'panel' | 'fullscreen'
  panelClassName?: string
}

const ScreenContainer = ({
  children,
  className = '',
  screenType = 'INITIAL',
  mode = 'panel',
  panelClassName = '',
}: ScreenContainerProps) => {
  const theme = useThemeStore((state) => state.mode)
  const background =
    SCREEN_BACKGROUNDS[screenType] || SCREEN_BACKGROUNDS.INITIAL
  const backgroundImage = background.image[theme]

  const isPanel = mode === 'panel'

  return (
    <div
      className={`fixed inset-0 z-40 ${isPanel ? 'flex items-center justify-center' : ''} ${className}`}
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {isPanel ? (
        <div
          className={`${background.overlay} border border-primary p-8 max-w-2xl w-full mx-4 ${panelClassName}`}
        >
          {children}
        </div>
      ) : (
        <>
          <div className={`absolute inset-0 ${background.overlay}`} />
          <div className='relative z-10 w-full h-full'>{children}</div>
        </>
      )}
    </div>
  )
}

export default ScreenContainer
